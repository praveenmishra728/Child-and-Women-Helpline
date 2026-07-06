/**
 * admin.service.js
 * Service layer for all Admin Panel database operations.
 *
 * Responsibilities:
 *   — Dashboard statistics aggregation
 *   — Report management (list, update status/priority/assign, delete)
 *   — User management (list, activate/deactivate)
 *   — Analytics (grouped counts by status, type, risk, month, location)
 *   — Notification broadcasting
 *   — Audit log writing and retrieval
 *
 * NEVER contains HTTP logic — that belongs in admin.controller.js.
 */

'use strict';

const supabase = require('../config/db');
const ApiError = require('../utils/apiError');


// ─────────────────────────────────────────────────────────────────────────────
// HELPER — Write an audit log entry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Records an admin action to the audit_logs table.
 * Never throws — audit failures must not break the parent operation.
 *
 * @param {object} p
 * @param {string} p.adminId      - Admin user UUID from admin_users table
 * @param {string} p.action       - Short action label (e.g. 'STATUS_CHANGE')
 * @param {string} p.targetTable  - Table that was modified
 * @param {string} [p.targetRowId]- UUID of the row that was modified
 * @param {object} [p.oldValues]  - Previous state
 * @param {object} [p.newValues]  - New state
 * @param {string} [p.ipAddress]  - Requester IP
 */
const writeAuditLog = async ({
  adminId, action, targetTable, targetRowId,
  oldValues, newValues, ipAddress,
}) => {
  try {
    if (!supabase) {
      console.log(`[Audit Mock] ${action} on ${targetTable} row ${targetRowId}`);
      return;
    }
    await supabase.from('audit_logs').insert({
      admin_id:      adminId,
      action,
      target_table:  targetTable,
      target_row_id: targetRowId,
      old_values:    oldValues  ? JSON.stringify(oldValues)  : null,
      new_values:    newValues  ? JSON.stringify(newValues)  : null,
      ip_address:    ipAddress,
    });
  } catch (err) {
    console.error('[Audit Service] Failed to write audit log:', err.message);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD — Aggregated statistics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all dashboard KPI counts in a single batched query set.
 * @returns {Promise<object>} Dashboard stats object
 */
const getDashboardStats = async () => {
  if (!supabase) {
    // Return mock data for development without live DB
    return {
      totalUsers: 42,
      totalReports: 128,
      byStatus: {
        draft: 10, submitted: 30, under_review: 25,
        assigned: 18, in_progress: 15, resolved: 20, rejected: 5, closed: 5,
      },
      highRisk: 12,
      emergency: 4,
      aiConversations: 56,
      recentActivities: [],
    };
  }

  // Run all count queries in parallel for performance
  const [
    usersResult,
    reportsResult,
    highRiskResult,
    emergencyResult,
    aiConvResult,
    draftResult,
    submittedResult,
    underReviewResult,
    assignedResult,
    inProgressResult,
    resolvedResult,
    rejectedResult,
    closedResult,
    recentActivityResult,
  ] = await Promise.all([
    // Total users
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    // Total reports
    supabase.from('reports').select('id', { count: 'exact', head: true }),
    // High risk
    supabase.from('reports').select('id', { count: 'exact', head: true })
      .in('ai_risk_level', ['high', 'critical']),
    // Emergency (critical risk or emergency-level)
    supabase.from('reports').select('id', { count: 'exact', head: true })
      .eq('ai_risk_level', 'critical'),
    // AI conversations
    supabase.from('ai_conversations').select('id', { count: 'exact', head: true }),
    // Per-status counts
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'under_review'),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'assigned'),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'closed'),
    // Recent activity logs (last 10)
    supabase.from('activity_logs')
      .select('action, user_id, ip_address, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return {
    totalUsers:      usersResult.count       ?? 0,
    totalReports:    reportsResult.count     ?? 0,
    highRisk:        highRiskResult.count    ?? 0,
    emergency:       emergencyResult.count   ?? 0,
    aiConversations: aiConvResult.count      ?? 0,
    byStatus: {
      draft:        draftResult.count        ?? 0,
      submitted:    submittedResult.count    ?? 0,
      under_review: underReviewResult.count  ?? 0,
      assigned:     assignedResult.count     ?? 0,
      in_progress:  inProgressResult.count   ?? 0,
      resolved:     resolvedResult.count     ?? 0,
      rejected:     rejectedResult.count     ?? 0,
      closed:       closedResult.count       ?? 0,
    },
    recentActivities: recentActivityResult.data ?? [],
  };
};


// ─────────────────────────────────────────────────────────────────────────────
// REPORT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists all reports with search, filter, sort and pagination.
 */
const listAllReports = async (filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;

  if (!supabase) {
    return { list: [], total: 0, page, limit };
  }

  let query = supabase
    .from('reports')
    .select('*, reporter:reporter_id(email, full_name), assignee:assigned_to(id)', { count: 'exact' });

  // Dynamic filters
  if (filters.status)        query = query.eq('status', filters.status);
  if (filters.priority)      query = query.eq('priority', filters.priority);
  if (filters.incident_type) query = query.eq('incident_type', filters.incident_type);
  if (filters.victim_type)   query = query.eq('victim_type', filters.victim_type);
  if (filters.risk_level)    query = query.eq('ai_risk_level', filters.risk_level);
  if (filters.is_anonymous !== undefined) {
    query = query.eq('is_anonymous', filters.is_anonymous);
  }
  if (filters.date_from)     query = query.gte('created_at', `${filters.date_from}T00:00:00Z`);
  if (filters.date_to)       query = query.lte('created_at', `${filters.date_to}T23:59:59Z`);
  if (filters.search) {
    query = query.or(
      `description.ilike.%${filters.search}%,case_id.ilike.%${filters.search}%,location_name.ilike.%${filters.search}%`
    );
  }

  // Sorting
  const sortBy    = filters.sort_by    || 'created_at';
  const ascending = filters.sort_order === 'asc';
  query = query.order(sortBy, { ascending });

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    throw ApiError.internal(`Report listing failed: ${error.message}`);
  }

  return { list: data ?? [], total: count ?? 0, page, limit };
};


/**
 * Fetches full details of a single report including attachments and AI conversations.
 */
const getAdminReportDetail = async (reportId) => {
  if (!supabase) {
    return { report: { id: reportId }, attachments: [], aiConversations: [] };
  }

  const [reportRes, attachRes, aiRes] = await Promise.all([
    supabase.from('reports').select('*, reporter:reporter_id(email, full_name)').eq('id', reportId).maybeSingle(),
    supabase.from('report_attachments').select('*').eq('report_id', reportId),
    // Get AI conversations tied to any session for this report (if linked in future)
    // For now we return empty unless we have a direct link
    Promise.resolve({ data: [] }),
  ]);

  if (reportRes.error || !reportRes.data) {
    throw ApiError.notFound('Report not found.');
  }

  return {
    report:          reportRes.data,
    attachments:     attachRes.data   ?? [],
    aiConversations: aiRes.data       ?? [],
  };
};


/**
 * Updates the status of a report and records the change in audit_logs.
 */
const updateReportStatus = async ({ reportId, status, note, adminId, ipAddress }) => {
  const current = await getAdminReportDetail(reportId);

  const extraFields = {};
  if (status === 'resolved') extraFields.resolved_at = new Date().toISOString();
  if (status === 'closed')   extraFields.closed_at   = new Date().toISOString();

  let updated = current.report;

  if (supabase) {
    const { data, error } = await supabase
      .from('reports')
      .update({ status, ...extraFields })
      .eq('id', reportId)
      .select('*')
      .single();

    if (error) throw ApiError.internal(`Status update failed: ${error.message}`);
    updated = data;
  }

  await writeAuditLog({
    adminId,
    action: 'STATUS_CHANGE',
    targetTable: 'reports',
    targetRowId: reportId,
    oldValues: { status: current.report.status },
    newValues: { status, note },
    ipAddress,
  });

  return updated;
};


/**
 * Updates the priority of a report.
 */
const updateReportPriority = async ({ reportId, priority, adminId, ipAddress }) => {
  const current = await getAdminReportDetail(reportId);

  let updated = current.report;

  if (supabase) {
    const { data, error } = await supabase
      .from('reports')
      .update({ priority })
      .eq('id', reportId)
      .select('*')
      .single();

    if (error) throw ApiError.internal(`Priority update failed: ${error.message}`);
    updated = data;
  }

  await writeAuditLog({
    adminId,
    action: 'PRIORITY_CHANGE',
    targetTable: 'reports',
    targetRowId: reportId,
    oldValues: { priority: current.report.priority },
    newValues: { priority },
    ipAddress,
  });

  return updated;
};


/**
 * Assigns a report to an admin user.
 */
const assignReport = async ({ reportId, adminUserId, note, adminId, ipAddress }) => {
  // Verify target admin user exists
  if (supabase) {
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', adminUserId)
      .maybeSingle();

    if (error || !adminUser) {
      throw ApiError.badRequest('Target admin user ID not found in admin_users table.');
    }
  }

  let updated = { id: reportId };

  if (supabase) {
    const { data, error } = await supabase
      .from('reports')
      .update({ assigned_to: adminUserId, status: 'assigned' })
      .eq('id', reportId)
      .select('*')
      .single();

    if (error) throw ApiError.internal(`Assignment failed: ${error.message}`);
    updated = data;
  }

  await writeAuditLog({
    adminId,
    action: 'REPORT_ASSIGNED',
    targetTable: 'reports',
    targetRowId: reportId,
    newValues: { assigned_to: adminUserId, note },
    ipAddress,
  });

  return updated;
};


/**
 * Hard-deletes a report (fake/spam removal). Cascades to report_attachments.
 */
const deleteReport = async ({ reportId, adminId, ipAddress }) => {
  const { report } = await getAdminReportDetail(reportId);

  if (supabase) {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', reportId);

    if (error) throw ApiError.internal(`Delete failed: ${error.message}`);
  }

  await writeAuditLog({
    adminId,
    action: 'REPORT_DELETED',
    targetTable: 'reports',
    targetRowId: reportId,
    oldValues: { case_id: report.case_id, status: report.status },
    ipAddress,
  });

  return true;
};


// ─────────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists all registered users with optional search and role filter.
 */
const listUsers = async (filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;

  if (!supabase) {
    return { list: [], total: 0, page, limit };
  }

  let query = supabase
    .from('profiles')
    .select('id, email, full_name, phone, gender, role, created_at, updated_at', { count: 'exact' });

  if (filters.role)   query = query.eq('role', filters.role);
  if (filters.search) {
    query = query.or(`email.ilike.%${filters.search}%,full_name.ilike.%${filters.search}%`);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw ApiError.internal(`User listing failed: ${error.message}`);

  return { list: data ?? [], total: count ?? 0, page, limit };
};


/**
 * Activate or deactivate a user by toggling their role.
 * Deactivated users are downgraded to a special 'deactivated_user' pattern.
 * Since we don't have an `active` boolean in schema, we handle this
 * via a JSON metadata field stored in system_settings or by soft-deleting.
 *
 * Implementation: We store deactivated user IDs in system_settings as JSON.
 */
const updateUserStatus = async ({ userId, active, reason, adminId, ipAddress }) => {
  const { data: profile, error } = supabase
    ? await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    : { data: { id: userId, email: 'mock@user.com' }, error: null };

  if (error || !profile) {
    throw ApiError.notFound('User profile not found.');
  }

  // Store deactivation state in system_settings as a JSON array
  const settingKey = 'deactivated_user_ids';
  let deactivatedIds = [];

  if (supabase) {
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', settingKey)
      .maybeSingle();

    if (setting?.value) {
      try { deactivatedIds = JSON.parse(setting.value); } catch { deactivatedIds = []; }
    }

    if (!active) {
      if (!deactivatedIds.includes(userId)) deactivatedIds.push(userId);
    } else {
      deactivatedIds = deactivatedIds.filter((id) => id !== userId);
    }

    await supabase.from('system_settings').upsert({
      key: settingKey,
      value: JSON.stringify(deactivatedIds),
      description: 'IDs of deactivated user accounts',
    });
  }

  await writeAuditLog({
    adminId,
    action: active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    targetTable: 'profiles',
    targetRowId: userId,
    newValues: { active, reason },
    ipAddress,
  });

  return { userId, active, email: profile.email };
};


// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns grouped analytics data for dashboard charts.
 * @param {number} year  - Filter by year
 * @param {number|null} month - Optional month filter
 */
const getAnalytics = async (year, month = null) => {
  if (!supabase) {
    return {
      byStatus:         {},
      byIncidentType:   {},
      byRiskLevel:      {},
      byMonth:          {},
      byVictimType:     {},
      userRegistrations: {},
    };
  }

  const startDate = month
    ? `${year}-${String(month).padStart(2, '0')}-01`
    : `${year}-01-01`;
  const endDate = month
    ? new Date(year, month, 0).toISOString().split('T')[0]   // last day of month
    : `${year}-12-31`;

  // Fetch all reports in the time window (lean select for aggregation)
  const { data: reports, error } = await supabase
    .from('reports')
    .select('status, incident_type, victim_type, ai_risk_level, created_at')
    .gte('created_at', `${startDate}T00:00:00Z`)
    .lte('created_at', `${endDate}T23:59:59Z`);

  if (error) throw ApiError.internal(`Analytics query failed: ${error.message}`);

  // Fetch user registrations in same window
  const { data: users } = await supabase
    .from('profiles')
    .select('created_at')
    .gte('created_at', `${startDate}T00:00:00Z`)
    .lte('created_at', `${endDate}T23:59:59Z`);

  // Aggregate in-memory (avoids complex SQL GROUP BY across multiple dimensions)
  const aggregate = (arr, key) =>
    (arr || []).reduce((acc, row) => {
      const val = row[key] || 'unknown';
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});

  const byMonth = (arr) =>
    (arr || []).reduce((acc, row) => {
      const m = new Date(row.created_at).getMonth() + 1;
      const label = `${year}-${String(m).padStart(2, '0')}`;
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

  return {
    byStatus:           aggregate(reports, 'status'),
    byIncidentType:     aggregate(reports, 'incident_type'),
    byRiskLevel:        aggregate(reports, 'ai_risk_level'),
    byVictimType:       aggregate(reports, 'victim_type'),
    byMonth:            byMonth(reports),
    userRegistrations:  byMonth(users),
    totalInPeriod:      (reports || []).length,
  };
};


// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Broadcasts a notification to target users.
 * Supports three targeting strategies: 'all', 'role', 'users'.
 */
const sendNotification = async ({
  title, message, type, target, role, userIds, adminId, ipAddress,
}) => {
  let recipientIds = [];

  if (!supabase) {
    console.log(`[Notification Mock] "${title}" → target: ${target}`);
    return { sent: 0, target };
  }

  // Resolve recipient IDs based on target strategy
  if (target === 'all') {
    const { data } = await supabase.from('profiles').select('id');
    recipientIds = (data || []).map((u) => u.id);
  } else if (target === 'role') {
    const { data } = await supabase.from('profiles').select('id').eq('role', role);
    recipientIds = (data || []).map((u) => u.id);
  } else if (target === 'users') {
    recipientIds = userIds || [];
  }

  if (recipientIds.length === 0) {
    throw ApiError.badRequest('No recipients found for the specified target.');
  }

  // Batch insert notification rows
  const rows = recipientIds.map((userId) => ({
    user_id: userId,
    title,
    message,
    type,
    is_read: false,
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) throw ApiError.internal(`Notification send failed: ${error.message}`);

  await writeAuditLog({
    adminId,
    action: 'NOTIFICATION_SENT',
    targetTable: 'notifications',
    newValues: { title, type, target, recipientCount: recipientIds.length },
    ipAddress,
  });

  return { sent: recipientIds.length, target };
};


// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns audit log entries with optional filters.
 */
const getAuditLogs = async (filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;

  if (!supabase) {
    return { list: [], total: 0, page, limit };
  }

  let query = supabase
    .from('audit_logs')
    .select('*, admin:admin_id(profile_id)', { count: 'exact' });

  if (filters.admin_id)  query = query.eq('admin_id', filters.admin_id);
  if (filters.action)    query = query.ilike('action', `%${filters.action}%`);
  if (filters.date_from) query = query.gte('created_at', `${filters.date_from}T00:00:00Z`);
  if (filters.date_to)   query = query.lte('created_at', `${filters.date_to}T23:59:59Z`);

  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw ApiError.internal(`Audit log fetch failed: ${error.message}`);

  return { list: data ?? [], total: count ?? 0, page, limit };
};


module.exports = {
  getDashboardStats,
  listAllReports,
  getAdminReportDetail,
  updateReportStatus,
  updateReportPriority,
  assignReport,
  deleteReport,
  listUsers,
  updateUserStatus,
  getAnalytics,
  sendNotification,
  getAuditLogs,
  writeAuditLog,
};
