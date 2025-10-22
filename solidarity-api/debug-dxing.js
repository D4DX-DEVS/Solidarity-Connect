#!/usr/bin/env node

/**
 * Debug DXing WhatsApp API Issues
 */

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function debugDXingAPI() {
  console.log('🔍 Debugging DXing WhatsApp API');
  console.log('================================\n');

  const apiUrl = process.env.DXING_API_URL;
  const apiSecret = process.env.DXING_API_SECRET;
  const accountId = process.env.DXING_ACCOUNT_ID;

  console.log('📋 Configuration:');
  console.log(`   API URL: ${apiUrl}`);
  console.log(`   Account ID: ${accountId}`);
  console.log(`   Secret: ${apiSecret ? apiSecret.substring(0, 10) + '...' : 'Not set'}\n`);

  // Test different phone number formats
  const phoneFormats = [
    '9656550933',      // 10 digits
    '919656550933',    // With country code
    '+919656550933',   // With + and country code
    '00919656550933'   // International format
  ];

  for (const phone of phoneFormats) {
    console.log(`🧪 Testing phone format: ${phone}`);
    
    try {
      const payload = {
        secret: apiSecret,
        account: accountId,
        recipient: phone,
        type: 'text',
        message: 'Test message from Solidarity API',
        priority: 0
      };

      console.log('   Payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(apiUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      console.log('   ✅ Response:', response.data);
      
      if (response.data.status === 200 || response.data.status === 'success') {
        console.log('   🎉 SUCCESS! This format works!\n');
        break;
      }

    } catch (error) {
      console.log('   ❌ Error:', error.response?.data || error.message);
    }
    
    console.log(''); // Empty line for readability
  }

  // Test account validation
  console.log('🔐 Testing Account Validation...');
  try {
    const testPayload = {
      secret: apiSecret,
      account: accountId,
      recipient: '919999999999', // Known invalid number
      type: 'text',
      message: 'Account validation test',
      priority: 0
    };

    const response = await axios.post(apiUrl, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    console.log('   Account validation response:', response.data);

  } catch (error) {
    console.log('   Account validation error:', error.response?.data || error.message);
  }

  // Test with minimal payload
  console.log('\n🎯 Testing Minimal Payload...');
  try {
    const minimalPayload = {
      secret: apiSecret,
      account: accountId,
      recipient: '919656550933',
      message: 'Hello'
    };

    const response = await axios.post(apiUrl, minimalPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('   Minimal payload response:', response.data);

  } catch (error) {
    console.log('   Minimal payload error:', error.response?.data || error.message);
  }

  console.log('\n💡 Recommendations:');
  console.log('1. Check if your DXing account is in sandbox/test mode');
  console.log('2. Verify the phone number is registered with your DXing account');
  console.log('3. Contact DXing support to verify account permissions');
  console.log('4. Check if there are any account restrictions or quotas');
  console.log('5. Verify the WhatsApp Business API setup in your DXing dashboard');
}

debugDXingAPI();