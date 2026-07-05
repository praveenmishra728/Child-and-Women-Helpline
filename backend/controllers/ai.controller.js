/**
 * ai.controller.js
 * HTTP request handlers for the AI Safety Assistant.
 *
 * This controller ONLY handles HTTP concerns:
 *   — Read request data
 *   — Delegate to ai.service.js
 *   — Return standardized ApiResponse
 *
 * It NEVER calls OpenAI directly.
 */

'use strict';

const aiService  = require('../services/ai.service');
const ApiResponse = require('../utils/apiResponse');
const ApiError    = require('../utils/apiError');


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/ai/start
// Phase 1: Accept user's initial message → return one follow-up question
// ─────────────────────────────────────────────────────────────────────────────

const startConversation = async (req, res, next) => {
  try {
    const { userMessage, sessionId } = req.body;

    // req.user is set by protect middleware (null for anonymous allowed here)
    const userId = req.user?.id ?? null;

    const result = await aiService.startConversation({
      userMessage,
      sessionId,
      userId,
    });

    return ApiResponse.success(
      res,
      'AI analysis started. Please answer the follow-up question.',
      result
    );
  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/ai/respond
// Phase 2: Accept follow-up answer → return full safety report
// ─────────────────────────────────────────────────────────────────────────────

const respondToFollowUp = async (req, res, next) => {
  try {
    const { sessionId, originalMessage, followUpQuestion, followUpAnswer } = req.body;
    const userId = req.user?.id ?? null;

    const result = await aiService.respondToFollowUp({
      sessionId,
      originalMessage,
      followUpQuestion,
      followUpAnswer,
      userId,
    });

    // If an emergency was detected, add a prominent flag to the HTTP response headers
    // so the frontend can immediately show the emergency banner.
    if (result.emergencyDetected) {
      res.setHeader('X-Emergency-Detected', 'true');
    }

    return ApiResponse.success(
      res,
      'Safety assessment complete.',
      result
    );
  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/ai/history
// Returns all conversation sessions for the authenticated user
// ─────────────────────────────────────────────────────────────────────────────

const getHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const sessions = await aiService.getUserConversationHistory(userId);

    return ApiResponse.success(
      res,
      'Conversation history retrieved successfully.',
      { sessions, count: sessions.length }
    );
  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/ai/history/:id
// Returns all turns in a single session (ownership enforced in service)
// ─────────────────────────────────────────────────────────────────────────────

const getSessionById = async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const userId    = req.user.id;

    const turns = await aiService.getSessionById(sessionId, userId);

    return ApiResponse.success(
      res,
      'Session details retrieved successfully.',
      { sessionId, turns }
    );
  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/ai/history/:id
// Deletes an entire conversation session (ownership enforced)
// ─────────────────────────────────────────────────────────────────────────────

const deleteSession = async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const userId    = req.user.id;

    await aiService.deleteSession(sessionId, userId);

    return ApiResponse.success(
      res,
      'Conversation session deleted successfully.'
    );
  } catch (error) {
    next(error);
  }
};


module.exports = {
  startConversation,
  respondToFollowUp,
  getHistory,
  getSessionById,
  deleteSession,
};
