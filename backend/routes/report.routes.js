/**
 * report.routes.js
 * Routing mappings for Incident reports APIs.
 */

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { protect } = require('../middlewares/auth.middleware');
const { incidentUploads } = require('../middlewares/upload.middleware');
const { validate } = require('../middlewares/validation');
const { createReportSchema, updateReportSchema, searchFilterSchema } = require('../validations/report.validation');

// All report routes require authentication
router.use(protect);

// 1. Fetch logged-in user's reports list
router.get('/my', reportController.getUserReports);

// 2. Advanced search filters with pagination
router.get('/search', validate(searchFilterSchema, 'query'), reportController.searchReports);

// 3. Upload evidence directly (supports image, audio, or pdf fields)
router.post('/upload', incidentUploads, reportController.uploadEvidenceOnly);

// 4. Incident timeline status flow history
router.get('/:id/timeline', reportController.getTimeline);

// 5. Create new report (with multi-evidence files support)
router.post(
  '/', 
  incidentUploads, 
  (req, res, next) => {
    // Parser wrapper to parse strings in multipart fields
    if (req.body.is_anonymous) req.body.is_anonymous = req.body.is_anonymous === 'true';
    
    if (req.body.latitude === '' || req.body.latitude === 'null' || req.body.latitude === undefined) {
      req.body.latitude = null;
    } else if (req.body.latitude) {
      req.body.latitude = parseFloat(req.body.latitude);
    }
    
    if (req.body.longitude === '' || req.body.longitude === 'null' || req.body.longitude === undefined) {
      req.body.longitude = null;
    } else if (req.body.longitude) {
      req.body.longitude = parseFloat(req.body.longitude);
    }
    next();
  },
  validate(createReportSchema), 
  reportController.createReport
);

// 6. Fetch details of a specific report
router.get('/:id', reportController.getReportById);

// 7. Update an existing report draft
router.put('/:id', validate(updateReportSchema), reportController.updateReport);

// 8. Delete draft reports
router.delete('/:id', reportController.deleteReport);

module.exports = router;
