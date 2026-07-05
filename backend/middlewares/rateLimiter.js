/**
 * rateLimiter.js
 * Rate-limiting middleware to protect routes from abuse or DDoS attacks.
 */

const rateLimit = require('express-rate-limit');
const ApiError = require('../utils/apiError');

// General API request limiter (100 requests per 15 minutes)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, 
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next) => {
    next(new ApiError(429, 'Too many requests from this IP, please try again after 15 minutes'));
  }
});

// Stricter request limiter for OTP auth endpoints (30 requests per 10 minutes)
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new ApiError(429, 'Too many authentication attempts, please try again after 10 minutes'));
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
};
