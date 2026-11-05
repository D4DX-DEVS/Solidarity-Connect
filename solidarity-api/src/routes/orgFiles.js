import express from 'express';
import multer from 'multer';
import { putObject, deleteObject, publicUrlFor } from '../services/storage.js';
import OrgFile from '../models/OrgFile.js';
import { authenticate, requireRole, isAreaLevelAdmin } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import path from 'path';
import crypto from 'crypto';
import { decodeUploadName } from '../utils/fileName.js';

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

// Helper: is this user an area-level admin? (area proper, or murabi/coordinator —
// identical permissions by design; see middleware/auth.js)
const isAreaAdmin = (user) => isAreaLevelAdmin(user);

// @route   POST /api/org-files
// @desc    Upload and register an organizational file
// @access  State Admin only
router.post('/', authenticate, requireRole('state_admin'), upload.single('file'), [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required'),
  body('category').isIn(['constitution', 'guidelines', 'video', 'audio', 'document', 'link', 'other']).withMessage('Invalid category'),
  body('fileType').optional().isIn(['general', 'membership_form']).withMessage('Invalid file type'),
  body('link').optional({ values: 'falsy' }).isURL().withMessage('Invalid URL format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const isLinkCategory = req.body.category === 'link';

    // Link category requires a link, not a file
    if (isLinkCategory) {
      if (!req.body.link) {
        return res.status(400).json({ success: false, message: 'Link URL is required for link category' });
      }

      const orgFile = new OrgFile({
        title: req.body.title,
        description: req.body.description,
        category: req.body.category,
        fileType: req.body.fileType || 'general',
        link: req.body.link,
        uploadedBy: req.user._id
      });

      await orgFile.save();
      await orgFile.populate('uploadedBy', 'name role');

      return res.status(201).json({ success: true, message: 'Link added successfully', data: orgFile });
    }

    // Non-link categories require a file
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const folder = 'org-files';

    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(req.file.originalname);
    const key = `${folder}/${uniqueId}${ext}`;

    await putObject(key, req.file.buffer, req.file.mimetype);

    const fileUrl = publicUrlFor(key);

    const orgFile = new OrgFile({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      fileType: req.body.fileType || 'general',
      link: req.body.link || undefined,
      url: fileUrl,
      filename: key,
      originalName: decodeUploadName(req.file.originalname),
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
    const { category, fileType, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const isStateAdmin = req.user.role === 'state_admin';
    // Visible to state_admin and all group_admin users (area admins and local group admins)
    const canSeeMembershipForm = isStateAdmin || req.user.role === 'group_admin';

    // Role-based visibility filter — drives the summary metric cards (library-wide totals)
    const baseFilter = {};
    if (!isStateAdmin) baseFilter.isActive = true; // only state admin sees hidden files
    if (!canSeeMembershipForm) baseFilter.fileType = 'general';

    // List filter = visibility + category/type/search
    const filter = { ...baseFilter };
    if (category) filter.category = category;
    if (fileType && canSeeMembershipForm) filter.fileType = fileType;

    // Text search on title, description, originalName
    if (search && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { originalName: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const [files, total, summaryTotal, membershipForms, hidden] = await Promise.all([
      OrgFile.find(filter)
        .populate('uploadedBy', 'name role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      OrgFile.countDocuments(filter),
      OrgFile.countDocuments(baseFilter),
      canSeeMembershipForm
        ? OrgFile.countDocuments({ ...baseFilter, fileType: 'membership_form' })
        : Promise.resolve(0),
      isStateAdmin ? OrgFile.countDocuments({ isActive: false }) : Promise.resolve(0)
    ]);

    res.status(200).json({
      success: true,
      data: files,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      summary: { total: summaryTotal, membershipForms, hidden }
    });
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
  body('category').optional().isIn(['constitution', 'guidelines', 'video', 'audio', 'document', 'link', 'other']).withMessage('Invalid category'),
  body('fileType').optional().isIn(['general', 'membership_form']).withMessage('Invalid file type'),
  body('link').optional({ values: 'falsy' }).isURL().withMessage('Invalid URL format')
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

    const { title, description, category, fileType, isActive, link } = req.body;
    if (title !== undefined) orgFile.title = title;
    if (description !== undefined) orgFile.description = description;
    if (category !== undefined) orgFile.category = category;
    if (fileType !== undefined) orgFile.fileType = fileType;
    if (isActive !== undefined) orgFile.isActive = isActive;
    if (link !== undefined) orgFile.link = link;
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
      if (orgFile.filename) await deleteObject(orgFile.filename);
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
