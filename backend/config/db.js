/**
 * db.js
 * Supabase client configuration.
 * Initializes connection to Supabase database and storage bucket.
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

let supabase = null;

try {
  const keyToCheck = config.supabase.serviceRoleKey || config.supabase.anonKey;
  const isPlaceholder = !config.supabase.url || 
                        !keyToCheck || 
                        config.supabase.url.includes('dummy') || 
                        config.supabase.url.includes('your-project') || 
                        (!keyToCheck.startsWith('eyJ') && !keyToCheck.startsWith('sb_') && !keyToCheck.startsWith('ssb_'));

  if (!isPlaceholder) {
    // Initialize Supabase Client using Service Role Key to bypass RLS on the backend server
    const key = config.supabase.serviceRoleKey || config.supabase.anonKey;
    supabase = createClient(config.supabase.url, key);
    console.log('[Supabase] Client initialized successfully (using service role bypass).');
  } else {
    console.warn('[Supabase] Warning: Missing or dummy Supabase URL or Key. Using placeholder client (Mock Mode).');
  }
} catch (error) {
  console.error('[Supabase] Error initializing Supabase client:', error.message);
}

module.exports = supabase;
