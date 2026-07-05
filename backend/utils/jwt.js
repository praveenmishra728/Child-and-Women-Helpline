/**
 * jwt.js
 * JSON Web Token generation and validation helper utility.
 * Supports Access Token and Refresh Token generation.
 */

const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * Generate an Access Token (short-lived)
 * @param {object} payload - User properties ({ id, email, role })
 * @returns {string} Access Token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: '15m', // Access token expires in 15 minutes
  });
};

/**
 * Generate a Refresh Token (long-lived)
 * @param {object} payload - User properties ({ id, email })
 * @returns {string} Refresh Token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: '7d', // Refresh token expires in 7 days
  });
};

/**
 * Verify a token using secret key
 * @param {string} token - Signed token string
 * @returns {object} Decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
};
