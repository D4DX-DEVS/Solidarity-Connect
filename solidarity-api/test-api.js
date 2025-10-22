#!/usr/bin/env node

/**
 * Simple API Test Script for Solidarity API
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:9000/api';
const TEST_PHONE = '+919656550933';

let authToken = '';

async function testAPI() {
  console.log('🧪 Testing Solidarity API');
  console.log('========================\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const healthResponse = await axios.get('http://localhost:9000/health');
    console.log('✅ Health Check:', healthResponse.data.status);

    // Test 2: Send OTP
    console.log('\n2. Testing Send OTP...');
    const otpResponse = await axios.post(`${BASE_URL}/auth/send-otp`, {
      phone: TEST_PHONE,
      userType: 'state_admin'
    });
    console.log('✅ OTP Sent:', otpResponse.data.message);

    // Test 3: Verify OTP (using any 4-digit code in development)
    console.log('\n3. Testing OTP Verification...');
    const verifyResponse = await axios.post(`${BASE_URL}/auth/verify-otp`, {
      phone: TEST_PHONE,
      otp: '1234',
      userType: 'state_admin'
    });
    authToken = verifyResponse.data.data.token;
    console.log('✅ OTP Verified, User:', verifyResponse.data.data.user.name);

    // Test 4: Get Current User
    console.log('\n4. Testing Get Current User...');
    const userResponse = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Current User:', userResponse.data.data.name, `(${userResponse.data.data.role})`);

    // Test 5: Get Members
    console.log('\n5. Testing Get Members...');
    const membersResponse = await axios.get(`${BASE_URL}/members?limit=5`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Members Retrieved:', membersResponse.data.data.length, 'members');
    console.log('   Statistics:', membersResponse.data.statistics);

    // Test 6: Get Districts
    console.log('\n6. Testing Get Districts...');
    const districtsResponse = await axios.get(`${BASE_URL}/districts`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Districts Retrieved:', districtsResponse.data.data.length, 'districts');

    // Test 7: Get Groups
    console.log('\n7. Testing Get Groups...');
    const groupsResponse = await axios.get(`${BASE_URL}/groups`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Groups Retrieved:', groupsResponse.data.data.length, 'groups');

    // Test 8: Get Dashboard Report
    console.log('\n8. Testing Dashboard Report...');
    const dashboardResponse = await axios.get(`${BASE_URL}/reports/dashboard`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Dashboard Report:', dashboardResponse.data.data.memberStatistics.totalMembers, 'total members');

    console.log('\n🎉 All API tests passed successfully!');
    console.log('\n📋 API Summary:');
    console.log(`   Base URL: ${BASE_URL}`);
    console.log(`   Test Phone: ${TEST_PHONE}`);
    console.log(`   Available User Types: state_admin, district_admin, group_admin`);
    console.log(`   Use any 4-digit OTP for login in development mode`);

  } catch (error) {
    console.error('❌ API Test Failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testAPI();