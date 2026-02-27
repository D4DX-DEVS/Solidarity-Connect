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
import bulkImportRoutes from './routes/bulkImport.js';
import personalTargetsRoutes from './routes/personalTargets.js';
import memberTargetProgressRoutes from './routes/memberTargetProgress.js';
import memberAuthRoutes from './routes/memberAuth.js';
import uploadRoutes from './routes/uploads.js';
import orgFilesRoutes from './routes/orgFiles.js';
import userTargetProgressRoutes from './routes/userTargetProgress.js';

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

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

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
app.use('/api/bulk-import', bulkImportRoutes);
app.use('/api/personal-targets', personalTargetsRoutes);
app.use('/api/member-target-progress', memberTargetProgressRoutes);
app.use('/api/member-auth', memberAuthRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/org-files', orgFilesRoutes);
app.use('/api/user-target-progress', userTargetProgressRoutes);

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

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app;