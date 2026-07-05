/**
 * auth.service.js
 * Core authentication business logic.
 * Interacts with Supabase database for user profile and OTP verifications management.
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const supabase = require('../config/db');
const { generate6DigitOtp } = require('../utils/otp');
const { sendOtpEmail } = require('./email.service');
const ApiError = require('../utils/apiError');

// In-memory fallback mock containers when Supabase url/keys are empty
const mockDb = {
  profiles: [],
  otp_verifications: [],
  refresh_tokens: []
};

/**
 * Hash a token using SHA-256 for secure storage.
 * @param {string} token - Raw refresh token
 * @returns {string} SHA-256 hash in hex format
 */
const hashTokenSha256 = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Saves a refresh token, enforcing a maximum of 3 active devices per user.
 * @param {string} userId - User UUID
 * @param {string} token - Raw refresh token
 * @param {string} deviceInfo - Description of user agent / device
 */
const saveRefreshToken = async (userId, token, deviceInfo = 'Unknown Device') => {
  const tokenHash = hashTokenSha256(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  if (supabase) {
    // 1. Check current active tokens count for the user
    const { data: activeTokens, error: countError } = await supabase
      .from('refresh_tokens')
      .select('id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!countError && activeTokens && activeTokens.length >= 3) {
      // User has reached maximum active devices (3). Remove the oldest token session(s)
      const tokensToRemove = activeTokens.slice(0, (activeTokens.length - 3) + 1);
      const idsToRemove = tokensToRemove.map(t => t.id);
      
      await supabase
        .from('refresh_tokens')
        .delete()
        .in('id', idsToRemove);
    }

    // 2. Insert new token
    await supabase.from('refresh_tokens').insert({
      user_id: userId,
      token_hash: tokenHash,
      device_info: deviceInfo,
      expires_at: expiresAt
    });
  } else {
    // Mock Mode
    const userTokens = mockDb.refresh_tokens.filter(x => x.user_id === userId);
    if (userTokens.length >= 3) {
      userTokens.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const oldest = userTokens[0];
      mockDb.refresh_tokens = mockDb.refresh_tokens.filter(x => x.token_hash !== oldest.token_hash);
    }

    mockDb.refresh_tokens.push({
      user_id: userId,
      token_hash: tokenHash,
      device_info: deviceInfo,
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    });
  }
};

/**
 * Revokes a specific refresh token (used on Logout or token theft detection).
 * @param {string} token - Raw refresh token
 */
const revokeRefreshToken = async (token) => {
  const tokenHash = hashTokenSha256(token);
  if (supabase) {
    await supabase
      .from('refresh_tokens')
      .delete()
      .eq('token_hash', tokenHash);
  } else {
    mockDb.refresh_tokens = mockDb.refresh_tokens.filter(x => x.token_hash !== tokenHash);
  }
};

/**
 * Verifies a refresh token against the database records.
 * @param {string} userId - User ID to verify against
 * @param {string} token - Raw refresh token
 * @returns {Promise<boolean>} True if valid
 */
const verifyRefreshTokenRecord = async (userId, token) => {
  const tokenHash = hashTokenSha256(token);
  let record = null;

  if (supabase) {
    const { data, error } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return false;
    record = data;
  } else {
    record = mockDb.refresh_tokens.find(x => x.token_hash === tokenHash && x.user_id === userId);
    if (!record) return false;
  }

  // Check expiration
  if (new Date() > new Date(record.expires_at)) {
    await revokeRefreshToken(token); // Auto clean up expired token
    return false;
  }

  return true;
};

/**
 * Invalidates all active sessions for a user (Login reset / security lock).
 * @param {string} userId - User UUID
 */
const invalidateUserRefreshTokens = async (userId) => {
  if (supabase) {
    await supabase
      .from('refresh_tokens')
      .delete()
      .eq('user_id', userId);
  } else {
    mockDb.refresh_tokens = mockDb.refresh_tokens.filter(x => x.user_id !== userId);
  }
};

/**
 * Fetch profiles matching the email, or create a new user profile on first login.
 * @param {string} email - User email address
 * @returns {Promise<object>} Profile record
 */
const getOrCreateProfile = async (email) => {
  if (supabase) {
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (!fetchError && existingProfile) {
      return existingProfile;
    }

    // Determine role (first/specific domain addresses can be admins, others are users)
    const isGovAdmin = email.endsWith('.gov.in') || email === 'admin@suraksha.gov.in';
    const role = isGovAdmin ? 'admin' : 'user';

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        email,
        full_name: email.split('@')[0],
        role
      })
      .select('*')
      .single();

    if (insertError) {
      throw new Error(`Profile creation failed: ${insertError.message}`);
    }

    return newProfile;
  } else {
    // Mock Mode
    let existingProfile = mockDb.profiles.find(x => x.email === email);
    if (!existingProfile) {
      existingProfile = {
        id: `mock-uuid-${Date.now()}`,
        email,
        full_name: email.split('@')[0],
        role: email.includes('admin') ? 'admin' : 'user',
        created_at: new Date().toISOString()
      };
      mockDb.profiles.push(existingProfile);
    }
    return existingProfile;
  }
};

/**
 * Fetch profile by identifier
 * @param {string} id - Profile unique id
 */
const getProfileById = async (id) => {
  if (supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  } else {
    return mockDb.profiles.find(x => x.id === id) || { id, email: 'mocked@user.com', role: 'user' };
  }
};

/**
 * Generate and store OTP, then send via Resend
 * @param {string} email - User email address
 */
const initiateOtpFlow = async (email) => {
  // If in Mock Mode (no supabase), use static OTP '123456' for ease of local testing
  const otp = (!supabase) ? '123456' : generate6DigitOtp();
  const saltRounds = 10;
  const otpHash = await bcrypt.hash(otp, saltRounds);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes validity

  // 1. Manage user registration placeholder (Ensure profile exists)
  await getOrCreateProfile(email);

  if (supabase) {
    // 2. Clear any active unverified records for this email
    await supabase
      .from('otp_verifications')
      .delete()
      .eq('email', email)
      .eq('verified', false);

    // 3. Save OTP record
    const { error } = await supabase.from('otp_verifications').insert({
      email,
      otp_hash: otpHash,
      attempts: 0,
      max_attempts: 5,
      expires_at: expiresAt,
      verified: false
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  } else {
    // Mock Mode
    mockDb.otp_verifications = mockDb.otp_verifications.filter(x => !(x.email === email && !x.verified));
    mockDb.otp_verifications.push({
      email,
      otp_hash: otpHash,
      attempts: 0,
      max_attempts: 5,
      expires_at: expiresAt,
      verified: false
    });
  }

  // 4. Dispatch Email
  await sendOtpEmail(email, otp);
  return { email };
};

/**
 * Validate incoming OTP code
 * @param {string} email - User email address
 * @param {string} rawOtp - Raw user entered 6-digit OTP code
 * @returns {Promise<object>} Authenticated user profile
 */
const verifyOtpFlow = async (email, rawOtp) => {
  let verificationRecord = null;

  if (supabase) {
    const { data, error } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('email', email)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      throw ApiError.badRequest('No active verification session found. Please request a new OTP.');
    }
    verificationRecord = data;
  } else {
    // Mock Mode search
    const records = mockDb.otp_verifications.filter(x => x.email === email && !x.verified);
    if (records.length === 0) {
      throw ApiError.badRequest('No active verification session found. Please request a new OTP.');
    }
    verificationRecord = records[records.length - 1];
  }

  // 1. Verify Expiration
  if (new Date() > new Date(verificationRecord.expires_at)) {
    throw ApiError.badRequest('OTP code has expired. Please request a new OTP.');
  }

  // 2. Check maximum attempts lock
  if (verificationRecord.attempts >= verificationRecord.max_attempts) {
    throw ApiError.badRequest('This verification session has been locked due to too many failed attempts.');
  }

  // 3. Match hashes
  const isMatch = await bcrypt.compare(rawOtp, verificationRecord.otp_hash);

  if (!isMatch) {
    // Increment attempts
    const newAttempts = verificationRecord.attempts + 1;
    if (supabase) {
      await supabase
        .from('otp_verifications')
        .update({ attempts: newAttempts })
        .eq('id', verificationRecord.id);
    } else {
      verificationRecord.attempts = newAttempts;
    }

    if (newAttempts >= verificationRecord.max_attempts) {
      throw ApiError.badRequest('Incorrect OTP. Maximum attempts exceeded. Verification session locked.');
    }
    throw ApiError.badRequest(`Incorrect OTP. You have ${verificationRecord.max_attempts - newAttempts} attempts left.`);
  }

  // 4. Invalidate and complete session
  if (supabase) {
    // Update verification table
    await supabase
      .from('otp_verifications')
      .update({ verified: true })
      .eq('id', verificationRecord.id);
      
    // Delete verified OTP right away to prevent replay attacks
    await supabase
      .from('otp_verifications')
      .delete()
      .eq('id', verificationRecord.id);
  } else {
    verificationRecord.verified = true;
    mockDb.otp_verifications = mockDb.otp_verifications.filter(x => x.email !== email);
  }

  // 5. Fetch profile details
  const profile = await getOrCreateProfile(email);
  return profile;
};

module.exports = {
  initiateOtpFlow,
  verifyOtpFlow,
  getProfileById,
  saveRefreshToken,
  revokeRefreshToken,
  verifyRefreshTokenRecord,
  invalidateUserRefreshTokens
};

