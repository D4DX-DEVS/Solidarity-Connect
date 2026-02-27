import express from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { authenticate, requireRole } from '../middleware/auth.js';
import path from 'path';
import crypto from 'crypto';

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

// Build DO Spaces S3 client from env vars
const getS3Client = () => {
  return new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: 'us-east-1', // DO Spaces uses us-east-1 in the SDK even though the region is set via endpoint
    credentials: {
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET
    },
    forcePathStyle: false
  });
};

// @route   POST /api/uploads
// @desc    Upload a file to DigitalOcean Spaces
// @access  Private (Any authenticated admin user)
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const s3 = getS3Client();
    const bucket = process.env.DO_SPACES_BUCKET;
    const folder = process.env.DO_SPACES_FOLDER || 'announcements';
    const cdnEndpoint = process.env.DO_SPACES_CDN_ENDPOINT;

    // Generate a unique filename
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(req.file.originalname);
    const key = `${folder}/${uniqueId}${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read'
    });

    await s3.send(command);

    // Build CDN URL
    const cdnBase = cdnEndpoint
      ? cdnEndpoint.replace(/\/$/, '')
      : `https://${bucket}.${process.env.DO_SPACES_ENDPOINT?.replace('https://', '')}`;

    const fileUrl = `${cdnBase}/${key}`;

    res.status(200).json({
      success: true,
      data: {
        url: fileUrl,
        originalName: req.file.originalname,
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
