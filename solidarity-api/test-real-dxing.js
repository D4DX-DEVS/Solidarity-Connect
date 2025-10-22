#!/usr/bin/env node

/**
 * Test Real DXing WhatsApp API with OTP
 */

import dotenv from 'dotenv';
import dxingService from './src/services/dxingService.js';

dotenv.config();

async function testRealDXingOTP() {
  console.log('🧪 Testing Real DXing WhatsApp OTP');
  console.log('==================================\n');

  try {
    // Check if credentials are configured
    console.log('1. Checking API Configuration...');
    if (!dxingService.isConfigured()) {
      console.error('❌ DXing API credentials not configured');
      return;
    }
    console.log('✅ API credentials configured');

    // Test with different phone numbers
    const testNumbers = [
      '919895123456', // From DXing documentation example
      '919656550933', // Your test number
      '919999999999'  // Another test number
    ];

    for (const testPhone of testNumbers) {
      console.log(`\n2. Testing OTP Send to ${testPhone}...`);
      
      const otpResult = await dxingService.sendOTP(`+91${testPhone.substring(2)}`, '1234');

      if (otpResult.success) {
        console.log('✅ OTP sent successfully!');
        console.log(`   Message ID: ${otpResult.messageId}`);
        console.log(`   Status: ${otpResult.status}`);
        console.log(`   Response:`, otpResult.data);
        break; // Stop on first success
      } else {
        console.log('❌ OTP send failed');
        console.log(`   Error: ${otpResult.error}`);
        console.log(`   Details:`, otpResult.details);
      }
    }

    // Test with a simple message
    console.log('\n3. Testing Simple Message...');
    const messageResult = await dxingService.sendWhatsAppMessage(
      '+919895123456', // Use the example number from docs
      'Hello! This is a test message from Solidarity API'
    );

    if (messageResult.success) {
      console.log('✅ Message sent successfully!');
      console.log(`   Message ID: ${messageResult.messageId}`);
      console.log(`   Status: ${messageResult.status}`);
    } else {
      console.log('❌ Message send failed');
      console.log(`   Error: ${messageResult.error}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRealDXingOTP();