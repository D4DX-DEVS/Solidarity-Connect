import { body, param, query, validationResult } from 'express-validator';

// Handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Common validation rules
export const phoneInputValidation = body('phone')
  .notEmpty()
  .withMessage('Phone number is required *')
  .matches(/^([6-9]\d{9}|\+91[6-9]\d{9})$/)
  .withMessage('Please enter a valid 10-digit phone number (e.g., 9876543210)');

export const phoneValidation = body('phone')
  .matches(/^\+91[6-9]\d{9}$/)
  .withMessage('Please enter a valid Indian phone number');

export const emailValidation = body('email')
  .optional()
  .isEmail()
  .normalizeEmail()
  .withMessage('Please enter a valid email address');

export const nameValidation = body('name')
  .notEmpty()
  .withMessage('Name is required *')
  .trim()
  .isLength({ min: 2, max: 100 })
  .withMessage('Name must be between 2 and 100 characters');

export const objectIdValidation = (field) => 
  param(field).isMongoId().withMessage(`Invalid ${field} ID`);

// Auth validations (use input validation before formatting)
export const loginValidation = [
  phoneInputValidation,
  body('userType')
    .isIn(['state_admin', 'district_admin', 'group_admin'])
    .withMessage('Invalid user type'),
  handleValidationErrors
];

export const verifyOTPValidation = [
  phoneInputValidation,
  body('otp')
    .isLength({ min: 4, max: 4 })
    .isNumeric()
    .withMessage('OTP must be 4 digits'),
  handleValidationErrors
];

// Custom validation for member creation that handles role-based requirements
export const createMemberValidation = [
  nameValidation,
  phoneInputValidation,
  emailValidation,
  // District and group validation - conditional based on user role
  body('district')
    .if((value, { req }) => req.user && req.user.role !== 'group_admin')
    .notEmpty()
    .withMessage('District is required *')
    .isMongoId()
    .withMessage('Please select a valid district'),
  body('group')
    .if((value, { req }) => req.user && req.user.role !== 'group_admin')
    .notEmpty()
    .withMessage('Group is required *')
    .isMongoId()
    .withMessage('Please select a valid group'),
  body('dateOfBirth')
    .customSanitizer((value) => {
      if (value === undefined || value === null) return value;
      return /^\d{4}-\d{2}-\d{2}/.test(String(value)) ? value : '';
    })
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid date of birth'),
  body('bloodGroup')
    .optional({ checkFalsy: true })
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Invalid blood group'),
  body('status')
    .optional({ checkFalsy: true })
    .isIn(['Active', 'Inactive', 'Abroad', 'Applicant', 'Age over', 'Dismissed'])
    .withMessage('Invalid status'),
  body('monthlyBaithulMaal')
    .optional({ checkFalsy: true })
    .isNumeric()
    .withMessage('Monthly Baithul Maal must be a number')
    .custom((value) => {
      if (value && Number(value) < 0) {
        throw new Error('Monthly Baithul Maal cannot be negative');
      }
      return true;
    }),
  handleValidationErrors
];

export const updateMemberValidation = [
  objectIdValidation('id'),
  nameValidation.optional(),
  body('phone')
    .optional({ checkFalsy: true })
    .matches(/^([6-9]\d{9}|\+91[6-9]\d{9})$/)
    .withMessage('Please enter a valid 10-digit phone number (e.g., 9876543210)'),
  emailValidation,
  body('district')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid district ID'),
  body('group')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid group ID'),
  body('dateOfBirth')
    .customSanitizer((value) => {
      if (value === undefined || value === null) return value;
      return /^\d{4}-\d{2}-\d{2}/.test(String(value)) ? value : '';
    })
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid date of birth'),
  body('bloodGroup')
    .optional({ checkFalsy: true })
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Invalid blood group'),
  body('status')
    .optional({ checkFalsy: true })
    .isIn(['Active', 'Inactive', 'Abroad', 'Applicant', 'Age over', 'Dismissed'])
    .withMessage('Invalid status'),
  body('monthlyBaithulMaal')
    .optional({ checkFalsy: true })
    .isNumeric()
    .withMessage('Monthly Baithul Maal must be a number')
    .custom((value) => {
      if (value && Number(value) < 0) {
        throw new Error('Monthly Baithul Maal cannot be negative');
      }
      return true;
    }),
  handleValidationErrors
];

// District validations
export const createDistrictValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('District name must be between 2 and 100 characters'),
  body('code')
    .trim()
    .isLength({ min: 2, max: 10 })
    .isAlphanumeric()
    .withMessage('District code must be 2-10 alphanumeric characters'),
  body('admin')
    .optional()
    .isMongoId()
    .withMessage('Invalid admin ID'),
  handleValidationErrors
];

// Group validations
export const createGroupValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Group name must be between 2 and 100 characters'),
  body('code')
    .trim()
    .isLength({ min: 2, max: 10 })
    .isAlphanumeric()
    .withMessage('Group code must be 2-10 alphanumeric characters'),
  body('district')
    .isMongoId()
    .withMessage('Invalid district ID'),
  body('admin')
    .optional()
    .isMongoId()
    .withMessage('Invalid admin ID'),
  handleValidationErrors
];

// Meeting validations
export const createMeetingValidation = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Meeting title must be between 5 and 200 characters'),
  body('scheduledDate')
    .isISO8601()
    .withMessage('Invalid scheduled date'),
  body('duration')
    .optional()
    .isInt({ min: 15, max: 480 })
    .withMessage('Duration must be between 15 and 480 minutes'),
  body('meetingType')
    .optional()
    .isIn(['general', 'emergency', 'monthly', 'annual', 'special', 'monthly_series'])
    .withMessage('Invalid meeting type'),
  body('targetAudience')
    .optional()
    .isIn(['all', 'state_admins', 'district_admins', 'group_admins', 'specific_groups', 'specific_districts'])
    .withMessage('Invalid target audience'),
  handleValidationErrors
];

// Monthly meeting with sessions validation
export const createMonthlyMeetingValidation = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Meeting title must be between 5 and 200 characters'),
  body('synopsis')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Synopsis must be between 10 and 2000 characters'),
  body('month')
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  body('year')
    .isInt({ min: 2020, max: 2050 })
    .withMessage('Year must be between 2020 and 2050'),
  body('sessions')
    .isArray({ min: 1 })
    .withMessage('At least one session is required'),
  body('sessions.*.title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Session title must be between 3 and 200 characters'),
  body('sessions.*.description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Session description cannot exceed 1000 characters'),
  body('sessions.*.scheduledDate')
    .isISO8601()
    .withMessage('Valid session date is required'),
  body('sessions.*.duration')
    .optional()
    .isInt({ min: 15, max: 480 })
    .withMessage('Session duration must be between 15 and 480 minutes'),
  body('targetAudience')
    .optional()
    .isIn(['all', 'state_admins', 'district_admins', 'group_admins', 'specific_groups', 'specific_districts'])
    .withMessage('Invalid target audience'),
  handleValidationErrors
];

// Notification validations
export const createNotificationValidation = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Notification title must be between 5 and 200 characters'),
  body('message')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Notification message must be between 10 and 1000 characters'),
  body('type')
    .optional()
    .isIn(['general', 'meeting', 'urgent', 'reminder', 'announcement', 'system'])
    .withMessage('Invalid notification type'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  body('targetAudience')
    .optional()
    .isIn(['all', 'state_admins', 'district_admins', 'group_admins', 'members', 'specific_groups', 'specific_districts', 'specific_users'])
    .withMessage('Invalid target audience'),
  body('channels')
    .optional()
    .isArray()
    .withMessage('Channels must be an array'),
  body('channels.*')
    .optional()
    .isIn(['whatsapp', 'sms', 'email', 'in_app'])
    .withMessage('Invalid channel'),
  handleValidationErrors
];

// Request validations
export const createRequestValidation = [
  body('type')
    .isIn(['member_edit', 'member_transfer', 'member_status_change', 'baithul_maal_update', 'group_transfer'])
    .withMessage('Invalid request type'),
  body('member')
    .isMongoId()
    .withMessage('Invalid member ID'),
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Request title must be between 5 and 200 characters'),
  body('proposedData')
    .isObject()
    .withMessage('Proposed data must be an object'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  handleValidationErrors
];

// Query validations
export const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  query('sort')
    .optional()
    .isString()
    .withMessage('Sort must be a string'),
  handleValidationErrors
];

export const searchValidation = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  ...paginationValidation
];

export default {
  handleValidationErrors,
  phoneValidation,
  emailValidation,
  nameValidation,
  objectIdValidation,
  loginValidation,
  verifyOTPValidation,
  createMemberValidation,
  updateMemberValidation,
  createDistrictValidation,
  createGroupValidation,
  createMeetingValidation,
  createMonthlyMeetingValidation,
  createNotificationValidation,
  createRequestValidation,
  paginationValidation,
  searchValidation
};