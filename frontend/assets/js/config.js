/**
 * config.js
 * Centralized configuration for the frontend.
 * All environment-specific values live here.
 */

'use strict';

const Config = {
  /** Backend API base URL. Change to production URL before deployment. */
  API_BASE: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api/v1'
    : 'https://child-and-women-helpline.onrender.com/api/v1',

  /** JWT key names in localStorage */
  ACCESS_TOKEN_KEY: 'surakshaai_access_token',
  REFRESH_TOKEN_KEY: 'surakshaai_refresh_token',
  USER_KEY: 'surakshaai_user',

  /** OTP countdown seconds */
  OTP_EXPIRY_SECONDS: 300,

  /** Supported file types */
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_DOC_TYPES: ['application/pdf'],
  ALLOWED_AUDIO_TYPES: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
  MAX_FILE_SIZE_MB: 10,

  /** Pagination default */
  DEFAULT_PAGE_SIZE: 10,

  /** Toast duration ms */
  TOAST_DURATION: 4500,

  /** App meta */
  APP_NAME: 'SurakshaAI',
  APP_TAGLINE: 'Women & Child Safety Portal',
  GOV_NAME: 'Government of India — Ministry of Women & Child Development',

  /** Helplines (static reference) */
  HELPLINES: [
    { name: 'Police', number: '112', icon: '🚔', desc: 'Emergency Police Helpline' },
    { name: 'Women Helpline', number: '181', icon: '👩', desc: 'Women in Distress' },
    { name: 'Child Helpline', number: '1098', icon: '👶', desc: 'Child Abuse & Missing' },
    { name: 'Ambulance', number: '108', icon: '🚑', desc: 'Medical Emergency' },
    { name: 'Cyber Crime', number: '1930', icon: '💻', desc: 'Online Crime Helpline' },
  ],

  /** Report status flow labels */
  STATUS_LABELS: {
    draft: { label: 'Draft', color: 'gray' },
    submitted: { label: 'Submitted', color: 'blue' },
    under_review: { label: 'Under Review', color: 'orange' },
    assigned: { label: 'Assigned', color: 'purple' },
    in_progress: { label: 'In Progress', color: 'blue' },
    resolved: { label: 'Resolved', color: 'green' },
    rejected: { label: 'Rejected', color: 'red' },
    closed: { label: 'Closed', color: 'gray' },
  },

  /** Risk level labels */
  RISK_LABELS: {
    low: { label: 'Low Risk', class: 'badge risk-low' },
    medium: { label: 'Medium', class: 'badge risk-medium' },
    high: { label: 'High Risk', class: 'badge risk-high' },
    critical: { label: 'Emergency', class: 'badge risk-emergency' },
    unknown: { label: 'Unknown', class: 'badge badge-gray' },
  },

  INCIDENT_TYPES: [
    'Domestic Violence',
    'Kidnapping',
    'Child Abuse',
    'Cyber Crime',
    'Missing Child',
    'Threat',
    'Emergency',
    'Sexual Harassment',
    'Stalking',
    'Other',
  ],

  /** Leaflet CDN (loaded dynamically) */
  LEAFLET_CSS: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  LEAFLET_JS: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
};

// Freeze to prevent accidental mutation
Object.freeze(Config);
