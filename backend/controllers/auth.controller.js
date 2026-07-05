/**
 * auth.controller.js
 * Authentication API controllers.
 */

const authService = require('../services/auth.service');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/jwt');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

/**
 * Send OTP verification code to user email
 * POST /api/v1/auth/send-otp
 */
const requestOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    await authService.initiateOtpFlow(email);
    return ApiResponse.success(res, `Secure 6-digit OTP code sent to ${email}. Check spam folder if not received.`, { email });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify OTP code and issue JWT security tokens
 * POST /api/v1/auth/verify-otp
 */
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const profile = await authService.verifyOtpFlow(email, otp);

    // 1. Invalidate older refresh token sessions for this user on new clean login
    await authService.invalidateUserRefreshTokens(profile.id);

    // 2. Generate JWT access and refresh token keys
    const accessToken = generateAccessToken({ id: profile.id, email: profile.email, role: profile.role });
    const refreshToken = generateRefreshToken({ id: profile.id, email: profile.email });

    // 3. Save hashed refresh token to database, enforcing maximum 3 active devices limit
    await authService.saveRefreshToken(
      profile.id, 
      refreshToken, 
      req.headers['user-agent'] || 'Web Client'
    );

    // Store Access Token in secure HTTPOnly cookie
    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    // Store Refresh Token in secure HTTPOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return ApiResponse.success(res, 'Authentication successful', {
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role
      },
      token: accessToken,
      refreshToken: refreshToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Rotate access tokens using the refresh token
 * POST /api/v1/auth/refresh-token
 */
const refreshAccessToken = async (req, res, next) => {
  try {
    let refreshToken = null;

    if (req.cookies && req.cookies.refreshToken) {
      refreshToken = req.cookies.refreshToken;
    } else if (req.body && req.body.refreshToken) {
      refreshToken = req.body.refreshToken;
    }

    if (!refreshToken) {
      throw ApiError.unauthorized('No session refresh token key provided.');
    }

    try {
      const decoded = verifyToken(refreshToken);
      const profile = await authService.getProfileById(decoded.id);

      if (!profile) {
        throw ApiError.unauthorized('User profile associated with token does not exist.');
      }

      // Verify the hashed refresh token exists in database records
      const isTokenValid = await authService.verifyRefreshTokenRecord(decoded.id, refreshToken);
      if (!isTokenValid) {
        throw ApiError.unauthorized('Refresh token is invalid or has been revoked.');
      }

      // Create new Access Token
      const newAccessToken = generateAccessToken({ id: profile.id, email: profile.email, role: profile.role });

      // Save new access token to cookie
      res.cookie('token', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000
      });

      return ApiResponse.success(res, 'Token updated successfully', {
        token: newAccessToken
      });
    } catch (err) {
      throw ApiError.unauthorized('Invalid or expired refresh session. Please login again.');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Logout session and erase cookie registers
 * POST /api/v1/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies ? req.cookies.refreshToken : null;
    
    // Revoke and delete the refresh token from database if present
    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }

    res.clearCookie('token');
    res.clearCookie('refreshToken');
    return ApiResponse.success(res, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve details for the logged-in identity session
 * GET /api/v1/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    // req.user has been set by authentication parsing middleware
    const profile = await authService.getProfileById(req.user.id);
    
    if (!profile) {
      throw ApiError.notFound('Profile record not found.');
    }

    return ApiResponse.success(res, 'User session details fetched successfully', {
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        phone: profile.phone,
        gender: profile.gender
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestOtp,
  verifyOtp,
  refreshAccessToken,
  logout,
  getMe
};
