import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import errorHandler from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import memberRoutes from './routes/members.js';
import districtRoutes from './routes/districts.js';
import groupRoutes from './routes/groups.js';
import meetingRoutes from './routes/meetings.js';
import requestRoutes from './routes/requests.js';
import notificationRoutes from './routes/notifications.js';
import baithulMaalRoutes from './routes/baithulMaal.js';
import baithulMaalPaymentRoutes from './routes/baithulMaalPayments.js';
import transferRequestRoutes from './routes/transferRequests.js';
import reportRoutes from './routes/reports.js';
import consolidationRoutes from './routes/consolidation.js';
import bulkImportRoutes from './routes/bulkImport.js';
import personalTargetsRoutes from './routes/personalTargets.js';
import memberTargetProgressRoutes from './routes/memberTargetProgress.js';
import memberAuthRoutes from './routes/memberAuth.js';
import uploadRoutes from './routes/uploads.js';
import orgFilesRoutes from './routes/orgFiles.js';
import userTargetProgressRoutes from './routes/userTargetProgress.js';
import recurringMarksRoutes from './routes/recurringMarks.js';
import Member from './models/Member.js';
import RecurringMark from './models/RecurringMark.js';
import UserTargetProgress from './models/UserTargetProgress.js';
import MemberTargetProgress from './models/MemberTargetProgress.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5003;

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());

// CORS configuration - allowed origins from env (same format for dev and production)
// FRONTEND_URL: single URL or comma-separated list, e.g. http://localhost:5173 or https://app.example.com,https://www.example.com
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  console.warn('⚠️ FRONTEND_URL is not set. CORS will block browser requests from unknown origins.');
}

console.log('🌐 CORS allowed origins:', allowedOrigins.length ? allowedOrigins : '(none from env)');
console.log('🔧 Environment:', process.env.NODE_ENV);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting (skip entirely in development)
if (process.env.NODE_ENV !== 'development') {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);
}

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/districts', districtRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/baithul-maal', baithulMaalRoutes);
app.use('/api/baithul-maal-payments', baithulMaalPaymentRoutes);
app.use('/api/transfer-requests', transferRequestRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/consolidation', consolidationRoutes);
app.use('/api/bulk-import', bulkImportRoutes);
app.use('/api/personal-targets', personalTargetsRoutes);
app.use('/api/member-target-progress', memberTargetProgressRoutes);
app.use('/api/member-auth', memberAuthRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/org-files', orgFilesRoutes);
app.use('/api/user-target-progress', userTargetProgressRoutes);
app.use('/api/recurring-marks', recurringMarksRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

// One-time migration: fix approved members stuck in Inactive/Applicant status
async function runMigrations() {
  try {
    // Fix members that are not approved or not active (all migrated members should be active)
    const result = await Member.updateMany(
      { $or: [{ isApproved: false }, { isApproved: { $exists: false } }, { status: { $in: ['Inactive', 'Applicant'] } }] },
      { $set: { isApproved: true, status: 'Active' } }
    );
    if (result.modifiedCount > 0) {
      console.log(`✅ Migration: approved and activated ${result.modifiedCount} member(s)`);
    }

    // Backfill UserTargetProgress from RecurringMarks for admin users
    const adminMarks = await RecurringMark.find({ userType: 'User', completed: true }).lean();
    const adminMarksByUserTarget = {};
    for (const m of adminMarks) {
      const key = `${m.user}_${m.personalTarget}`;
      adminMarksByUserTarget[key] = m;
    }
    for (const [, m] of Object.entries(adminMarksByUserTarget)) {
      await UserTargetProgress.findOneAndUpdate(
        { user: m.user, personalTarget: m.personalTarget },
        { $set: { status: 'completed', currentProgress: 1, progressPercentage: 100, completedAt: m.markedAt } },
        { upsert: true }
      );
    }
    if (Object.keys(adminMarksByUserTarget).length > 0) {
      console.log(`✅ Migration: synced ${Object.keys(adminMarksByUserTarget).length} recurring mark(s) to UserTargetProgress`);
    }

    // Backfill MemberTargetProgress from RecurringMarks for members
    const memberMarks = await RecurringMark.find({ userType: 'Member', completed: true }).lean();
    const memberMarksByUserTarget = {};
    for (const m of memberMarks) {
      const key = `${m.user}_${m.personalTarget}`;
      memberMarksByUserTarget[key] = m;
    }
    for (const [, m] of Object.entries(memberMarksByUserTarget)) {
      await MemberTargetProgress.findOneAndUpdate(
        { member: m.user, personalTarget: m.personalTarget },
        { $set: { status: 'completed', currentProgress: 1, progressPercentage: 100, completedAt: m.markedAt } },
        { upsert: true }
      );
    }
    if (Object.keys(memberMarksByUserTarget).length > 0) {
      console.log(`✅ Migration: synced ${Object.keys(memberMarksByUserTarget).length} recurring mark(s) to MemberTargetProgress`);
    }

    // RecurringMark: replace the legacy {user, personalTarget, year, month} unique index
    // with the new {..., week} unique index so weekly targets can record multiple marks per month.
    try {
      const recurringCol = RecurringMark.collection;
      const indexes = await recurringCol.indexes();
      const legacy = indexes.find(
        (ix) =>
          ix.unique &&
          ix.key &&
          ix.key.user === 1 &&
          ix.key.personalTarget === 1 &&
          ix.key.year === 1 &&
          ix.key.month === 1 &&
          ix.key.week === undefined
      );
      if (legacy) {
        await recurringCol.dropIndex(legacy.name);
        console.log(`✅ Migration: dropped legacy RecurringMark index "${legacy.name}"`);
      }
      // Backfill week=0 on any historical docs missing the new field so the unique index is happy.
      const updated = await RecurringMark.updateMany(
        { week: { $exists: false } },
        { $set: { week: 0 } }
      );
      if (updated.modifiedCount > 0) {
        console.log(`✅ Migration: set week=0 on ${updated.modifiedCount} existing RecurringMark doc(s)`);
      }
      await RecurringMark.syncIndexes();
    } catch (indexErr) {
      console.error('RecurringMark index migration error:', indexErr);
    }
  } catch (err) {
    console.error('Migration error:', err);
  }
}

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  await runMigrations();
});

export default app;