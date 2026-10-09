// Keeps track of who is signed in. Any page can use useAuth().
// On the website: Google sign-in works as a normal redirect.
// In the Android app: Google sign-in opens in a secure browser tab, then
// returns to the app through com.ojapantry.app://auth-callback.
import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from './supabase.js';

const AuthContext = createContext(null);

const IS_APP = Capacitor.isNativePlatform();
const APP_REDIRECT = 'com.ojapantry.app://auth-callback';
const RETURN_KEY = 'oja-auth-return-to';
const HANDLED_KEY = 'oja-auth-last-handled';

// Only allow returning to pages on our own site (e.g. "/checkout").
function safePath(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

// Reads values from both the ?query and the #fragment of the return link.
function readParams(url) {
  const out = new URLSearchParams();
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  if (queryIndex !== -1 && (hashIndex === -1 || queryIndex < hashIndex)) {
    const query = url.slice(queryIndex + 1, hashIndex === -1 ? undefined : hashIndex);
    new URLSearchParams(query).forEach((value, key) => out.set(key, value));
  }
  if (hashIndex !== -1) {
    new URLSearchParams(url.slice(hashIndex + 1)).forEach((value, key) => out.set(key, value));
  }
  return out;
}

// A short fingerprint of a return link, so the same link is never used twice
// (for example if the page reloads while the app is open).
function fingerprint(url) {
  return url.length + ':' + url.slice(-24);
}

function alreadyHandled(url) {
  try {
    return localStorage.getItem(HANDLED_KEY) === fingerprint(url);
  } catch {
    return false;
  }
}

function markHandled(url) {
  try {
    localStorage.setItem(HANDLED_KEY, fingerprint(url));
  } catch {
    // Storage blocked: ignore.
  }
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if someone is already signed in (e.g. after a page refresh).
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Update whenever someone signs in or out.
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  // App only: finish sign-in when Google sends the customer back to the app.
  useEffect(() => {
    if (!IS_APP) return;

    let cancelled = false;
    let listener = null;

    async function handleReturnLink(url) {
      if (!url || !url.startsWith(APP_REDIRECT)) return;
      if (alreadyHandled(url)) return;
      markHandled(url);

      try {
        await Browser.close();
      } catch {
        // Android may close the tab by itself: ignore.
      }

      const params = readParams(url);
      const problem = params.get('error_description') || params.get('error');
      if (problem) {
        alert('Google sign-in did not finish: ' + problem);
        return;
      }

      let error = null;
      if (params.get('code')) {
        ({ error } = await supabase.auth.exchangeCodeForSession(params.get('code')));
      } else if (params.get('access_token') && params.get('refresh_token')) {
        ({ error } = await supabase.auth.setSession({
          access_token: params.get('access_token'),
          refresh_token: params.get('refresh_token'),
        }));
      } else {
        return;
      }

      if (error) {
        alert('Could not finish sign-in: ' + error.message);
        return;
      }

      let returnTo = '/';
      try {
        returnTo = safePath(localStorage.getItem(RETURN_KEY));
        localStorage.removeItem(RETURN_KEY);
      } catch {
        // Storage blocked: go to the home page.
      }
      navigate(returnTo, { replace: true });
    }

    // The app was already open in the background.
    CapApp.addListener('appUrlOpen', (event) => handleReturnLink(event.url)).then((handle) => {
      if (cancelled) handle.remove();
      else listener = handle;
    });

    // The app had been closed and was started by the return link.
    CapApp.getLaunchUrl()
      .then((result) => handleReturnLink(result?.url))
      .catch(() => {});

    return () => {
      cancelled = true;
      if (listener) listener.remove();
    };
  }, [navigate]);

  // Sends the customer to Google, then back to the page they were on.
  async function signInWithGoogle(returnTo = window.location.pathname) {
    if (IS_APP) {
      try {
        localStorage.setItem(RETURN_KEY, safePath(returnTo));
      } catch {
        // Storage blocked: they will land on the home page instead.
      }
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: APP_REDIRECT, skipBrowserRedirect: true },
      });
      if (error || !data?.url) {
        alert('Could not start Google sign-in: ' + (error?.message || 'no sign-in link'));
        return;
      }
      await Browser.open({ url: data.url });
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + returnTo },
    });
    if (error) {
      alert('Could not start Google sign-in: ' + error.message);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const user = session?.user ?? null;

  return (
    <AuthContext.Provider value={{ session, user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
