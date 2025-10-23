#!/usr/bin/env node

/**
 * Test script to verify member dashboard data loading
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5003/api';
const TEST_PHONE = '+919656550933';

async function testMemberDashboard() {
  console.log('🧪 Testing Member Dashboard Data Loading');
  console.log('==========================================\n');

  try {
    // Step 1: Send OTP
    console.log('1. Sending OTP to member...');
    const otpResponse = await axios.post(`${BASE_URL}/member-auth/send-otp`, {
      phone: TEST_PHONE
    });
    
    const demoOTP = otpResponse.data.data.demoOTP;
    console.log('✅ OTP sent successfully. Demo OTP:', demoOTP);

    // Step 2: Verify OTP and get token
    console.log('\n2. Verifying OTP and logging in...');
    const verifyResponse = await axios.post(`${BASE_URL}/member-auth/verify-otp`, {
      phone: TEST_PHONE,
      otp: demoOTP
    });
    
    const token = verifyResponse.data.data.token;
    const member = verifyResponse.data.data.member;
    console.log('✅ Login successful for:', member.name);

    // Step 3: Test all dashboard endpoints
    const headers = { Authorization: `Bearer ${token}` };

    console.log('\n3. Testing member profile endpoint...');
    const profileResponse = await axios.get(`${BASE_URL}/member-auth/profile`, { headers });
    console.log('✅ Profile data loaded:', {
      name: profileResponse.data.data.profile.name,
      district: profileResponse.data.data.profile.district.name,
      group: profileResponse.data.data.profile.group.name,
      baithulMaal: profileResponse.data.data.baithulMaal
    });

    console.log('\n4. Testing targets endpoint...');
    const currentDate = new Date();
    const targetsResponse = await axios.get(
      `${BASE_URL}/member-auth/targets?month=${currentDate.getMonth() + 1}&year=${currentDate.getFullYear()}`, 
      { headers }
    );
    console.log('✅ Targets data loaded:', targetsResponse.data.data.length, 'targets found');

    console.log('\n5. Testing meetings endpoint...');
    const meetingsResponse = await axios.get(
      `${BASE_URL}/member-auth/meetings?status=scheduled&limit=5`, 
      { headers }
    );
    console.log('✅ Meetings data loaded:', meetingsResponse.data.data.meetings.length, 'meetings found');

    console.log('\n6. Testing notifications endpoint...');
    const notificationsResponse = await axios.get(
      `${BASE_URL}/member-auth/notifications?limit=5`, 
      { headers }
    );
    console.log('✅ Notifications data loaded:', notificationsResponse.data.data.notifications.length, 'notifications found');

    console.log('\n🎉 All member dashboard endpoints are working correctly!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Member authentication working');
    console.log('   ✅ Profile data loading');
    console.log('   ✅ Targets data loading');
    console.log('   ✅ Meetings data loading');
    console.log('   ✅ Notifications data loading');
    console.log('\n💡 The member dashboard should now display data correctly.');
    console.log('   Visit: http://localhost:8081/member-dashboard');
    console.log('   Login with phone: +919656550933');
    console.log('   Use OTP: 1234 (or any 4-digit number in development)');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('\n💡 Possible solutions:');
      console.log('   1. Make sure the API server is running: npm run dev (in solidarity-api folder)');
      console.log('   2. Check if the API URL is correct in .env file');
      console.log('   3. Verify the member-auth routes are properly configured');
    }
  }
}

testMemberDashboard();