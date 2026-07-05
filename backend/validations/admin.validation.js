/**
 * admin.validation.js
 * Joi validation schemas for all Admin Panel API endpoints.
 */

'use strict';

const Joi = require('joi');

// ─── Valid enum values (must stay in sync with schema.sql) ───────────────────

const VALID_STATUSES = [
  'draft', 'submitted', 'under_review', 'assigned',
  'in_progress', 'resolved', 'rejected', 'closed',
];

const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

const VALID_ROLES = ['user', 'admin', 'super_admin'];

const VALID_NOTIFICATION_TYPES = ['alert', 'report_update', 'system_message'];

// ─── Report Management ────────────────────────────────────────────────────────

/**
 * Query params for GET /admin/reports (search, filter, sort, paginate)
 */
const listReportsSchema = Joi.object({
  page:          Joi.number().integer().min(1).default(1),
  limit:         Joi.number().integer().min(1).max(100).default(20),
  search:        Joi.string().max(200).allow('', null),
  status:        Joi.string().valid(...VALID_STATUSES),
  priority:      Joi.string().valid(...VALID_PRIORITIES),
  incident_type: Joi.string().max(100),
  victim_type:   Joi.string().valid('Women', 'Child', 'Other'),
  risk_level:    Joi.string().valid('low', 'medium', 'high', 'critical', 'unknown'),
  is_anonymous:  Joi.boolean(),
  date_from:     Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  date_to:       Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  sort_by:       Joi.string().valid('created_at', 'updated_at', 'priority', 'status').default('created_at'),
  sort_order:    Joi.string().valid('asc', 'desc').default('desc'),
});

/**
 * Body for PUT /admin/reports/:id/status
 */
const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...VALID_STATUSES)
    .required()
    .messages({ 'any.required': 'Status is required.' }),
  note: Joi.string().max(1000).allow('', null), // optional internal note
});

/**
 * Body for PUT /admin/reports/:id/priority
 */
const updatePrioritySchema = Joi.object({
  priority: Joi.string()
    .valid(...VALID_PRIORITIES)
    .required()
    .messages({ 'any.required': 'Priority is required.' }),
});

/**
 * Body for PUT /admin/reports/:id/assign
 */
const assignReportSchema = Joi.object({
  admin_user_id: Joi.string()
    .uuid({ version: ['uuidv4'] })
    .required()
    .messages({ 'any.required': 'admin_user_id is required.' }),
  note: Joi.string().max(500).allow('', null),
});

// ─── User Management ──────────────────────────────────────────────────────────

/**
 * Query params for GET /admin/users
 */
const listUsersSchema = Joi.object({
  page:   Joi.number().integer().min(1).default(1),
  limit:  Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(200).allow('', null),
  role:   Joi.string().valid(...VALID_ROLES),
});

/**
 * Body for PUT /admin/users/:id/status
 */
const updateUserStatusSchema = Joi.object({
  active: Joi.boolean()
    .required()
    .messages({ 'any.required': '"active" boolean is required.' }),
  reason: Joi.string().max(500).allow('', null),
});

// ─── Notifications ────────────────────────────────────────────────────────────

/**
 * Body for POST /admin/notifications
 */
const sendNotificationSchema = Joi.object({
  title:   Joi.string().trim().min(3).max(150).required(),
  message: Joi.string().trim().min(5).max(1000).required(),
  type:    Joi.string().valid(...VALID_NOTIFICATION_TYPES).default('alert'),
  /**
   * Target recipients — three strategies:
   *   target: 'all'         — broadcast to every user
   *   target: 'role'        — target a specific role
   *   target: 'users'       — target specific user IDs (user_ids required)
   */
  target:   Joi.string().valid('all', 'role', 'users').required(),
  role:     Joi.when('target', {
    is: 'role',
    then: Joi.string().valid(...VALID_ROLES).required(),
    otherwise: Joi.forbidden(),
  }),
  user_ids: Joi.when('target', {
    is: 'users',
    then: Joi.array().items(Joi.string().uuid()).min(1).required(),
    otherwise: Joi.forbidden(),
  }),
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

const listAuditLogsSchema = Joi.object({
  page:       Joi.number().integer().min(1).default(1),
  limit:      Joi.number().integer().min(1).max(100).default(20),
  admin_id:   Joi.string().uuid(),
  action:     Joi.string().max(100),
  date_from:  Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  date_to:    Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
});

// ─── Analytics ────────────────────────────────────────────────────────────────

const analyticsQuerySchema = Joi.object({
  year:  Joi.number().integer().min(2020).max(2100).default(new Date().getFullYear()),
  month: Joi.number().integer().min(1).max(12).allow(null),
});

module.exports = {
  listReportsSchema,
  updateStatusSchema,
  updatePrioritySchema,
  assignReportSchema,
  listUsersSchema,
  updateUserStatusSchema,
  sendNotificationSchema,
  listAuditLogsSchema,
  analyticsQuerySchema,
};
