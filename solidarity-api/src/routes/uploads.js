import express from 'express';
import multer from 'multer';
import { putObject, publicUrlFor } from '../services/storage.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import path from 'path';
import crypto from 'crypto';
import { decodeUploadName } from '../utils/fileName.js';

const router = express.Router();

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'video/mp4', 'video/mpeg',
      'audio/mpeg', 'audio/wav'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  }
});

// @route   POST /api/uploads
// @desc    Upload a file to DigitalOcean Spaces
// @access  Private (State, District, or Group Admin only)
router.post('/', authenticate, requireRole(['state_admin', 'district_admin', 'group_admin']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const folder = process.env.DO_SPACES_FOLDER || 'announcements';

    // Generate a unique filename
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(req.file.originalname);
    const key = `${folder}/${uniqueId}${ext}`;

    await putObject(key, req.file.buffer, req.file.mimetype);

    const fileUrl = publicUrlFor(key);

    res.status(200).json({
      success: true,
      data: {
        url: fileUrl,
        originalName: decodeUploadName(req.file.originalname),
        mimetype: req.file.mimetype,
        size: req.file.size,
        key
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload file' });
  }
});

export default router;
