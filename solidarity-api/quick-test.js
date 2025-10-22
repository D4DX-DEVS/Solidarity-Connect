#!/usr/bin/env node

/**
 * Quick Test - Start Server and Test OTP
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './src/config/database.js';
import authRoutes from './src/routes/auth.js';

dotenv.config();

const app = express();
const PORT = 3333;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Solidarity API is running!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 ================================`);
  console.log(`🎯 Solidarity API Test Server`);
  console.log(`================================`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth`);
  console.log(`================================`);
  console.log(`📱 Test Phone: +919656550933`);
  console.log(`👥 User Types: state_admin, district_admin, group_admin`);
  console.log(`💡 OTP will be displayed in console!`);
  console.log(`================================\n`);
});

export default app;