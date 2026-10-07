// Keeps track of who is signed in. Any page can use useAuth().
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
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

  // Sends the customer to Google, then back to the page they were on.
  async function signInWithGoogle(returnTo = window.location.pathname) {
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
