import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bhpelimxagpohziqcufh.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJocGVsaW14YWdwb2h6aXFjdWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTcxMzksImV4cCI6MjA3MDA5MzEzOX0.RSbsMFiphB2z7ms2ChW25A3Oj6O6tezZthRJqnTDrU0'

const options = {
  global: {
    headers: { 
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, options);
