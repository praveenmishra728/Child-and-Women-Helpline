/**
 * db.js
 * Supabase client configuration.
 * Initializes connection to Supabase database and storage bucket.
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

let supabase = null;

try {
  const isPlaceholder = !config.supabase.url || 
                        !config.supabase.anonKey || 
                        config.supabase.url.includes('dummy') || 
                        config.supabase.url.includes('your-project') || 
                        config.supabase.anonKey.includes('dummy') || 
                        config.supabase.anonKey.includes('your-supabase');

  if (!isPlaceholder) {
    // Initialize Supabase Client
    supabase = createClient(config.supabase.url, config.supabase.anonKey);
    console.log('[Supabase] Client initialized successfully.');
  } else {
    console.warn('[Supabase] Warning: Missing or dummy Supabase URL or Anon Key. Using placeholder client (Mock Mode).');
  }
} catch (error) {
  console.error('[Supabase] Error initializing Supabase client:', error.message);
}

module.exports = supabase;
