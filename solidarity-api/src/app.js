import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
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
import memberAuthRoutes from './routes/memberAuth.js';
import uploadRoutes from './routes/uploads.js';
import orgFilesRoutes from './routes/orgFiles.js';
import monthlyReportRoutes from './routes/monthlyReports.js';

const CREDENTIAL_PATHS = [
  '/api/auth/send-otp',
  '/api/auth/verify-otp',
  '/api/auth/resend-otp',
  '/api/auth/login',
  '/api/member-auth/send-otp',
  '/api/member-auth/verify-otp',
  '/api/member-auth/resend-otp'
];

/**
 * Express middleware over a Workers Rate Limiting binding, keyed by client IP.
 * Fails open if the binding is missing or errors, so a limiter outage never takes
 * the API down.
 * @param {string} bindingName
 * @returns {import('express').RequestHandler}
 */
function cloudflareLimiter(bindingName) {
  return async (req, res, next) => {
    const limiter = globalThis.__CF_ENV?.[bindingName];
    if (!limiter) return next();
    try {
      const { success } = await limiter.limit({ key: req.header('CF-Connecting-IP') || req.ip || 'unknown' });
      if (success) return next();
    } catch {
      return next();
    }
    return res.status(429).json({ success: false, message: 'Too many requests, please try again later.' });
  };
}

/**
 * Builds the Express app. `worker: true` when running on Cloudflare Workers:
 * same-origin requests are always allowed, the client IP comes from
 * CF-Connecting-IP, Cloudflare compresses responses, and /cdn/* serves R2.
 */
export function createApp({ worker = false } = {}) {
  const app = express();

  if (worker) app.set('trust proxy', true);

  // Security middleware
  app.use(helmet());

  // CORS — allowed origins from FRONTEND_URL (single URL or comma-separated list)
  const allowedOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  if (!worker && allowedOrigins.length === 0) {
    console.warn('⚠️ FRONTEND_URL is not set. CORS will block browser requests from unknown origins.');
  }

  app.use(cors((req, callback) => {
    const origin = req.header('Origin');
    const base = {
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    };
    // No origin (curl, mobile apps) or same-origin (Worker serves the SPA too)
    const sameOrigin = origin && req.header('Host') && origin.replace(/^https?:\/\//, '') === req.header('Host');
    if (!origin || sameOrigin || allowedOrigins.includes(origin)) return callback(null, { ...base, origin: true });
    console.log('❌ CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  }));

  // Rate limiting
  if (worker) {
    // Workers: Cloudflare Rate Limiting bindings (wrangler.jsonc "ratelimits"), shared
    // across isolates. An in-memory store would be per-isolate and needs timers that
    // Workers forbid at startup. Credential endpoints (OTP sends cost money, DOB
    // guesses) get a tighter limit than the API as a whole.
    app.use(CREDENTIAL_PATHS, cloudflareLimiter('AUTH_LIMITER'));
    app.use('/api/', cloudflareLimiter('API_LIMITER'));
  } else if (process.env.NODE_ENV !== 'development') {
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
      message: 'Too many requests, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    });
    app.use('/api/', limiter);
  }

  // Body parsing middleware (Cloudflare compresses Worker responses itself)
  if (!worker) app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging (morgan compiles its formats with new Function, which Workers forbid;
  // Workers observability records every request instead)
  if (!worker && process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
  }

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: typeof process.uptime === 'function' ? process.uptime() : 0
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
  app.use('/api/member-auth', memberAuthRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/org-files', orgFilesRoutes);
  app.use('/api/monthly-reports', monthlyReportRoutes);

  // On Workers, /cdn/* (R2) is streamed by worker/index.js before Express runs.
  if (!worker) {
    // Serve uploaded files
    app.use('/uploads', express.static('uploads'));
  }

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  });

  // Error handling middleware
  app.use(errorHandler);

  return app;
}
