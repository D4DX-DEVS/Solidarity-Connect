import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import Member from '../models/Member.js';
import Group from '../models/Group.js';
import District from '../models/District.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/bulk-import';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `bulk-import-${uniqueSuffix}.csv`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// @route   POST /api/bulk-import/members
// @desc    Bulk import members from CSV
// @access  Private
router.post('/members', 
  authenticate, 
  authorize(['bulk_import']),
  upload.single('csvFile'),
  [
    body('district').isMongoId().withMessage('Invalid district ID'),
    body('group').isMongoId().withMessage('Invalid group ID'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'CSV file is required'
        });
      }

      const { district: districtId, group: groupId } = req.body;

      // Validate district and group
      const district = await District.findById(districtId);
      const group = await Group.findById(groupId);

      if (!district || !group) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Invalid district or group ID'
        });
      }

      // Ensure group belongs to district
      if (group.district.toString() !== district._id.toString()) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Group does not belong to the specified district'
        });
      }

      // Check user permissions
      if (req.user.role === 'group_admin') {
        if (groupId !== req.user.group._id.toString()) {
          fs.unlinkSync(req.file.path);
          return res.status(403).json({
            success: false,
            message: 'You can only import members to your assigned group'
          });
        }
      } else if (req.user.role === 'district_admin') {
        if (districtId !== req.user.district._id.toString()) {
          fs.unlinkSync(req.file.path);
          return res.status(403).json({
            success: false,
            message: 'You can only import members to your assigned district'
          });
        }
      }

      // Process CSV file
      const results = await processMemberCSV(req.file.path, districtId, groupId, req.user._id);

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.status(200).json({
        success: true,
        message: 'Bulk import completed',
        data: results
      });

    } catch (error) {
      // Clean up uploaded file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.error('Bulk import error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to process bulk import'
      });
    }
  }
);

// @route   GET /api/bulk-import/template
// @desc    Download CSV template for bulk import
// @access  Private
router.get('/template', authenticate, authorize(['bulk_import']), (req, res) => {
  try {
    const csvTemplate = `Name,Phone Number,Email,Date of Birth,Blood Group,Profession,Education,Status
John Doe,+919876543210,john@example.com,1990-01-15,A+,Engineer,Masters,Inactive
Jane Smith,+919876543211,jane@example.com,1995-05-20,B+,Teacher,Bachelors,Inactive`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="members-import-template.csv"');
    res.send(csvTemplate);

  } catch (error) {
    console.error('Download template error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download template'
    });
  }
});

// @route   GET /api/bulk-import/history
// @desc    Get bulk import history
// @access  Private
router.get('/history', authenticate, authorize(['bulk_import']), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    let filter = {};

    // Apply role-based filtering
    if (req.user.role === 'group_admin') {
      filter.group = req.user.group._id;
    } else if (req.user.role === 'district_admin') {
      filter.district = req.user.district._id;
    }

    // Get recent bulk imports (members created by bulk import)
    const recentImports = await Member.aggregate([
      { 
        $match: { 
          ...filter,
          createdBy: req.user._id,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        } 
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            district: '$district',
            group: '$group'
          },
          count: { $sum: 1 },
          members: { $push: { name: '$name', phone: '$phone', status: '$status' } },
          importDate: { $first: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'districts',
          localField: '_id.district',
          foreignField: '_id',
          as: 'districtInfo'
        }
      },
      {
        $lookup: {
          from: 'groups',
          localField: '_id.group',
          foreignField: '_id',
          as: 'groupInfo'
        }
      },
      {
        $project: {
          date: '$_id.date',
          count: 1,
          members: 1,
          importDate: 1,
          district: { $arrayElemAt: ['$districtInfo.name', 0] },
          group: { $arrayElemAt: ['$groupInfo.name', 0] }
        }
      },
      { $sort: { importDate: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    ]);

    res.status(200).json({
      success: true,
      data: recentImports,
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get import history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch import history'
    });
  }
});

// @route   POST /api/bulk-import/validate
// @desc    Validate CSV file before import
// @access  Private
router.post('/validate', 
  authenticate, 
  authorize(['bulk_import']),
  upload.single('csvFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'CSV file is required'
        });
      }

      // Validate CSV structure and data
      const validation = await validateMemberCSV(req.file.path);

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.status(200).json({
        success: true,
        message: 'CSV validation completed',
        data: validation
      });

    } catch (error) {
      // Clean up uploaded file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.error('CSV validation error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to validate CSV file'
      });
    }
  }
);

// Helper function to process member CSV
async function processMemberCSV(filePath, districtId, groupId, createdBy) {
  return new Promise((resolve, reject) => {
    const results = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: [],
      duplicates: [],
      created: []
    };

    const members = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        results.total++;
        
        // Clean and validate row data
        const memberData = {
          name: row['Name']?.trim(),
          phone: row['Phone Number']?.trim(),
          email: row['Email']?.trim() || undefined,
          dateOfBirth: row['Date of Birth']?.trim() ? new Date(row['Date of Birth'].trim()) : undefined,
          bloodGroup: row['Blood Group']?.trim() || undefined,
          profession: row['Profession']?.trim() || undefined,
          education: row['Education']?.trim() || undefined,
          status: row['Status']?.trim() || 'Applicant',
          district: districtId,
          group: groupId,
          createdBy,
          isApproved: false // Bulk imported members need approval
        };

        // Basic validation
        if (!memberData.name || !memberData.phone) {
          results.errors.push({
            row: results.total,
            error: 'Name and Phone Number are required',
            data: row
          });
          results.failed++;
          return;
        }

        // Validate phone number format
        if (!/^\+91[6-9]\d{9}$/.test(memberData.phone)) {
          results.errors.push({
            row: results.total,
            error: 'Invalid phone number format. Use +91XXXXXXXXXX',
            data: row
          });
          results.failed++;
          return;
        }

        // Validate email if provided
        if (memberData.email && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(memberData.email)) {
          results.errors.push({
            row: results.total,
            error: 'Invalid email format',
            data: row
          });
          results.failed++;
          return;
        }

        // Validate status
        const validStatuses = ['Active', 'Inactive', 'Abroad', 'Applicant', 'Age over', 'Dismissed'];
        if (!validStatuses.includes(memberData.status)) {
          memberData.status = 'Inactive'; // Default to Inactive
        }

        // Validate blood group
        const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        if (memberData.bloodGroup && !validBloodGroups.includes(memberData.bloodGroup)) {
          memberData.bloodGroup = undefined;
        }

        members.push(memberData);
      })
      .on('end', async () => {
        try {
          // Check for duplicates within the CSV
          const phoneNumbers = members.map(m => m.phone);
          const duplicatePhones = phoneNumbers.filter((phone, index) => phoneNumbers.indexOf(phone) !== index);
          
          if (duplicatePhones.length > 0) {
            duplicatePhones.forEach(phone => {
              results.duplicates.push({
                phone,
                error: 'Duplicate phone number in CSV'
              });
            });
          }

          // Check for existing members in database
          const existingMembers = await Member.find({
            phone: { $in: phoneNumbers }
          }).select('phone name');

          existingMembers.forEach(existing => {
            results.duplicates.push({
              phone: existing.phone,
              name: existing.name,
              error: 'Member with this phone number already exists'
            });
          });

          // Filter out duplicates
          const existingPhones = [...duplicatePhones, ...existingMembers.map(m => m.phone)];
          const validMembers = members.filter(m => !existingPhones.includes(m.phone));

          // Create members in batches
          const batchSize = 50;
          for (let i = 0; i < validMembers.length; i += batchSize) {
            const batch = validMembers.slice(i, i + batchSize);
            
            try {
              const createdMembers = await Member.insertMany(batch, { ordered: false });
              results.successful += createdMembers.length;
              results.created.push(...createdMembers.map(m => ({
                name: m.name,
                phone: m.phone,
                id: m._id
              })));
            } catch (error) {
              // Handle individual member creation errors
              for (const member of batch) {
                try {
                  const created = await Member.create(member);
                  results.successful++;
                  results.created.push({
                    name: created.name,
                    phone: created.phone,
                    id: created._id
                  });
                } catch (memberError) {
                  results.failed++;
                  results.errors.push({
                    phone: member.phone,
                    name: member.name,
                    error: memberError.message
                  });
                }
              }
            }
          }

          results.failed += results.duplicates.length;

          resolve(results);

        } catch (error) {
          reject(error);
        }
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// Helper function to validate CSV structure
async function validateMemberCSV(filePath) {
  return new Promise((resolve, reject) => {
    const validation = {
      isValid: true,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      errors: [],
      warnings: [],
      preview: []
    };

    const requiredColumns = ['Name', 'Phone Number'];
    const optionalColumns = ['Email', 'Date of Birth', 'Blood Group', 'Profession', 'Education', 'Status'];
    let headers = [];
    let isFirstRow = true;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headerList) => {
        headers = headerList;
        
        // Check for required columns
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        if (missingColumns.length > 0) {
          validation.isValid = false;
          validation.errors.push({
            type: 'missing_columns',
            message: `Missing required columns: ${missingColumns.join(', ')}`
          });
        }

        // Check for unknown columns
        const knownColumns = [...requiredColumns, ...optionalColumns];
        const unknownColumns = headers.filter(col => !knownColumns.includes(col));
        if (unknownColumns.length > 0) {
          validation.warnings.push({
            type: 'unknown_columns',
            message: `Unknown columns will be ignored: ${unknownColumns.join(', ')}`
          });
        }
      })
      .on('data', (row) => {
        validation.totalRows++;
        
        // Add first 5 rows to preview
        if (validation.preview.length < 5) {
          validation.preview.push(row);
        }

        let isValidRow = true;
        const rowErrors = [];

        // Validate required fields
        if (!row['Name']?.trim()) {
          isValidRow = false;
          rowErrors.push('Name is required');
        }

        if (!row['Phone Number']?.trim()) {
          isValidRow = false;
          rowErrors.push('Phone Number is required');
        } else if (!/^\+91[6-9]\d{9}$/.test(row['Phone Number'].trim())) {
          isValidRow = false;
          rowErrors.push('Invalid phone number format');
        }

        // Validate optional fields
        if (row['Email']?.trim() && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(row['Email'].trim())) {
          rowErrors.push('Invalid email format');
        }

        if (row['Date of Birth']?.trim() && isNaN(Date.parse(row['Date of Birth'].trim()))) {
          rowErrors.push('Invalid date format');
        }

        const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        if (row['Blood Group']?.trim() && !validBloodGroups.includes(row['Blood Group'].trim())) {
          rowErrors.push('Invalid blood group');
        }

        const validStatuses = ['Active', 'Inactive', 'Abroad', 'Applicant', 'Age over', 'Dismissed'];
        if (row['Status']?.trim() && !validStatuses.includes(row['Status'].trim())) {
          rowErrors.push('Invalid status');
        }

        if (isValidRow) {
          validation.validRows++;
        } else {
          validation.invalidRows++;
          validation.errors.push({
            row: validation.totalRows,
            errors: rowErrors,
            data: row
          });
        }
      })
      .on('end', () => {
        if (validation.invalidRows > 0) {
          validation.isValid = false;
        }

        resolve(validation);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

export default router;