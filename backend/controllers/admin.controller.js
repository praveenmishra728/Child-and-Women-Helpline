/**
 * admin.controller.js
 * HTTP handlers for the Admin Panel.
 *
 * Delegates ALL database and business logic to admin.service.js.
 * Only handles: reading request data, calling service, returning ApiResponse.
 */

'use strict';

const adminService = require('../services/admin.service');
const ApiResponse  = require('../utils/apiResponse');

// ─── Helper: extract admin's admin_users.id from req.user ────────────────────
// req.user carries the profile ID from JWT. The audit log needs the admin_users
// row ID. We resolve it lazily here; if the profile has no admin_users row
// (shouldn't happen given authorization), we fall back to the profile ID.
const resolveAdminId = async (profileId) => {
  const supabase = require('../config/db');
  if (!supabase) return profileId;

  const { data } = await supabase
    .from('admin_users')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();

  return data?.id ?? profileId;
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// GET /api/v1/admin/dashboard
// ─────────────────────────────────────────────────────────────────────────────

const getDashboard = async (req, res, next) => {
  try {
    const stats = await adminService.getDashboardStats();
    return ApiResponse.success(res, 'Dashboard statistics retrieved.', stats);
  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// REPORT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/reports
const listReports = async (req, res, next) => {
  try {
    const { page, limit, ...filters } = req.query;
    const result = await adminService.listAllReports(
      filters,
      parseInt(page) || 1,
      parseInt(limit) || 20
    );
    return ApiResponse.success(res, 'Reports retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
};


// GET /api/v1/admin/reports/:id
const getReportDetail = async (req, res, next) => {
  try {
    const result = await adminService.getAdminReportDetail(req.params.id);
    return ApiResponse.success(res, 'Report details retrieved.', result);
  } catch (error) {
    next(error);
  }
};


// PUT /api/v1/admin/reports/:id/status
const updateStatus = async (req, res, next) => {
  try {
    const adminId = await resolveAdminId(req.user.id);
    const updated = await adminService.updateReportStatus({
      reportId:  req.params.id,
      status:    req.body.status,
      note:      req.body.note,
      adminId,
      ipAddress: req.ip,
    });
    return ApiResponse.success(res, `Report status updated to "${req.body.status}".`, updated);
  } catch (error) {
    next(error);
  }
};


// PUT /api/v1/admin/reports/:id/priority
const updatePriority = async (req, res, next) => {
  try {
    const adminId = await resolveAdminId(req.user.id);
    const updated = await adminService.updateReportPriority({
      reportId:  req.params.id,
      priority:  req.body.priority,
      adminId,
      ipAddress: req.ip,
    });
    return ApiResponse.success(res, `Report priority updated to "${req.body.priority}".`, updated);
  } catch (error) {
    next(error);
  }
};


// PUT /api/v1/admin/reports/:id/assign
const assignReport = async (req, res, next) => {
  try {
    const adminId = await resolveAdminId(req.user.id);
    const updated = await adminService.assignReport({
      reportId:    req.params.id,
      adminUserId: req.body.admin_user_id,
      note:        req.body.note,
      adminId,
      ipAddress:   req.ip,
    });
    return ApiResponse.success(res, 'Report assigned successfully.', updated);
  } catch (error) {
    next(error);
  }
};


// DELETE /api/v1/admin/reports/:id
const deleteReport = async (req, res, next) => {
  try {
    const adminId = await resolveAdminId(req.user.id);
    await adminService.deleteReport({
      reportId:  req.params.id,
      adminId,
      ipAddress: req.ip,
    });
    return ApiResponse.success(res, 'Report permanently deleted.');
  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/users
const listUsers = async (req, res, next) => {
  try {
    const { page, limit, ...filters } = req.query;
    const result = await adminService.listUsers(
      filters,
      parseInt(page) || 1,
      parseInt(limit) || 20
    );
    return ApiResponse.success(res, 'Users retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
};


// PUT /api/v1/admin/users/:id/status
const updateUserStatus = async (req, res, next) => {
  try {
    const adminId = await resolveAdminId(req.user.id);
    const result = await adminService.updateUserStatus({
      userId:    req.params.id,
      active:    req.body.active,
      reason:    req.body.reason,
      adminId,
      ipAddress: req.ip,
    });
    const msg = req.body.active ? 'User account activated.' : 'User account deactivated.';
    return ApiResponse.success(res, msg, result);
  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// GET /api/v1/admin/analytics
// ─────────────────────────────────────────────────────────────────────────────

const getAnalytics = async (req, res, next) => {
  try {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month) : null;

    const data = await adminService.getAnalytics(year, month);
    return ApiResponse.success(res, 'Analytics data compiled.', data);
  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// POST /api/v1/admin/notifications
// ─────────────────────────────────────────────────────────────────────────────

const sendNotification = async (req, res, next) => {
  try {
    const adminId = await resolveAdminId(req.user.id);
    const result  = await adminService.sendNotification({
      ...req.body,
      userIds:   req.body.user_ids,
      adminId,
      ipAddress: req.ip,
    });
    return ApiResponse.success(
      res,
      `Notification sent to ${result.sent} recipient(s).`,
      result
    );
  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOGS
// GET /api/v1/admin/audit-logs
// ─────────────────────────────────────────────────────────────────────────────

const getAuditLogs = async (req, res, next) => {
  try {
    const { page, limit, ...filters } = req.query;
    const result = await adminService.getAuditLogs(
      filters,
      parseInt(page) || 1,
      parseInt(limit) || 20
    );
    return ApiResponse.success(res, 'Audit logs retrieved.', result);
  } catch (error) {
    next(error);
  }
};


module.exports = {
  getDashboard,
  listReports,
  getReportDetail,
  updateStatus,
  updatePriority,
  assignReport,
  deleteReport,
  listUsers,
  updateUserStatus,
  getAnalytics,
  sendNotification,
  getAuditLogs,
};
