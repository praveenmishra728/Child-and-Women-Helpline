/**
 * user.routes.js
 * Routing definitions for user profile APIs.
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');

// Protect all profile endpoints
router.use(protect);

router.route('/me')
  .get(userController.getProfile)
  .put(userController.updateProfile)
  .delete(userController.deleteProfile);

router.post('/me/avatar', userController.uploadAvatar);

module.exports = router;
