/**
 * auth.validation.js
 * Joi verification schemas for user authentication.
 */

const Joi = require('joi');

const requestOtpSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .trim()
    .lowercase()
    .messages({
      'string.email': 'Please provide a valid email address.',
      'any.required': 'Email address is required.'
    })
});

const verifyOtpSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .trim()
    .lowercase(),
  otp: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      'string.length': 'OTP must be exactly 6 digits.',
      'string.pattern': 'OTP must only contain numerical digits.'
    })
});

module.exports = {
  requestOtpSchema,
  verifyOtpSchema
};
