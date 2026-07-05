/**
 * auth.routes.js
 * Routing mappings for Authentication APIs.
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authLimiter } = require('../middlewares/rateLimiter');
const { validate } = require('../middlewares/validation');
const { protect } = require('../middlewares/auth.middleware');
const { requestOtpSchema, verifyOtpSchema } = require('../validations/auth.validation');

// Send OTP
router.post('/send-otp', authLimiter, validate(requestOtpSchema), authController.requestOtp);

// Verify OTP
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), authController.verifyOtp);

// Refresh Access Token
router.post('/refresh-token', authController.refreshAccessToken);

// Log out user
router.post('/logout', authController.logout);

// Fetch current user details (protected)
router.get('/me', protect, authController.getMe);

module.exports = router;
