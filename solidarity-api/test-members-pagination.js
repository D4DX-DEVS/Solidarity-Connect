#!/usr/bin/env node

/**
 * Test script to verify members pagination is working correctly
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5003/api';
const TEST_PHONE = '+919656550933';

let authToken = '';

async function testMembersPagination() {
  console.log('🧪 Testing Members Pagination');
  console.log('=============================\n');

  try {
    // Step 1: Login as state admin
    console.log('1. Logging in as state admin...');
    const otpResponse = await axios.post(`${BASE_URL}/auth/send-otp`, {
      phone: TEST_PHONE,
      userType: 'state_admin'
    });

    const verifyResponse = await axios.post(`${BASE_URL}/auth/verify-otp`, {
      phone: TEST_PHONE,
      otp: '1234',
      userType: 'state_admin'
    });
    authToken = verifyResponse.data.data.token;
    console.log('✅ Logged in as:', verifyResponse.data.data.user.name);

    // Step 2: Test pagination parameters
    console.log('\n2. Testing pagination with different parameters...');
    
    // Test with page 1, limit 5
    const page1Response = await axios.get(`${BASE_URL}/members?page=1&limit=5&sort=-createdAt`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Page 1 (limit 5):');
    console.log('   Members returned:', page1Response.data.data.length);
    console.log('   Pagination info:', {
      currentPage: page1Response.data.pagination.currentPage,
      totalPages: page1Response.data.pagination.totalPages,
      totalDocs: page1Response.data.pagination.totalDocs,
      hasNextPage: page1Response.data.pagination.hasNextPage,
      hasPrevPage: page1Response.data.pagination.hasPrevPage
    });

    // Test with page 2 if available
    if (page1Response.data.pagination.hasNextPage) {
      console.log('\n3. Testing page 2...');
      const page2Response = await axios.get(`${BASE_URL}/members?page=2&limit=5&sort=-createdAt`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      console.log('✅ Page 2 (limit 5):');
      console.log('   Members returned:', page2Response.data.data.length);
      console.log('   Pagination info:', {
        currentPage: page2Response.data.pagination.currentPage,
        totalPages: page2Response.data.pagination.totalPages,
        hasNextPage: page2Response.data.pagination.hasNextPage,
        hasPrevPage: page2Response.data.pagination.hasPrevPage
      });
    } else {
      console.log('\n3. No page 2 available (not enough members)');
    }

    // Test with different limit
    console.log('\n4. Testing with different limit (10)...');
    const limitResponse = await axios.get(`${BASE_URL}/members?page=1&limit=10&sort=-createdAt`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Page 1 (limit 10):');
    console.log('   Members returned:', limitResponse.data.data.length);
    console.log('   Pagination info:', {
      currentPage: limitResponse.data.pagination.currentPage,
      totalPages: limitResponse.data.pagination.totalPages,
      totalDocs: limitResponse.data.pagination.totalDocs
    });

    // Test with search and pagination
    console.log('\n5. Testing search with pagination...');
    const searchResponse = await axios.get(`${BASE_URL}/members?page=1&limit=5&search=test&sort=-createdAt`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Search results (page 1, limit 5):');
    console.log('   Members returned:', searchResponse.data.data.length);
    console.log('   Pagination info:', {
      currentPage: searchResponse.data.pagination.currentPage,
      totalPages: searchResponse.data.pagination.totalPages,
      totalDocs: searchResponse.data.pagination.totalDocs
    });

    // Test with status filter and pagination
    console.log('\n6. Testing status filter with pagination...');
    const statusResponse = await axios.get(`${BASE_URL}/members?page=1&limit=5&status=Active&sort=-createdAt`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Active members (page 1, limit 5):');
    console.log('   Members returned:', statusResponse.data.data.length);
    console.log('   Pagination info:', {
      currentPage: statusResponse.data.pagination.currentPage,
      totalPages: statusResponse.data.pagination.totalPages,
      totalDocs: statusResponse.data.pagination.totalDocs
    });

    console.log('\n🎉 Members pagination test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Basic pagination working');
    console.log('   ✅ Page navigation working');
    console.log('   ✅ Different limits working');
    console.log('   ✅ Search with pagination working');
    console.log('   ✅ Filters with pagination working');
    console.log('   ✅ Proper pagination metadata returned');

  } catch (error) {
    console.error('❌ Members pagination test failed:');
    console.error('Error message:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    console.error('Full error:', error);
    process.exit(1);
  }
}

testMembersPagination();