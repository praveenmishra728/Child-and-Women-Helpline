/**
 * ai.validation.js
 * Joi validation schemas for all AI Safety Assistant API endpoints.
 */

'use strict';

const Joi = require('joi');
const { MAX_USER_MESSAGE_LENGTH } = require('../services/prompts');

// ─── Schema: POST /api/v1/ai/start ────────────────────────────────────────
const startConversationSchema = Joi.object({
  /**
   * User's opening message describing their situation.
   * Minimum 5 characters to prevent empty/garbage submissions.
   * Hard cap at MAX_USER_MESSAGE_LENGTH (defined in prompts.js).
   */
  userMessage: Joi.string()
    .trim()
    .min(5)
    .max(MAX_USER_MESSAGE_LENGTH)
    .required()
    .messages({
      'string.min':  'Please provide more detail about your situation (minimum 5 characters).',
      'string.max':  `Message is too long. Maximum ${MAX_USER_MESSAGE_LENGTH} characters allowed.`,
      'any.required':'Your message is required.',
    }),

  /**
   * Client-generated UUID for grouping this conversation session.
   * Must be a valid UUID v4.
   */
  sessionId: Joi.string()
    .uuid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'sessionId must be a valid UUID v4.',
      'any.required': 'sessionId is required.',
    }),
});


// ─── Schema: POST /api/v1/ai/respond ──────────────────────────────────────
const respondSchema = Joi.object({
  /** Same session ID from Phase 1 */
  sessionId: Joi.string()
    .uuid({ version: ['uuidv4'] })
    .required(),

  /** The user's original first message (for full context in Phase 2) */
  originalMessage: Joi.string()
    .trim()
    .min(5)
    .max(MAX_USER_MESSAGE_LENGTH)
    .required()
    .messages({
      'string.min': 'Original message is too short.',
      'any.required': 'originalMessage is required.',
    }),

  /** The AI's Phase 1 follow-up question (echoed back from client) */
  followUpQuestion: Joi.string()
    .trim()
    .max(800)
    .required()
    .messages({
      'any.required': 'followUpQuestion is required.',
    }),

  /** The user's answer to the follow-up question */
  followUpAnswer: Joi.string()
    .trim()
    .min(3)
    .max(MAX_USER_MESSAGE_LENGTH)
    .required()
    .messages({
      'string.min': 'Please provide more detail in your answer (minimum 3 characters).',
      'any.required': 'followUpAnswer is required.',
    }),
});


// ─── Schema: GET /api/v1/ai/history/:id (path param) ─────────────────────
const sessionIdParamSchema = Joi.object({
  id: Joi.string()
    .uuid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'Session ID must be a valid UUID v4.',
    }),
});


module.exports = {
  startConversationSchema,
  respondSchema,
  sessionIdParamSchema,
};
