/**
 * report.controller.js
 * Controller layer managing REST operations for incident reports.
 * Triggers activity audits and coordinates with DB service layer.
 */

const reportService = require('../services/report.service');
const supabase = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

/**
 * Log actions to activity_logs for security compliance
 */
const logActivity = async (userId, action, req) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    
    if (supabase) {
      await supabase.from('activity_logs').insert({
        user_id: userId,
        action,
        ip_address: ip,
        user_agent: ua
      });
    } else {
      console.log(`[Activity Log Mock] User: ${userId}, Action: "${action}", IP: ${ip}`);
    }
  } catch (err) {
    console.error('[Activity Audit Error] Failed to write log:', err.message);
  }
};

/**
 * File a new report (Draft or Submit)
 * POST /api/v1/reports
 */
const createReport = async (req, res, next) => {
  try {
    const reportData = req.body;
    const files = req.files || {};
    const userId = req.user.id;

    const result = await reportService.createReport(reportData, files, userId);
    
    // Log creation activity
    const auditMsg = reportData.status === 'draft' 
      ? `Report Draft Created (Case ID: ${result.report.case_id})` 
      : `Incident Report Submitted (Case ID: ${result.report.case_id})`;
    await logActivity(userId, auditMsg, req);

    return ApiResponse.created(res, 'Incident report successfully processed', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch reports filed by the logged-in user
 * GET /api/v1/reports/my
 */
const getUserReports = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await reportService.getUserReportsList(userId, page, limit);
    return ApiResponse.success(res, 'User reports retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch specific report details
 * GET /api/v1/reports/:id
 */
const getReportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const result = await reportService.getReportById(id, userId, role);
    return ApiResponse.success(res, 'Report details retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Update report details (Draft or Submitted/Pending only)
 * PUT /api/v1/reports/:id
 */
const updateReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reportData = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    const updatedReport = await reportService.updateReport(id, reportData, userId, role);
    await logActivity(userId, `Report Updated (Case ID: ${updatedReport.case_id})`, req);

    return ApiResponse.success(res, 'Incident report updated successfully', updatedReport);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete draft reports
 * DELETE /api/v1/reports/:id
 */
const deleteReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    // Fetch details to get Case ID for logging before deletion
    const { report } = await reportService.getReportById(id, userId, role);
    
    await reportService.deleteReport(id, userId, role);
    await logActivity(userId, `Report Deleted (Case ID: ${report.case_id})`, req);

    return ApiResponse.success(res, 'Draft report deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Advanced search/filtering with pagination
 * GET /api/v1/reports/search
 */
const searchReports = async (req, res, next) => {
  try {
    const filters = {
      incident_type: req.query.incident_type,
      victim_type: req.query.victim_type,
      status: req.query.status,
      priority: req.query.priority,
      search: req.query.search
    };
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await reportService.searchReports(filters, page, limit);
    return ApiResponse.success(res, 'Reports search completed successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch status timeline history
 * GET /api/v1/reports/:id/timeline
 */
const getTimeline = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const timeline = await reportService.getTimeline(id, userId, role);
    return ApiResponse.success(res, 'Timeline details fetched successfully', timeline);
  } catch (error) {
    next(error);
  }
};

/**
 * Direct file upload endpoint (allows async attachments upload)
 * POST /api/v1/reports/upload
 */
const uploadEvidenceOnly = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const files = req.files || {};
    
    let uploadedUrl = null;
    let fieldUsed = null;

    if (req.file) {
      uploadedUrl = await reportService.uploadToSupabaseStorage(req.file);
      fieldUsed = 'file';
    } else {
      const keys = Object.keys(files);
      if (keys.length > 0 && files[keys[0]][0]) {
        uploadedUrl = await reportService.uploadToSupabaseStorage(files[keys[0]][0]);
        fieldUsed = keys[0];
      }
    }

    if (!uploadedUrl) {
      throw ApiError.badRequest('No file uploaded or file field key is invalid.');
    }

    await logActivity(userId, `Evidence Attachment Uploaded via direct endpoint (${fieldUsed})`, req);

    return ApiResponse.success(res, 'File uploaded successfully', { url: uploadedUrl });
  } catch (error) {
    next(error);
  }
};

const getPublicStats = async (req, res, next) => {
  try {
    let reportsCount = 0;
    let resolvedCount = 0;
    let usersCount = 0;

    if (supabase) {
      const { count: repCount } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('is_draft', false);
      reportsCount = repCount || 0;

      const { count: resCount } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'resolved');
      resolvedCount = resCount || 0;

      const { count: uCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'user');
      usersCount = uCount || 0;
    } else {
      reportsCount = 128;
      resolvedCount = 45;
      usersCount = 92;
    }

    return ApiResponse.success(res, 'Public statistics retrieved.', {
      reports: reportsCount,
      resolved: resolvedCount,
      users: usersCount,
      states: 28
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReport,
  getUserReports,
  getReportById,
  updateReport,
  deleteReport,
  searchReports,
  getTimeline,
  uploadEvidenceOnly,
  getPublicStats
};
