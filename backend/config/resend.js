/**
 * resend.js
 * Resend API client setup.
 * Used for sending secure email OTP notifications.
 */

const { Resend } = require('resend');
const config = require('./config');

let resend = null;

try {
  const isPlaceholder = !config.resend.apiKey || 
                        config.resend.apiKey.includes('dummy') || 
                        config.resend.apiKey.includes('your_resend');

  if (!isPlaceholder) {
    resend = new Resend(config.resend.apiKey);
    console.log('[Resend] API client initialized.');
  } else {
    console.warn('[Resend] Warning: Resend API Key is missing or dummy. Email features will run in mock mode.');
  }
} catch (error) {
  console.error('[Resend] Error initializing Resend client:', error.message);
}

module.exports = resend;
