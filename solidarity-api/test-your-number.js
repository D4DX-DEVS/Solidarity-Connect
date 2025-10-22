#!/usr/bin/env node

/**
 * Test DXing with Your Actual WhatsApp Number
 * Replace the phone number below with your actual WhatsApp number
 */

import dotenv from 'dotenv';
import dxingService from './src/services/dxingService.js';

dotenv.config();

async function testYourNumber() {
  console.log('📱 Testing DXing with Your WhatsApp Number');
  console.log('==========================================\n');

  // 🔄 REPLACE THIS WITH YOUR ACTUAL WHATSAPP NUMBER
  const yourWhatsAppNumber = '+919656550933'; // Change this to your real WhatsApp number
  
  console.log(`📞 Testing with number: ${yourWhatsAppNumber}`);
  console.log('⚠️  Make sure this number has WhatsApp installed and active\n');

  try {
    // Test OTP sending
    console.log('1. Testing OTP Send...');
    const otpResult = await dxingService.sendOTP(yourWhatsAppNumber, '1234');

    if (otpResult.success) {
      console.log('🎉 SUCCESS! OTP sent successfully!');
      console.log(`   Message ID: ${otpResult.messageId}`);
      console.log(`   Status: ${otpResult.status}`);
      console.log(`   Check your WhatsApp for the OTP message!`);
    } else {
      console.log('❌ OTP send failed');
      console.log(`   Error: ${otpResult.error}`);
      
      if (otpResult.error.includes("WhatsApp account doesn't exist")) {
        console.log('\n💡 Troubleshooting Steps:');
        console.log('   1. Verify the number has WhatsApp installed');
        console.log('   2. Check your DXing dashboard for account restrictions');
        console.log('   3. Contact DXing support to verify account setup');
        console.log('   4. Check if your account is in sandbox mode');
      }
    }

    // Test simple message
    console.log('\n2. Testing Simple Message...');
    const messageResult = await dxingService.sendWhatsAppMessage(
      yourWhatsAppNumber,
      'Hello! This is a test message from Solidarity API. If you receive this, the integration is working! 🎉'
    );

    if (messageResult.success) {
      console.log('🎉 SUCCESS! Message sent successfully!');
      console.log(`   Message ID: ${messageResult.messageId}`);
      console.log(`   Check your WhatsApp for the test message!`);
    } else {
      console.log('❌ Message send failed');
      console.log(`   Error: ${messageResult.error}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n📋 Next Steps:');
  console.log('1. If messages are not received, contact DXing support');
  console.log('2. Verify your DXing account WhatsApp Business API setup');
  console.log('3. Check if there are any account limitations or quotas');
  console.log('4. Consider using DXing\'s test/sandbox numbers if available');
}

testYourNumber();