/**
 * user.service.js
 * Service layer managing user profile database operations.
 */

const supabase = require('../config/db');
const authService = require('./auth.service');

const getUserProfile = async (userId) => {
  return authService.getProfileById(userId);
};

const updateProfile = async (userId, updateData) => {
  const allowedData = {
    full_name: updateData.full_name,
    phone: updateData.phone,
    gender: updateData.gender
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .update(allowedData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Profile update failed: ${error.message}`);
    }
    return data;
  } else {
    const profile = await authService.getProfileById(userId);
    if (!profile) throw new Error('Profile not found');
    Object.assign(profile, allowedData);
    return profile;
  }
};

const deleteAccount = async (userId) => {
  if (supabase) {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) {
      throw new Error(`Account deletion failed: ${error.message}`);
    }
  } else {
    // Mock deletion
    const profile = await authService.getProfileById(userId);
    if (profile) {
      profile.deleted = true;
    }
  }
};

module.exports = {
  getUserProfile,
  updateProfile,
  deleteAccount
};
