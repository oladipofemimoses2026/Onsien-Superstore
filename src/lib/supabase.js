import { createClient } from '@supabase/supabase-js';

// Publishable key only: safe in the browser because Row Level Security guards the data.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);
