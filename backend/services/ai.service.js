/**
 * ai.service.js
 * Core AI service layer for SurakshaAI Safety Assistant.
 *
 * ALL OpenAI logic lives here — controllers must never call OpenAI directly.
 *
 * Two-phase conversation workflow:
 *   Phase 1 — Analyze user's initial message → generate one follow-up question.
 *   Phase 2 — Analyze original + follow-up answer → produce full safety report.
 *
 * Uses: OpenAI Responses API (openai.responses.create)
 */

'use strict';

const openaiClient   = require('../config/openai');
const supabase        = require('../config/db');
const ApiError        = require('../utils/apiError');
const {
  PHASE_1_SYSTEM_PROMPT,
  PHASE_2_SYSTEM_PROMPT,
  FALLBACK_PHASE1_RESPONSE,
  FALLBACK_PHASE2_RESPONSE,
  MAX_USER_MESSAGE_LENGTH,
} = require('./prompts');


// ─────────────────────────────────────────────────────────────────────────────
// HELPER — Response Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely parse the raw AI text output into a structured JSON object.
 * Handles cases where the model wraps JSON in markdown code fences.
 * @param {string} rawText - Raw text from the AI response
 * @param {object} fallback - Fallback object to return on parse failure
 * @returns {object} Parsed response or fallback
 */
const parseAiResponse = (rawText, fallback) => {
  try {
    // Strip markdown fences if present (```json ... ```)
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // Normalize riskLevel to uppercase for consistency
    if (parsed.riskLevel) {
      parsed.riskLevel = parsed.riskLevel.toUpperCase();
    }

    // Guarantee recommendedHelplines is always an array
    if (!Array.isArray(parsed.recommendedHelplines)) {
      parsed.recommendedHelplines = [];
    }

    return parsed;
  } catch (err) {
    console.error('[AI Service] JSON parse failed. Raw text:', rawText?.slice(0, 200));
    return { ...fallback, _parseError: true };
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// HELPER — Prompt Sanitizer (prevents prompt injection)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitizes and truncates user input before sending to OpenAI.
 * @param {string} text - Raw user input
 * @returns {string} Sanitized string
 */
const sanitizeUserInput = (text) => {
  if (!text || typeof text !== 'string') return '';

  return text
    .trim()
    .slice(0, MAX_USER_MESSAGE_LENGTH)          // Hard length limit
    .replace(/<[^>]*>/g, '')                    // Strip HTML tags (XSS guard)
    .replace(/[^\w\s\u0900-\u097F.,!?'"()-]/g, ' ') // Allow Devanagari + basic punctuation
    .replace(/\s+/g, ' ');                      // Collapse whitespace
};


// ─────────────────────────────────────────────────────────────────────────────
// HELPER — OpenAI Responses API caller
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls the OpenAI Responses API with a system prompt and user message(s).
 * @param {string} systemPrompt - The system instruction
 * @param {Array<object>} inputMessages - Array of { role, content } objects
 * @returns {Promise<string>} Raw text output from the model
 */
const callOpenAiResponses = async (systemPrompt, inputMessages) => {
  // Combine system prompt into the input as the first item
  const input = [
    { role: 'system', content: systemPrompt },
    ...inputMessages,
  ];

  const response = await openaiClient.responses.create({
    model: 'gpt-4o',
    input,
    text: {
      format: {
        type: 'json_object', // Enforce structured JSON output
      },
    },
    temperature: 0.4,       // Lower temperature = more consistent safety advice
    max_output_tokens: 800,
  });

  // Extract the text from the response output
  const outputItem = response.output?.find(
    (item) => item.type === 'message' && item.role === 'assistant'
  );

  const rawText = outputItem?.content
    ?.filter((c) => c.type === 'output_text')
    ?.map((c) => c.text)
    ?.join('') ?? '';

  return rawText;
};


// ─────────────────────────────────────────────────────────────────────────────
// DATABASE — Save conversation turn
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves one conversation message turn to the ai_conversations table.
 * @param {string|null} userId - Profile UUID (null for anonymous)
 * @param {string} sessionId   - UUID grouping the full conversation
 * @param {string} role        - 'user' | 'assistant'
 * @param {string} message     - Message content
 */
const saveConversationTurn = async (userId, sessionId, role, message) => {
  try {
    if (supabase) {
      await supabase.from('ai_conversations').insert({
        user_id:    userId,
        session_id: sessionId,
        role,
        message: typeof message === 'object' ? JSON.stringify(message) : message,
      });
    } else {
      console.log(`[AI DB Mock] Saved turn — session: ${sessionId}, role: ${role}`);
    }
  } catch (err) {
    // Never crash the request over a logging failure
    console.error('[AI Service] Failed to save conversation turn:', err.message);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — Phase 1: Start Conversation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyzes the user's initial message and returns ONE follow-up question.
 * Persists both user message and AI response to the database.
 *
 * @param {object} params
 * @param {string} params.userMessage - User's first message
 * @param {string} params.sessionId   - Client-generated UUID for this session
 * @param {string|null} params.userId - Authenticated user ID (null if anonymous)
 * @returns {Promise<object>} Structured AI response
 */
const startConversation = async ({ userMessage, sessionId, userId }) => {
  const clean = sanitizeUserInput(userMessage);

  if (!clean) {
    throw ApiError.badRequest('Message content is empty after sanitization.');
  }

  // 1. Persist user's opening message
  await saveConversationTurn(userId, sessionId, 'user', clean);

  // 2. Call AI — mock if client unavailable
  if (!openaiClient) {
    console.warn('[AI Service] OpenAI unavailable — returning Phase 1 fallback.');
    const fallback = { ...FALLBACK_PHASE1_RESPONSE, sessionId };
    await saveConversationTurn(userId, sessionId, 'assistant', JSON.stringify(fallback));
    return fallback;
  }

  try {
    const rawText = await callOpenAiResponses(PHASE_1_SYSTEM_PROMPT, [
      { role: 'user', content: clean },
    ]);

    const parsed = parseAiResponse(rawText, FALLBACK_PHASE1_RESPONSE);

    // 3. Persist AI follow-up question
    await saveConversationTurn(userId, sessionId, 'assistant', JSON.stringify(parsed));

    return { ...parsed, sessionId };
  } catch (err) {
    console.error('[AI Service] Phase 1 OpenAI call failed:', err.message);
    const fallback = { ...FALLBACK_PHASE1_RESPONSE, sessionId };
    await saveConversationTurn(userId, sessionId, 'assistant', JSON.stringify(fallback));
    return fallback;
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — Phase 2: Respond with Follow-Up Answer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accepts the user's follow-up answer, analyzes both messages,
 * and returns a full structured safety report.
 *
 * @param {object} params
 * @param {string} params.sessionId         - Same session ID from Phase 1
 * @param {string} params.originalMessage   - User's first message
 * @param {string} params.followUpQuestion  - The AI's Phase 1 question
 * @param {string} params.followUpAnswer    - User's answer to the follow-up
 * @param {string|null} params.userId       - Authenticated user ID
 * @returns {Promise<object>} Full structured safety report
 */
const respondToFollowUp = async ({
  sessionId,
  originalMessage,
  followUpQuestion,
  followUpAnswer,
  userId,
}) => {
  const cleanAnswer = sanitizeUserInput(followUpAnswer);
  const cleanOriginal = sanitizeUserInput(originalMessage);

  if (!cleanAnswer) {
    throw ApiError.badRequest('Follow-up answer is empty after sanitization.');
  }

  // 1. Persist user's follow-up answer
  await saveConversationTurn(userId, sessionId, 'user', cleanAnswer);

  // 2. Build the full conversation context for Phase 2
  const inputMessages = [
    {
      role: 'user',
      content: `User's original concern:\n${cleanOriginal}`,
    },
    {
      role: 'assistant',
      content: `My follow-up question:\n${followUpQuestion}`,
    },
    {
      role: 'user',
      content: `User's answer:\n${cleanAnswer}`,
    },
  ];

  // 3. Call AI — mock if unavailable
  if (!openaiClient) {
    console.warn('[AI Service] OpenAI unavailable — returning Phase 2 fallback.');
    const fallback = { ...FALLBACK_PHASE2_RESPONSE, sessionId };
    await saveConversationTurn(userId, sessionId, 'assistant', JSON.stringify(fallback));
    return fallback;
  }

  try {
    const rawText = await callOpenAiResponses(PHASE_2_SYSTEM_PROMPT, inputMessages);
    const parsed  = parseAiResponse(rawText, FALLBACK_PHASE2_RESPONSE);

    // 4. Persist full AI safety report
    await saveConversationTurn(userId, sessionId, 'assistant', JSON.stringify(parsed));

    return { ...parsed, sessionId };
  } catch (err) {
    console.error('[AI Service] Phase 2 OpenAI call failed:', err.message);
    const fallback = { ...FALLBACK_PHASE2_RESPONSE, sessionId };
    await saveConversationTurn(userId, sessionId, 'assistant', JSON.stringify(fallback));
    return fallback;
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — History Retrieval
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all conversation sessions for a user, grouped by session_id.
 * @param {string} userId - Authenticated user ID
 * @returns {Promise<Array>} List of sessions with their latest turn
 */
const getUserConversationHistory = async (userId) => {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`History fetch failed: ${error.message}`);
  }

  // Group turns by session_id
  const sessions = {};
  (data || []).forEach((row) => {
    if (!sessions[row.session_id]) {
      sessions[row.session_id] = {
        sessionId:  row.session_id,
        startedAt:  row.created_at,
        turns:      [],
      };
    }
    sessions[row.session_id].turns.push({
      id:        row.id,
      role:      row.role,
      message:   row.message,
      createdAt: row.created_at,
    });
  });

  return Object.values(sessions);
};


/**
 * Returns all turns for a single session (ownership enforced).
 * @param {string} sessionId - Session UUID
 * @param {string} userId    - Authenticated user ID
 * @returns {Promise<Array>} Conversation turns
 */
const getSessionById = async (sessionId, userId) => {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', userId)            // Ownership enforcement at DB level
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Session fetch failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw ApiError.notFound('Conversation session not found or access denied.');
  }

  return data;
};


/**
 * Deletes all turns belonging to a session (ownership enforced).
 * @param {string} sessionId - Session UUID
 * @param {string} userId    - Authenticated user ID
 */
const deleteSession = async (sessionId, userId) => {
  if (!supabase) {
    console.log(`[AI DB Mock] Deleted session: ${sessionId}`);
    return;
  }

  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', userId);          // Never delete another user's session

  if (error) {
    throw new Error(`Session deletion failed: ${error.message}`);
  }
};


module.exports = {
  startConversation,
  respondToFollowUp,
  getUserConversationHistory,
  getSessionById,
  deleteSession,
};
