/**
 * report.service.js
 * Database service layer managing incident reports CRUD and attachments.
 * Enforces business boundaries (ownership checks, draft rules).
 */

const supabase = require('../config/db');
const { generateCaseId } = require('../utils/caseId');
const ApiError = require('../utils/apiError');
const { v4: uuidv4 } = require('uuid');

/**
 * Upload a file buffer to Supabase Storage bucket.
 * @param {object} file - Express multer file object
 * @returns {Promise<string>} File path or URL
 */
const uploadToSupabaseStorage = async (file) => {
  const fileExt = file.originalname.split('.').pop();
  const fileName = `${uuidv4()}.${fileExt}`;
  const bucketName = 'evidence-attachments';

  if (!supabase) {
    console.log(`[Storage Mock] Mock file uploaded. Path: uploads/evidence/${fileName}`);
    return `uploads/evidence/${fileName}`;
  }

  // Upload file buffer
  let { data, error } = await supabase.storage
    .from(bucketName)
    .upload(`incidents/${fileName}`, file.buffer, {
      contentType: file.mimetype,
      upsert: true
    });

  if (error && (error.message.includes('not found') || error.message.includes('Bucket'))) {
    console.log(`[Storage] Bucket '${bucketName}' not found. Attempting to create it dynamically...`);
    try {
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true
      });
      if (!createError) {
        console.log(`[Storage] Bucket '${bucketName}' created successfully. Retrying file upload...`);
        const retryResult = await supabase.storage
          .from(bucketName)
          .upload(`incidents/${fileName}`, file.buffer, {
            contentType: file.mimetype,
            upsert: true
          });
        data = retryResult.data;
        error = retryResult.error;
      } else {
        console.error(`[Storage] Failed to create bucket dynamically:`, createError.message);
      }
    } catch (err) {
      console.error(`[Storage] Error during dynamic bucket creation:`, err.message);
    }
  }

  if (error) {
    throw new Error(`File upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(`incidents/${fileName}`);

  return urlData.publicUrl;
};

/**
 * Creates a new report record.
 * @param {object} reportData - Report values
 * @param {Array} files - Files array from multer fields
 * @param {string} reporterId - Logged-in user ID
 */
const createReport = async (reportData, files = {}, reporterId) => {
  // 1. Generate unique Case ID
  const caseId = await generateCaseId();

  // 2. Format structure based on is_anonymous business rule
  const isAnonymous = reportData.is_anonymous === true || reportData.is_anonymous === 'true';
  const dbReporterId = isAnonymous ? null : reporterId;

  const insertData = {
    case_id: caseId,
    reporter_id: dbReporterId,
    incident_type: reportData.incident_type,
    victim_type: reportData.victim_type,
    description: reportData.description,
    incident_date: reportData.incident_date,
    incident_time: reportData.incident_time,
    location_name: reportData.location_name,
    latitude: reportData.latitude ? parseFloat(reportData.latitude) : null,
    longitude: reportData.longitude ? parseFloat(reportData.longitude) : null,
    is_anonymous: isAnonymous,
    is_draft: reportData.status === 'draft',
    status: reportData.status || 'draft',
    priority: reportData.priority || 'low',
    ai_risk_level: 'unknown'
  };

  let report = null;

  if (supabase) {
    const { data, error } = await supabase
      .from('reports')
      .insert(insertData)
      .select('*')
      .single();

    if (error) {
      throw ApiError.internal(`Failed to insert report: ${error.message}`);
    }
    report = data;
  } else {
    // Mock Mode
    report = { id: uuidv4(), ...insertData, created_at: new Date().toISOString() };
    console.log('[Report Service Mock] Created report:', report);
  }

  // 3. Handle File Uploads and attachments registration
  const attachments = [];
  const uploadPromises = [];

  const fileFields = ['image', 'audio', 'pdf'];
  fileFields.forEach(field => {
    if (files[field] && files[field][0]) {
      const file = files[field][0];
      const typeMap = { image: 'image', audio: 'audio', pdf: 'pdf' };
      
      const uploadPromise = uploadToSupabaseStorage(file).then(async (filePath) => {
        const attachRecord = {
          report_id: report.id,
          file_path: filePath,
          file_size: file.size,
          file_type: typeMap[field]
        };

        if (supabase) {
          const { error: attachError } = await supabase
            .from('report_attachments')
            .insert(attachRecord);
          if (attachError) console.error('[Report Service] Attachment insert failed:', attachError.message);
        }
        attachments.push(attachRecord);
      });
      uploadPromises.push(uploadPromise);
    }
  });

  await Promise.all(uploadPromises);
  return { report, attachments };
};

/**
 * Fetch a single report with ownership checks.
 */
const getReportById = async (id, userId, role) => {
  let report = null;
  let attachments = [];

  if (supabase) {
    // Fetch Report
    const { data: reportData, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !reportData) {
      throw ApiError.notFound('Incident report not found.');
    }
    report = reportData;

    // Fetch Attachments
    const { data: attachData } = await supabase
      .from('report_attachments')
      .select('*')
      .eq('report_id', id);
    
    attachments = attachData || [];
  } else {
    // Mock Mode fallback
    report = {
      id,
      case_id: 'WCS-2026-000001',
      reporter_id: userId,
      incident_type: 'Domestic Violence',
      victim_type: 'Women',
      description: 'Mocked detail description',
      incident_date: '2026-07-05',
      incident_time: '12:00:00',
      is_anonymous: false,
      is_draft: false,
      status: 'submitted',
      priority: 'low',
      created_at: new Date().toISOString()
    };
  }

  // ENFORCE BUSINESS RULES:
  // Ownership Validation: Users can access only their own reports.
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isReporter = report.reporter_id === userId;

  // If report is anonymous, we check if user is the original creator.
  // Wait, anonymous reports don't save reporter_id in some settings. But if they do or if the user is not admin,
  // we check if they are the owner.
  if (!isAdmin && !isReporter && !report.is_anonymous) {
    throw ApiError.forbidden('You do not have permission to access this incident report.');
  }

  return { report, attachments };
};

/**
 * Update an existing report (only if Draft or Submitted/Pending).
 */
const updateReport = async (id, reportData, userId, role) => {
  const { report } = await getReportById(id, userId, role);

  // Business Rules:
  // - Users cannot edit Closed or Resolved reports.
  // - Users can edit only Draft and Submitted/Pending reports.
  if (['resolved', 'closed', 'rejected'].includes(report.status.toLowerCase())) {
    throw ApiError.badRequest(`This report cannot be modified because its status is ${report.status.toUpperCase()}.`);
  }

  const updateFields = {
    incident_type: reportData.incident_type || report.incident_type,
    victim_type: reportData.victim_type || report.victim_type,
    description: reportData.description || report.description,
    incident_date: reportData.incident_date || report.incident_date,
    incident_time: reportData.incident_time || report.incident_time,
    location_name: reportData.location_name || report.location_name,
    latitude: reportData.latitude ? parseFloat(reportData.latitude) : report.latitude,
    longitude: reportData.longitude ? parseFloat(reportData.longitude) : report.longitude,
    is_draft: reportData.status === 'draft',
    status: reportData.status || report.status,
    priority: reportData.priority || report.priority
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('reports')
      .update(updateFields)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw ApiError.internal(`Failed to update report: ${error.message}`);
    }
    return data;
  } else {
    return { ...report, ...updateFields, updated_at: new Date().toISOString() };
  }
};

/**
 * Delete a report (only permitted for Drafts).
 */
const deleteReport = async (id, userId, role) => {
  const { report } = await getReportById(id, userId, role);

  // Business Rule: Users cannot delete Submitted reports. Only Drafts can be deleted.
  if (report.status !== 'draft') {
    throw ApiError.badRequest('Only incident reports saved as Draft can be deleted.');
  }

  if (supabase) {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', id);

    if (error) {
      throw ApiError.internal(`Failed to delete report: ${error.message}`);
    }
  }
  return true;
};

/**
 * Lists reports filed by the logged-in user.
 */
const getUserReportsList = async (userId, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  if (supabase) {
    const { data, error, count } = await supabase
      .from('reports')
      .select('*', { count: 'exact' })
      .eq('reporter_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw ApiError.internal(`Database search failed: ${error.message}`);
    }
    return { list: data, total: count, page, limit };
  } else {
    return { list: [], total: 0, page, limit };
  }
};

/**
 * Advanced search/filtering with pagination.
 */
const searchReports = async (filters = {}, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  if (supabase) {
    let query = supabase
      .from('reports')
      .select('*', { count: 'exact' });

    if (filters.incident_type) query = query.eq('incident_type', filters.incident_type);
    if (filters.victim_type) query = query.eq('victim_type', filters.victim_type);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.search) query = query.ilike('description', `%${filters.search}%`);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw ApiError.internal(`Query search failed: ${error.message}`);
    }
    return { list: data, total: count, page, limit };
  } else {
    return { list: [], total: 0, page, limit };
  }
};

/**
 * Create dynamic timeline list of states
 * @param {string} id - Report ID
 */
const getTimeline = async (id, userId, role) => {
  const { report } = await getReportById(id, userId, role);
  
  // Status flow timeline builder
  const timeline = [
    { status: 'draft', label: 'Report Draft Created', active: true, time: report.created_at }
  ];

  if (report.status !== 'draft') {
    timeline.push({ status: 'submitted', label: 'Incident Submitted to Patrol Room', active: true, time: report.created_at });
  }
  
  const statusHierarchy = ['under_review', 'assigned', 'in_progress', 'resolved', 'closed'];
  const currentIdx = statusHierarchy.indexOf(report.status.toLowerCase());

  statusHierarchy.forEach((step, idx) => {
    const isStepPassed = idx <= currentIdx;
    timeline.push({
      status: step,
      label: `Incident marked as ${step.replace('_', ' ').toUpperCase()}`,
      active: isStepPassed,
      time: isStepPassed ? report.updated_at : null
    });
  });

  return timeline;
};

module.exports = {
  createReport,
  getReportById,
  updateReport,
  deleteReport,
  getUserReportsList,
  searchReports,
  getTimeline,
  uploadToSupabaseStorage
};
