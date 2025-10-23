#!/usr/bin/env node

/**
 * Test DXing API Integration
 */

import dotenv from 'dotenv';
import dxingService from './src/services/dxingService.js';

dotenv.config();

async function testDXingAPI() {
  console.log('🧪 Testing DXing WhatsApp API');
  console.log('==============================\n');

  try {
    // Check if credentials are configured
    console.log('1. Checking API Configuration...');
    if (!dxingService.isConfigured()) {
      console.error('❌ DXing API credentials not configured');
      console.log('Please check your .env file for:');
      console.log('- DXING_API_URL');
      console.log('- DXING_API_SECRET');
      console.log('- DXING_ACCOUNT_ID');
      return;
    }
    console.log('✅ API credentials configured');

    // Test phone number
    const testPhone = '+919656550933';
    const testMessage = '🧪 Test message from Solidarity API\n\nThis is a test message to verify DXing integration.\n\n- Solidarity Team';

    console.log('\n2. Testing WhatsApp Message Send...');
    console.log(`   Phone: ${testPhone}`);
    console.log(`   Message: ${testMessage.substring(0, 50)}...`);

    const result = await dxingService.sendWhatsAppMessage(testPhone, testMessage);

    if (result.success) {
      console.log('✅ Message sent successfully!');
      console.log(`   Message ID: ${result.messageId}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Response:`, result.data);
    } else {
      console.log('❌ Message send failed');
      console.log(`   Error: ${result.error}`);
      console.log(`   Details:`, result.details);
    }

    // Test OTP sending
    console.log('\n3. Testing OTP Send...');
    const otpResult = await dxingService.sendOTP(testPhone, '1234');

    if (otpResult.success) {
      console.log('✅ OTP sent successfully!');
      console.log(`   Message ID: ${otpResult.messageId}`);
    } else {
      console.log('❌ OTP send failed');
      console.log(`   Error: ${otpResult.error}`);
    }



  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDXingAPI();