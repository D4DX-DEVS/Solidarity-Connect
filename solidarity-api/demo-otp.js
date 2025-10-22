#!/usr/bin/env node

/**
 * Demo OTP Display for Testing
 */

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function demoOTPFlow() {
  console.log('🎯 ================================');
  console.log('📱 SOLIDARITY API - OTP DEMO');
  console.log('================================');
  console.log('🔧 Mock Mode: ENABLED');
  console.log('📞 Test Phone: +919656550933');
  console.log('👥 User Types: state_admin, district_admin, group_admin');
  console.log('================================\n');

  console.log('📋 API Endpoints:');
  console.log('   POST /api/auth/send-otp');
  console.log('   POST /api/auth/verify-otp');
  console.log('   GET /api/auth/me\n');

  console.log('📝 Example Request:');
  console.log('   curl -X POST http://localhost:3333/api/auth/send-otp \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"phone": "+919656550933", "userType": "state_admin"}\'');
  console.log('');

  console.log('💡 When you call send-otp, you will see:');
  console.log('   🎯 ================================');
  console.log('   🔐 OTP GENERATED FOR TESTING');
  console.log('   ================================');
  console.log('   📱 Phone: +919656550933');
  console.log('   🔢 OTP: 1234 (example)');
  console.log('   👤 User Type: state_admin');
  console.log('   ⏰ Expires: [timestamp]');
  console.log('   ================================');
  console.log('   💡 Use this OTP in your app!');
  console.log('   ================================\n');

  console.log('🚀 Ready for testing!');
  console.log('   1. Start your React frontend');
  console.log('   2. Update API base URL to: http://localhost:3333/api');
  console.log('   3. Use phone: +919656550933');
  console.log('   4. Select any user type');
  console.log('   5. Check console for OTP when you click "Send OTP"');
  console.log('   6. Enter the displayed OTP in your app\n');
}

demoOTPFlow();