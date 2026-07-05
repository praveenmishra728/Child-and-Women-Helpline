/**
 * report.validation.js
 * Joi verification schemas for incident report ingestion.
 */

const Joi = require('joi');

const createReportSchema = Joi.object({
  incident_type: Joi.string()
    .required()
    .valid(
      'Domestic Violence',
      'Kidnapping',
      'Child Abuse',
      'Cyber Crime',
      'Missing Child',
      'Threat',
      'Emergency',
      'Sexual Harassment',
      'Stalking',
      'Other'
    ),
  victim_type: Joi.string()
    .required()
    .valid('Women', 'Child', 'Other'),
  priority: Joi.string()
    .valid('low', 'medium', 'high', 'critical')
    .default('low'),
  description: Joi.string()
    .min(10)
    .max(5000)
    .required()
    .messages({
      'string.min': 'Description must be at least 10 characters long.',
      'string.max': 'Description cannot exceed 5000 characters.'
    }),
  incident_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/) // YYYY-MM-DD
    .required()
    .messages({
      'string.pattern': 'Incident date must be in YYYY-MM-DD format.'
    }),
  incident_time: Joi.string()
    .pattern(/^\d{2}:\d{2}(:\d{2})?$/) // HH:MM or HH:MM:SS
    .required()
    .messages({
      'string.pattern': 'Incident time must be in HH:MM or HH:MM:SS format.'
    }),
  location_name: Joi.string().max(255).allow('', null),
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
  is_anonymous: Joi.boolean().default(false),
  status: Joi.string().valid('draft', 'submitted').default('submitted')
});

const updateReportSchema = Joi.object({
  incident_type: Joi.string().valid(
    'Domestic Violence',
    'Kidnapping',
    'Child Abuse',
    'Cyber Crime',
    'Missing Child',
    'Threat',
    'Emergency',
    'Sexual Harassment',
    'Stalking',
    'Other'
  ),
  victim_type: Joi.string().valid('Women', 'Child', 'Other'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  description: Joi.string().min(10).max(5000),
  incident_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  incident_time: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/),
  location_name: Joi.string().max(255).allow('', null),
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
  is_anonymous: Joi.boolean(),
  status: Joi.string().valid('draft', 'submitted')
});

const searchFilterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  incident_type: Joi.string(),
  victim_type: Joi.string(),
  status: Joi.string(),
  priority: Joi.string(),
  search: Joi.string().allow('', null)
});

module.exports = {
  createReportSchema,
  updateReportSchema,
  searchFilterSchema
};
