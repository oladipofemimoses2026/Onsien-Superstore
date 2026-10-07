// The browser's connection to Supabase. Uses only the PUBLISHABLE key, which is safe to show.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Add them in Vercel and redeploy.');
}

export const supabase = createClient(url || 'https://missing.supabase.co', key || 'missing-key');
