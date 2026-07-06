/**
 * errorHandler.js
 * Centralized global error handling middleware for Express.
 * Captures, processes, and formats standard HTTP responses for operational and program errors.
 */

const ApiError = require('../utils/apiError');
const config = require('../config/config');

const errorHandler = (err, req, res, next) => {
  let error = err;

  // If the error is not an instance of ApiError, cast it
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || (error.name === 'ValidationError' || error.name === 'MulterError' ? 400 : 500);
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, false, err.stack);
  }

  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    errors: error.errors || [],
    ...(config.env === 'development' && { stack: error.stack }), // Output stack only in development mode
    timestamp: new Date().toISOString()
  };

  // Log error message internally
  console.error(`[Error Log] [${req.method}] ${req.originalUrl}:`, error.message);
  if (config.env === 'development' && error.stack) {
    console.error(error.stack);
  }

  res.status(error.statusCode).json(response);
};

module.exports = errorHandler;
