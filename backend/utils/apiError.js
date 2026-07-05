/**
 * apiError.js
 * Centralized custom error class extending native Error.
 * Captures status code, operational error indicators, and details.
 */

class ApiError extends Error {
  /**
   * Create a standardized API operational error.
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error description
   * @param {Array} errors - Detailed errors (e.g. input validation details)
   * @param {string} stack - Error stack trace
   */
  constructor(statusCode, message = 'An error occurred', errors = [], stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.success = false;
    this.errors = errors;
    this.isOperational = true; // Distinguishes programmatic bugs from known exceptions

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Pre-configured common operational errors
  static badRequest(message, errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Unauthorized access') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden action') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Requested resource not found') {
    return new ApiError(404, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
