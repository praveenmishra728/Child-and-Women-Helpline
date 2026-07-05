/**
 * ai.routes.js
 * HTTP routing for the AI Safety Assistant module.
 *
 * Route authentication strategy:
 *   — /start and /respond: use optionalProtect so both
 *     authenticated users and anonymous visitors can use the assistant.
 *   — /history routes: require full authentication (protect).
 */

'use strict';

const express    = require('express');
const router     = express.Router();

const aiController = require('../controllers/ai.controller');
const { protect }  = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validation');
const { apiLimiter } = require('../middlewares/rateLimiter');
const {
  startConversationSchema,
  respondSchema,
  sessionIdParamSchema,
} = require('../validations/ai.validation');

// ─────────────────────────────────────────────────────────────────────────────
// Optional protect middleware — injects req.user if token present, but does
// NOT reject anonymous requests (so anyone can use the safety assistant).
// ─────────────────────────────────────────────────────────────────────────────
const optionalProtect = (req, res, next) => {
  const { verifyToken } = require('../utils/jwt');

  let token = null;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      req.user = null; // Invalid token → anonymous mode
    }
  } else {
    req.user = null;
  }

  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// Apply tighter rate limiting to all AI routes (prevents abuse / cost overruns)
// Overrides the global apiLimiter with a stricter per-user limit:
// 30 AI requests per 10 minutes.
// ─────────────────────────────────────────────────────────────────────────────
const { rateLimit } = require('express-rate-limit');
const aiRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many AI requests. Please wait 10 minutes before trying again.',
  },
});

router.use(aiRateLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — Start conversation (anonymous OR authenticated)
// POST /api/v1/ai/start
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/start',
  optionalProtect,
  validate(startConversationSchema),
  aiController.startConversation
);

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — Submit follow-up answer (anonymous OR authenticated)
// POST /api/v1/ai/respond
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/respond',
  optionalProtect,
  validate(respondSchema),
  aiController.respondToFollowUp
);

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY — Requires full authentication
// GET /api/v1/ai/history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/history', protect, aiController.getHistory);

// ─────────────────────────────────────────────────────────────────────────────
// SESSION DETAIL — GET /api/v1/ai/history/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/history/:id',
  protect,
  validate(sessionIdParamSchema, 'params'),
  aiController.getSessionById
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE SESSION — DELETE /api/v1/ai/history/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  '/history/:id',
  protect,
  validate(sessionIdParamSchema, 'params'),
  aiController.deleteSession
);


module.exports = router;
