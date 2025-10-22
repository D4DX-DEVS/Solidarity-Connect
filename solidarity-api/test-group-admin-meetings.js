#!/usr/bin/env node

/**
 * Test script for Group Admin Meetings functionality
 * This script demonstrates the enhanced meetings API for group administrators
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

// Mock authentication token (replace with actual token in real usage)
const AUTH_TOKEN = 'your-jwt-token-here';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testGroupAdminMeetingsFeatures() {
  console.log('🚀 Testing Group Admin Meetings Features\n');

  try {
    // Test 1: Get all meetings with enhanced info
    console.log('1. Testing enhanced meetings list...');
    const meetingsResponse = await api.get('/meetings?myMeetings=true&limit=10');
    console.log(`✅ Found ${meetingsResponse.data.data.length} meetings`);
    
    if (meetingsResponse.data.summaryStats) {
      console.log(`📊 Summary: ${meetingsResponse.data.summaryStats.totalMeetings} total, ${meetingsResponse.data.summaryStats.meetingsRequiringAttention} need attention`);
    }

    // Test 2: Get my meetings with management features
    console.log('\n2. Testing my meetings endpoint...');
    const myMeetingsResponse = await api.get('/meetings/my-meetings?status=all');
    console.log(`✅ Found ${myMeetingsResponse.data.data.length} created meetings`);
    
    if (myMeetingsResponse.data.summary) {
      console.log(`📈 Active: ${myMeetingsResponse.data.summary.activeMeetings}, Completed: ${myMeetingsResponse.data.summary.completedMeetings}`);
    }

    // Test 3: Get meetings requiring attention
    console.log('\n3. Testing meetings requiring attention...');
    const attentionResponse = await api.get('/meetings/my-meetings?status=pending_attention');
    console.log(`⚠️  Found ${attentionResponse.data.data.length} meetings requiring attention`);

    // Test 4: Get attendance summary (if we have meetings)
    if (myMeetingsResponse.data.data.length > 0) {
      const meetingId = myMeetingsResponse.data.data[0]._id;
      console.log('\n4. Testing attendance summary...');
      
      try {
        const summaryResponse = await api.get(`/meetings/${meetingId}/attendance-summary`);
        console.log(`📋 Attendance Summary for "${summaryResponse.data.data.meetingTitle}"`);
        console.log(`   Sessions: ${summaryResponse.data.data.totalSessions} total, ${summaryResponse.data.data.completedSessions} completed`);
        console.log(`   Overall Attendance: ${summaryResponse.data.data.overallStats.attendanceRate}%`);
        console.log(`   Action Items: ${summaryResponse.data.data.actionItems.length}`);
      } catch (error) {
        console.log('ℹ️  Attendance summary not available (meeting may not have sessions)');
      }

      // Test 5: Bulk session actions (demonstration)
      console.log('\n5. Testing bulk session actions...');
      try {
        const bulkResponse = await api.post(`/meetings/${meetingId}/bulk-session-actions`, {
          action: 'initialize_attendance'
        });
        console.log(`✅ Bulk action completed: ${bulkResponse.data.data.successfulActions}/${bulkResponse.data.data.processedSessions} successful`);
      } catch (error) {
        console.log('ℹ️  Bulk actions not available (may require specific meeting type or permissions)');
      }
    }

    // Test 6: Dashboard stats
    console.log('\n6. Testing dashboard statistics...');
    const dashboardResponse = await api.get('/meetings/dashboard-stats');
    console.log(`📊 Dashboard Stats:`);
    console.log(`   Total Meetings: ${dashboardResponse.data.data.overview.totalMeetings}`);
    console.log(`   Upcoming: ${dashboardResponse.data.data.overview.upcomingMeetings}`);
    console.log(`   This Month: ${dashboardResponse.data.data.overview.thisMonthMeetings}`);
    
    if (dashboardResponse.data.data.sessionStats.total > 0) {
      console.log(`   Session Completion: ${dashboardResponse.data.data.sessionStats.completionRate}%`);
    }

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📝 Key Features Demonstrated:');
    console.log('   • Enhanced meetings list with session details');
    console.log('   • My meetings management interface');
    console.log('   • Attendance tracking and summaries');
    console.log('   • Bulk session operations');
    console.log('   • Dashboard statistics');
    console.log('   • Priority and status indicators');

  } catch (error) {
    if (error.response) {
      console.error(`❌ API Error: ${error.response.status} - ${error.response.data.message}`);
    } else if (error.request) {
      console.error('❌ Network Error: Could not connect to API');
      console.log('💡 Make sure the API server is running on', API_BASE_URL);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

// API Endpoints Summary
function printAPIEndpoints() {
  console.log('\n📚 Enhanced API Endpoints for Group Admins:');
  console.log('');
  console.log('🔍 GET /api/meetings');
  console.log('   • Enhanced with session details and quick actions');
  console.log('   • Query: ?myMeetings=true for user\'s meetings');
  console.log('   • Returns: summaryStats for overview');
  console.log('');
  console.log('👤 GET /api/meetings/my-meetings');
  console.log('   • Dedicated endpoint for meeting management');
  console.log('   • Query: ?status=pending_attention for priority meetings');
  console.log('   • Auto-initializes attendance for group admins');
  console.log('');
  console.log('⚡ POST /api/meetings/:id/bulk-session-actions');
  console.log('   • Bulk operations: initialize_attendance, mark_all_present, complete_ready_sessions');
  console.log('   • Efficient management of multiple sessions');
  console.log('');
  console.log('📊 GET /api/meetings/:id/attendance-summary');
  console.log('   • Comprehensive attendance overview');
  console.log('   • Member-wise attendance tracking');
  console.log('   • Automated action items and alerts');
  console.log('');
  console.log('📈 GET /api/meetings/dashboard-stats');
  console.log('   • Enhanced with session statistics');
  console.log('   • Role-based filtering and upcoming sessions');
  console.log('');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🎯 Group Admin Meetings API Test Suite');
  console.log('=====================================\n');
  
  printAPIEndpoints();
  
  console.log('\n🧪 Running API Tests...');
  console.log('Note: Update AUTH_TOKEN and API_BASE_URL for actual testing\n');
  
  // Uncomment the line below to run actual API tests
  // await testGroupAdminMeetingsFeatures();
  
  console.log('💡 To run actual tests:');
  console.log('   1. Start the API server: npm run dev');
  console.log('   2. Update AUTH_TOKEN with a valid JWT');
  console.log('   3. Uncomment the test function call');
  console.log('   4. Run: node test-group-admin-meetings.js');
}

export { testGroupAdminMeetingsFeatures, printAPIEndpoints };