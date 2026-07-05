/**
 * admin.routes.js
 * Routing for the Admin Panel.
 *
 * Authorization:
 *   ALL routes require:
 *     1. Valid JWT (protect middleware)
 *     2. role === 'admin' OR role === 'super_admin' (authorize middleware)
 *
 * Any user without an admin role receives 403 Forbidden — no information leak.
 */

'use strict';

const express    = require('express');
const router     = express.Router();

const adminController = require('../controllers/admin.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { validate }           = require('../middlewares/validation');
const { apiLimiter }         = require('../middlewares/rateLimiter');
const {
  listReportsSchema,
  updateStatusSchema,
  updatePrioritySchema,
  assignReportSchema,
  listUsersSchema,
  updateUserStatusSchema,
  sendNotificationSchema,
  listAuditLogsSchema,
  analyticsQuerySchema,
} = require('../validations/admin.validation');

// ─── Apply authentication and role guard to every admin route ─────────────────
router.use(protect, authorize('admin', 'super_admin'));

// ─── Also apply a reasonable rate limit (100 req / 15 min already on /api) ────
// Admin endpoints are inherently lower-traffic; default global limiter is fine.

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', adminController.getDashboard);

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/reports',
  validate(listReportsSchema, 'query'),
  adminController.listReports
);

router.get('/reports/:id', adminController.getReportDetail);

router.put(
  '/reports/:id/status',
  validate(updateStatusSchema),
  adminController.updateStatus
);

router.put(
  '/reports/:id/priority',
  validate(updatePrioritySchema),
  adminController.updatePriority
);

router.put(
  '/reports/:id/assign',
  validate(assignReportSchema),
  adminController.assignReport
);

router.delete('/reports/:id', adminController.deleteReport);

// ─────────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/users',
  validate(listUsersSchema, 'query'),
  adminController.listUsers
);

router.put(
  '/users/:id/status',
  validate(updateUserStatusSchema),
  adminController.updateUserStatus
);

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/analytics',
  validate(analyticsQuerySchema, 'query'),
  adminController.getAnalytics
);

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/notifications',
  validate(sendNotificationSchema),
  adminController.sendNotification
);

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/audit-logs',
  validate(listAuditLogsSchema, 'query'),
  adminController.getAuditLogs
);


module.exports = router;
