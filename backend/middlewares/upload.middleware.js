/**
 * upload.middleware.js
 * Multi-file upload parser using Multer.
 * Supports image, audio, and PDF document uploads with file limits and mime validations.
 */

const multer = require('multer');
const ApiError = require('../utils/apiError');

// Use memory storage to process files before sending them to Supabase Storage
const storage = multer.memoryStorage();

// Allowed file types helper
const ALLOWED_MIME_TYPES = {
  // Images
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  
  // Audios
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/m4a': 'audio',
  'audio/webm': 'audio',

  // PDF
  'application/pdf': 'pdf'
};

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        `Invalid file type: ${file.mimetype}. Only JPEG, JPG, PNG, WEBP, MP3, WAV, M4A, OGG, WEBM, and PDF are allowed.`
      ),
      false
    );
  }
};

// Multer upload config
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // Max 10MB per file
  }
});

// Helper configuration to receive specific fields: 'image', 'audio', 'pdf'
const incidentUploads = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
  { name: 'pdf', maxCount: 1 }
]);

module.exports = {
  upload,
  incidentUploads
};
