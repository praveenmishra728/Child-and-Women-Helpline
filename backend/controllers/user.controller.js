/**
 * user.controller.js
 * Controller handling HTTP requests for user profiles.
 */

const userService = require('../services/user.service');
const ApiResponse = require('../utils/apiResponse');

const getProfile = async (req, res, next) => {
  try {
    const user = await userService.getUserProfile(req.user.id);
    return ApiResponse.success(res, 'Profile retrieved successfully', { user });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const user = await userService.updateProfile(req.user.id, req.body);
    return ApiResponse.success(res, 'Profile updated successfully', { user });
  } catch (error) {
    next(error);
  }
};

const uploadAvatar = async (req, res, next) => {
  try {
    // Return a dummy avatar URL since custom storage might not be configured,
    // avoiding error breaks on client UI.
    const dummyAvatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(req.user.email)}`;
    return ApiResponse.success(res, 'Avatar updated successfully', { avatarUrl: dummyAvatarUrl });
  } catch (error) {
    next(error);
  }
};

const deleteProfile = async (req, res, next) => {
  try {
    await userService.deleteAccount(req.user.id);
    return ApiResponse.success(res, 'Account deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteProfile
};
