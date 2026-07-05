/**
 * config.js
 * Centralized application configuration.
 * Loads and validates environment variables.
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_secret_key_change_me_immediately',
    expiresIn: process.env.JWT_EXPIRE || '24h',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.EMAIL_FROM || 'onboarding@resend.dev',
  },
  openai: {
    apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '',
  }
};
