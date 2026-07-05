/**
 * validation.js
 * Request body and parameter validation middleware using Joi schemas.
 * Sanitizes input and validates types.
 */

const ApiError = require('../utils/apiError');

/**
 * Validate incoming request body or query against Joi schemas
 * @param {object} schema - Joi validation schema object
 * @param {string} source - Field to validate ('body', 'query', 'params')
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = req[source];
    
    if (!dataToValidate) {
      return next(ApiError.badRequest('No data provided for validation'));
    }

    const { value, error } = schema.validate(dataToValidate, {
      abortEarly: false, // Include all errors, not just the first one
      stripUnknown: true, // Remove unknown fields not present in schema
      errors: {
        wrap: {
          label: '', // Clean up field name encapsulation in error messages
        }
      }
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return next(ApiError.badRequest('Validation Failed', errorDetails));
    }

    // Overwrite with validated and sanitized values
    req[source] = value;
    next();
  };
};

module.exports = {
  validate,
};
