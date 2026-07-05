/**
 * auth.middleware.js
 * Express middleware to verify JWT token.
 * Validates request authorization header and session cookies.
 */

const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/apiError');

/**
 * Protect route with JWT verification
 */
const protect = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // 2. Fallback to cookies if cookie-parser is configured
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw ApiError.unauthorized('Please authenticate to access this resource');
    }

    try {
      // Decode and verify token
      const decoded = verifyToken(token);
      
      // Inject decoded user details (e.g. { id, email, role }) into request object
      req.user = decoded;
      next();
    } catch (err) {
      throw ApiError.unauthorized('Invalid or expired authentication token');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Limit route access by roles
 * @param {...string} roles - Approved role values, e.g. 'admin', 'user'
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
};

module.exports = {
  protect,
  authorize,
};
