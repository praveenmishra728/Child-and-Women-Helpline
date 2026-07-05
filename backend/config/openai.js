/**
 * openai.js
 * OpenAI client configuration.
 * Configures the connection using the official OpenAI Node SDK.
 */

const OpenAI = require('openai');
const config = require('./config');

let openai = null;

try {
  const isPlaceholder = !config.openai.apiKey || 
                        config.openai.apiKey.includes('dummy') || 
                        config.openai.apiKey.includes('your-openai') || 
                        config.openai.apiKey.includes('yourOpenAiApiKey');

  if (!isPlaceholder) {
    openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    console.log('[OpenAI] Client initialized.');
  } else {
    console.warn('[OpenAI] Warning: OpenAI API key is missing or dummy. AI features will run in mock mode.');
  }
} catch (error) {
  console.error('[OpenAI] Error initializing OpenAI client:', error.message);
}

module.exports = openai;
