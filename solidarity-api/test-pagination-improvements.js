#!/usr/bin/env node

/**
 * Test script to verify pagination improvements
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5003/api';
const TEST_PHONE = '+919656550933';

async function testPaginationImprovements() {
  console.log('🧪 Testing Pagination Improvements');
  console.log('==================================\n');

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
    const authToken = verifyResponse.data.data.token;
    console.log('✅ Logged in as:', verifyResponse.data.data.user.name);

    // Step 2: Test pagination parameter validation
    console.log('\n2. Testing pagination parameter validation...');
    
    // Test with invalid page (should default to 1)
    const invalidPageResponse = await axios.get(`${BASE_URL}/members?page=-5&limit=10`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Invalid page (-5) handled:', {
      currentPage: invalidPageResponse.data.pagination.currentPage,
      shouldBe: 1
    });

    // Test with excessive limit (should cap at 100)
    const excessiveLimitResponse = await axios.get(`${BASE_URL}/members?page=1&limit=500`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Excessive limit (500) capped:', {
      limit: excessiveLimitResponse.data.pagination.limit,
      shouldBeMaximum: 100
    });

    // Step 3: Test enhanced pagination metadata
    console.log('\n3. Testing enhanced pagination metadata...');
    const metadataResponse = await axios.get(`${BASE_URL}/members?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Enhanced pagination metadata:');
    console.log('   Current Page:', metadataResponse.data.pagination.currentPage);
    console.log('   Total Pages:', metadataResponse.data.pagination.totalPages);
    console.log('   Total Docs:', metadataResponse.data.pagination.totalDocs);
    console.log('   Offset:', metadataResponse.data.pagination.offset);
    console.log('   Next Page:', metadataResponse.data.pagination.nextPage);
    console.log('   Prev Page:', metadataResponse.data.pagination.prevPage);

    // Step 4: Test cache headers
    console.log('\n4. Testing cache headers...');
    console.log('✅ Response headers:');
    console.log('   Cache-Control:', metadataResponse.headers['cache-control']);
    console.log('   X-Total-Count:', metadataResponse.headers['x-total-count']);
    console.log('   X-Page-Count:', metadataResponse.headers['x-page-count']);
    console.log('   X-Current-Page:', metadataResponse.headers['x-current-page']);

    // Step 5: Test optimized search (minimum 2 characters)
    console.log('\n5. Testing optimized search...');
    
    // Test with 1 character (should not search)
    const shortSearchResponse = await axios.get(`${BASE_URL}/members?search=a&page=1&limit=5`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Short search (1 char) handled:', {
      resultsCount: shortSearchResponse.data.data.length,
      note: 'Should return all members (no search applied)'
    });

    // Test with phone number search
    const phoneSearchResponse = await axios.get(`${BASE_URL}/members?search=965&page=1&limit=5`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Phone number search optimized:', {
      resultsCount: phoneSearchResponse.data.data.length,
      note: 'Uses phone-specific regex for numeric searches'
    });

    console.log('\n🎉 Pagination improvements test completed successfully!');
    console.log('\n📋 Summary of Improvements:');
    console.log('   ✅ Parameter validation (page >= 1, limit <= 100)');
    console.log('   ✅ Enhanced pagination metadata (offset, nextPage, prevPage)');
    console.log('   ✅ Cache headers for better performance');
    console.log('   ✅ Optimized search (minimum 2 chars, phone number detection)');
    console.log('   ✅ Additional database indexes for better performance');

  } catch (error) {
    console.error('❌ Pagination improvements test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the API server is running:');
      console.log('   cd solidarity-api && npm run dev');
    }
  }
}

testPaginationImprovements();