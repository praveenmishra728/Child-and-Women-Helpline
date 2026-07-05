/**
 * otp.js
 * Cryptographically secure OTP generation utility.
 */

const crypto = require('crypto');

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 * @returns {string} 6-digit numeric string
 */
const generate6DigitOtp = () => {
  // Generate random bytes and map to numeric range to avoid bias
  const val = crypto.randomInt(100000, 999999);
  return val.toString();
};

module.exports = {
  generate6DigitOtp,
};
