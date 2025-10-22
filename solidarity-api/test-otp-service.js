#!/usr/bin/env node

/**
 * Test OTP Service with Console Output
 */

import dotenv from 'dotenv';
import otpService from './src/services/otpService.js';
import connectDB from './src/config/database.js';

dotenv.config();

async function testOTPService() {
  console.log('🧪 Testing OTP Service');
  console.log('======================\n');

  try {
    // Connect to database
    await connectDB();
    console.log('✅ Database connected\n');

    // Test OTP sending
    console.log('1. Testing OTP Send...');
    const result = await otpService.sendOTP('+919656550933', 'state_admin');

    console.log('\n📋 OTP Service Result:');
    console.log('   Success:', result.success);
    console.log('   Message:', result.message);
    console.log('   Expires At:', result.expiresAt);
    
    if (result.demoOTP) {
      console.log('   🔢 Demo OTP:', result.demoOTP);
    }
    
    if (result.deliveryStatus) {
      console.log('   📱 Delivery Status:', result.deliveryStatus);
      console.log('   ❌ Delivery Error:', result.deliveryError);
    }

    // Test OTP verification
    if (result.demoOTP) {
      console.log('\n2. Testing OTP Verification...');
      const verifyResult = await otpService.verifyOTP('+919656550933', result.demoOTP, 'state_admin');
      
      console.log('   Verification Success:', verifyResult.success);
      console.log('   Verification Message:', verifyResult.message);
      
      if (verifyResult.user) {
        console.log('   User:', verifyResult.user.name, `(${verifyResult.user.role})`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    process.exit(0);
  }
}

testOTPService();