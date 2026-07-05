/**
 * apiResponse.js
 * Centralized utility class for formatting standard JSON responses.
 * Ensures consistent output schema across all API endpoints.
 */

class ApiResponse {
  /**
   * Create a standardized response structure.
   * @param {number} statusCode - HTTP status code
   * @param {any} data - Response payload
   * @param {string} message - User-friendly message
   * @param {boolean} success - Operation status
   */
  constructor(statusCode, data = null, message = 'Success', success = true) {
    this.statusCode = statusCode;
    this.success = success;
    this.message = message;
    if (data !== null) {
      this.data = data;
    }
    this.timestamp = new Date().toISOString();
  }

  /**
   * Helper for standard HTTP 200 OK
   */
  static success(res, message = 'Operation successful', data = null, statusCode = 200) {
    return res.status(statusCode).json(new ApiResponse(statusCode, data, message, true));
  }

  /**
   * Helper for standard HTTP 201 Created
   */
  static created(res, message = 'Resource created successfully', data = null) {
    return res.status(201).json(new ApiResponse(201, data, message, true));
  }
}

module.exports = ApiResponse;
