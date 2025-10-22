#!/usr/bin/env node

/**
 * Test script to call the meetings API directly
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3333/api';

async function testMeetingsAPI() {
  try {
    console.log('Testing meetings API...');
    
    // Test without authentication first to see if endpoint exists
    try {
      const response = await axios.get(`${API_BASE_URL}/meetings`);
      console.log('✅ API responded:', response.status);
    } catch (error) {
      if (error.response) {
        console.log('📡 API endpoint exists, status:', error.response.status);
        console.log('Response:', error.response.data);
        
        if (error.response.status === 401) {
          console.log('✅ Authentication required (expected)');
        }
      } else {
        console.log('❌ Cannot connect to API:', error.message);
        return;
      }
    }

    // Test health endpoint
    try {
      const healthResponse = await axios.get(`${API_BASE_URL}/../health`);
      console.log('✅ Health check:', healthResponse.data);
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
    }

    // Test with a mock JWT token (this will fail but show us the endpoint structure)
    try {
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3NjE4ZjU4YzQyZjQwMDAxMjM0NTY3OCIsInJvbGUiOiJncm91cF9hZG1pbiIsImlhdCI6MTczNDQ1NjE2OCwiZXhwIjoxNzM0NTQyNTY4fQ.test';
      
      const response = await axios.get(`${API_BASE_URL}/meetings`, {
        headers: {
          'Authorization': `Bearer ${mockToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Meetings response:', response.data);
    } catch (error) {
      if (error.response) {
        console.log('📡 Meetings API response status:', error.response.status);
        console.log('Response data:', error.response.data);
      } else {
        console.log('❌ Request failed:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMeetingsAPI();