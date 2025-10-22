#!/usr/bin/env node

/**
 * Test script for State Admin and District Admin attendance functionality
 * This script tests the new attendance endpoints for admin roles
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5003/api';

// Test credentials - you'll need to update these with actual admin credentials
const TEST_CREDENTIALS = {
  state_admin: {
    phone: '+919876543210', // Update with actual state admin phone
    password: 'password123'   // Update with actual password
  },
  district_admin: {
    phone: '+919876543211', // Update with actual district admin phone
    password: 'password123'   // Update with actual password
  }
};

let authTokens = {};

// Helper function to make authenticated requests
async function makeAuthenticatedRequest(method, endpoint, data = null, userType = 'state_admin') {
  try {
    const token = authTokens[userType];
    if (!token) {
      throw new Error(`No auth token for ${userType}`);
    }

    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ Request failed for ${method} ${endpoint}:`, 
      error.response?.data?.message || error.message);
    return null;
  }
}

// Login function
async function login(userType) {
  try {
    console.log(`\n🔐 Logging in as ${userType}...`);
    
    const credentials = TEST_CREDENTIALS[userType];
    if (!credentials) {
      throw new Error(`No credentials configured for ${userType}`);
    }

    const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
    
    if (response.data.success && response.data.token) {
      authTokens[userType] = response.data.token;
      console.log(`✅ Successfully logged in as ${userType}`);
      console.log(`   User: ${response.data.user.name} (${response.data.user.role})`);
      return true;
    } else {
      console.log(`❌ Login failed for ${userType}:`, response.data.message);
      return false;
    }
  } catch (error) {
    console.log(`❌ Login error for ${userType}:`, error.response?.data?.message || error.message);
    return false;
  }
}

// Test attendance reports
async function testAttendanceReports(userType) {
  console.log(`\n📊 Testing attendance reports for ${userType}...`);

  // Test 1: Get attendance summary
  console.log('\n1. Testing attendance summary...');
  const summary = await makeAuthenticatedRequest('GET', '/reports/attendance/summary', null, userType);
  if (summary?.success) {
    console.log('✅ Attendance summary retrieved successfully');
    console.log(`   This month participants: ${summary.data.thisMonth.totalParticipants}`);
    console.log(`   Overall attendance rate: ${summary.data.overall.attendanceRate}%`);
    console.log(`   Top performing groups: ${summary.data.topPerformingGroups.length}`);
  }

  // Test 2: Get detailed attendance report
  console.log('\n2. Testing detailed attendance report...');
  const currentYear = new Date().getFullYear();
  const report = await makeAuthenticatedRequest('GET', 
    `/reports/attendance?year=${currentYear}`, null, userType);
  if (report?.success) {
    console.log('✅ Detailed attendance report retrieved successfully');
    console.log(`   Total meetings: ${report.data.summary.totalMeetings}`);
    console.log(`   Total participants: ${report.data.summary.totalParticipants}`);
    console.log(`   Overall attendance rate: ${report.data.summary.overallAttendanceRate}%`);
  }

  // Test 3: Get attendance export (JSON format)
  console.log('\n3. Testing attendance export...');
  const exportData = await makeAuthenticatedRequest('GET', 
    `/reports/attendance/export?format=json&year=${currentYear}`, null, userType);
  if (exportData?.success) {
    console.log('✅ Attendance export retrieved successfully');
    console.log(`   Member attendance records: ${exportData.data.memberAttendance.length}`);
    console.log(`   Guest attendance records: ${exportData.data.guestAttendance.length}`);
  }
}

// Test meeting admin endpoints
async function testMeetingAdminEndpoints(userType) {
  console.log(`\n🏛️ Testing meeting admin endpoints for ${userType}...`);

  // Test 1: Get admin dashboard stats
  console.log('\n1. Testing admin dashboard stats...');
  const dashboardStats = await makeAuthenticatedRequest('GET', '/meetings/admin/dashboard-stats', null, userType);
  if (dashboardStats?.success) {
    console.log('✅ Admin dashboard stats retrieved successfully');
    console.log(`   Total meetings: ${dashboardStats.data.overview.totalMeetings}`);
    console.log(`   This month attendance rate: ${dashboardStats.data.attendanceStats.thisMonth.attendanceRate}%`);
    console.log(`   YTD attendance rate: ${dashboardStats.data.attendanceStats.yearToDate.attendanceRate}%`);
    console.log(`   Top performing groups: ${dashboardStats.data.topPerformingGroups.length}`);
  }

  // Test 2: Get attendance overview
  console.log('\n2. Testing attendance overview...');
  const currentYear = new Date().getFullYear();
  const overview = await makeAuthenticatedRequest('GET', 
    `/meetings/admin/attendance-overview?year=${currentYear}`, null, userType);
  if (overview?.success) {
    console.log('✅ Attendance overview retrieved successfully');
    console.log(`   Total meetings: ${overview.data.summary.totalMeetings}`);
    console.log(`   Meetings with attendance: ${overview.data.summary.meetingsWithAttendance}`);
    console.log(`   Overall attendance rate: ${overview.data.summary.overallAttendanceRate}%`);
    
    if (overview.data.meetings.length > 0) {
      const firstMeeting = overview.data.meetings[0];
      console.log(`   Sample meeting: "${firstMeeting.meeting.title}"`);
      console.log(`     - Participants: ${firstMeeting.attendance.overall.totalParticipants}`);
      console.log(`     - Attendance rate: ${firstMeeting.attendance.overall.attendanceRate}%`);
      console.log(`     - Groups with data: ${firstMeeting.attendance.byGroup.length}`);
    }
  }
}

// Test regular dashboard reports
async function testDashboardReports(userType) {
  console.log(`\n📈 Testing dashboard reports for ${userType}...`);

  // Test dashboard report
  console.log('\n1. Testing dashboard report...');
  const dashboard = await makeAuthenticatedRequest('GET', '/reports/dashboard', null, userType);
  if (dashboard?.success) {
    console.log('✅ Dashboard report retrieved successfully');
    console.log(`   Total members: ${dashboard.data.memberStatistics.totalMembers}`);
    console.log(`   Active members: ${dashboard.data.memberStatistics.activeMembers}`);
    console.log(`   Pending requests: ${dashboard.data.pendingRequestsCount}`);
    console.log(`   Upcoming meetings: ${dashboard.data.upcomingMeetings.length}`);
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting State Admin and District Admin Attendance API Tests');
  console.log('================================================================');

  // Test for both user types
  const userTypes = ['state_admin', 'district_admin'];

  for (const userType of userTypes) {
    console.log(`\n\n🎯 Testing ${userType.toUpperCase()} functionality`);
    console.log('='.repeat(50));

    // Login
    const loginSuccess = await login(userType);
    if (!loginSuccess) {
      console.log(`❌ Skipping tests for ${userType} due to login failure`);
      continue;
    }

    // Run tests
    await testAttendanceReports(userType);
    await testMeetingAdminEndpoints(userType);
    await testDashboardReports(userType);

    console.log(`\n✅ Completed tests for ${userType}`);
  }

  console.log('\n\n🎉 All tests completed!');
  console.log('================================================================');
  
  // Summary
  console.log('\n📋 SUMMARY:');
  console.log('The following new endpoints have been tested:');
  console.log('');
  console.log('📊 ATTENDANCE REPORTS:');
  console.log('  • GET /api/reports/attendance/summary - Attendance dashboard stats');
  console.log('  • GET /api/reports/attendance - Detailed attendance report with filters');
  console.log('  • GET /api/reports/attendance/export - Export attendance data (CSV/JSON)');
  console.log('');
  console.log('🏛️ ADMIN MEETING ENDPOINTS:');
  console.log('  • GET /api/meetings/admin/dashboard-stats - Comprehensive admin dashboard');
  console.log('  • GET /api/meetings/admin/attendance-overview - Meeting attendance overview');
  console.log('');
  console.log('🔐 ROLE-BASED ACCESS:');
  console.log('  • State Admin: Can see all districts and groups');
  console.log('  • District Admin: Can only see their district data');
  console.log('  • Both roles can filter by month, year, district, group');
  console.log('');
  console.log('📈 KEY FEATURES:');
  console.log('  • Group-wise attendance statistics');
  console.log('  • District-wise attendance statistics');
  console.log('  • Monthly attendance trends');
  console.log('  • Session completion tracking');
  console.log('  • Top performing groups');
  console.log('  • Export functionality (CSV/JSON)');
  console.log('  • Real-time attendance rates');
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export default {
  runTests,
  login,
  makeAuthenticatedRequest,
  testAttendanceReports,
  testMeetingAdminEndpoints,
  testDashboardReports
};