import express from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import OrgFile from '../models/OrgFile.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import path from 'path';
import crypto from 'crypto';

const router = express.Router();

// Multer in-memory storage (same as uploads.js)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB for videos
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'video/mp4', 'video/mpeg', 'video/quicktime',
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  }
});

const getS3Client = () => new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET
  },
  forcePathStyle: false
});

// Helper: is this user an area admin?
const isAreaAdmin = (user) => {
  return user.role === 'group_admin' && user.roleTag?.type === 'area';
};

// @route   POST /api/org-files
// @desc    Upload and register an organizational file
// @access  State Admin only
router.post('/', authenticate, requireRole('state_admin'), upload.single('file'), [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required'),
  body('category').isIn(['constitution', 'guidelines', 'video', 'audio', 'document', 'other']).withMessage('Invalid category'),
  body('fileType').optional().isIn(['general', 'membership_form']).withMessage('Invalid file type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const s3 = getS3Client();
    const bucket = process.env.DO_SPACES_BUCKET;
    const folder = 'org-files';
    const cdnEndpoint = process.env.DO_SPACES_CDN_ENDPOINT;

    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(req.file.originalname);
    const key = `${folder}/${uniqueId}${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read'
    }));

    const cdnBase = cdnEndpoint
      ? cdnEndpoint.replace(/\/$/, '')
      : `https://${bucket}.${process.env.DO_SPACES_ENDPOINT?.replace('https://', '')}`;

    const fileUrl = `${cdnBase}/${key}`;

    const orgFile = new OrgFile({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      fileType: req.body.fileType || 'general',
      url: fileUrl,
      filename: key,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user._id
    });

    await orgFile.save();
    await orgFile.populate('uploadedBy', 'name role');

    res.status(201).json({ success: true, message: 'File uploaded successfully', data: orgFile });
  } catch (error) {
    console.error('OrgFile upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload file' });
  }
});

// @route   GET /api/org-files
// @desc    Get all org files (membership_form visible to group_admin and state_admin)
// @access  All authenticated users
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, fileType } = req.query;

    let filter = { isActive: true };

    // Restrict membership_form visibility
    // Visible to state_admin and all group_admin users (area admins and local group admins)
    const canSeeMembershipForm =
      req.user.role === 'state_admin' || req.user.role === 'group_admin';

    if (!canSeeMembershipForm) {
      filter.fileType = 'general';
    }

    if (category) filter.category = category;
    if (fileType && canSeeMembershipForm) filter.fileType = fileType;

    const files = await OrgFile.find(filter)
      .populate('uploadedBy', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: files });
  } catch (error) {
    console.error('Get org files error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch files' });
  }
});

// @route   PUT /api/org-files/:id
// @desc    Update org file metadata
// @access  State Admin only
router.put('/:id', authenticate, requireRole('state_admin'), [
  body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
  body('category').optional().isIn(['constitution', 'guidelines', 'video', 'audio', 'document', 'other']).withMessage('Invalid category'),
  body('fileType').optional().isIn(['general', 'membership_form']).withMessage('Invalid file type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const orgFile = await OrgFile.findById(req.params.id);
    if (!orgFile) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const { title, description, category, fileType, isActive } = req.body;
    if (title !== undefined) orgFile.title = title;
    if (description !== undefined) orgFile.description = description;
    if (category !== undefined) orgFile.category = category;
    if (fileType !== undefined) orgFile.fileType = fileType;
    if (isActive !== undefined) orgFile.isActive = isActive;
    orgFile.updatedBy = req.user._id;

    await orgFile.save();
    await orgFile.populate('uploadedBy', 'name role');

    res.status(200).json({ success: true, message: 'File updated successfully', data: orgFile });
  } catch (error) {
    console.error('Update org file error:', error);
    res.status(500).json({ success: false, message: 'Failed to update file' });
  }
});

// @route   DELETE /api/org-files/:id
// @desc    Delete an org file (removes from S3 and DB)
// @access  State Admin only
router.delete('/:id', authenticate, requireRole('state_admin'), async (req, res) => {
  try {
    const orgFile = await OrgFile.findById(req.params.id);
    if (!orgFile) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    // Attempt to delete from S3 (non-fatal if it fails)
    try {
      const s3 = getS3Client();
      await s3.send(new DeleteObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: orgFile.filename
      }));
    } catch (s3Err) {
      console.warn('S3 delete warning:', s3Err.message);
    }

    await OrgFile.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete org file error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete file' });
  }
});

export default router;
