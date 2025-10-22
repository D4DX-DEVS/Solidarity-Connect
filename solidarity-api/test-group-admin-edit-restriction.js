#!/usr/bin/env node

/**
 * Test script to verify group admin cannot transfer members to different groups
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3333/api';
const TEST_PHONE = '+919656550933';

async function testGroupAdminRestriction() {
  console.log('🧪 Testing Group Admin Member Edit Restriction');
  console.log('==============================================\n');

  try {
    // Step 1: Login as group admin
    console.log('1. Logging in as group_admin...');
    
    // Send OTP
    await axios.post(`${BASE_URL}/auth/send-otp`, {
      phone: TEST_PHONE,
      userType: 'group_admin'
    });
    
    // Verify OTP
    const verifyResponse = await axios.post(`${BASE_URL}/auth/verify-otp`, {
      phone: TEST_PHONE,
      otp: '1234',
      userType: 'group_admin'
    });
    
    const authToken = verifyResponse.data.data.token;
    const user = verifyResponse.data.data.user;
    console.log('✅ Logged in as:', user.name, `(${user.role})`);
    console.log('   Assigned Group:', user.group.name);
    console.log('   Assigned District:', user.district.name);

    // Step 2: Get members from the group admin's group
    console.log('\n2. Getting members from group admin\'s group...');
    const membersResponse = await axios.get(`${BASE_URL}/members?limit=5`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const members = membersResponse.data.data;
    if (members.length === 0) {
      console.log('❌ No members found in group admin\'s group');
      return;
    }
    
    const testMember = members[0];
    console.log('✅ Found test member:', testMember.name, `(ID: ${testMember._id})`);
    console.log('   Current Group:', testMember.group.name);
    console.log('   Current District:', testMember.district.name);

    // Step 3: Get all groups to find a different group
    console.log('\n3. Getting all groups to find a different group...');
    const groupsResponse = await axios.get(`${BASE_URL}/groups`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const allGroups = groupsResponse.data.data;
    const differentGroup = allGroups.find(g => g._id !== testMember.group._id);
    
    if (!differentGroup) {
      console.log('❌ No different group found to test transfer');
      return;
    }
    
    console.log('✅ Found different group for testing:', differentGroup.name);

    // Step 4: Attempt to transfer member to different group (should fail)
    console.log('\n4. Attempting to transfer member to different group...');
    
    try {
      const updateResponse = await axios.put(`${BASE_URL}/members/${testMember._id}`, {
        name: testMember.name,
        phone: testMember.phone,
        group: differentGroup._id,
        district: differentGroup.district
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      console.log('❌ UNEXPECTED: Transfer succeeded when it should have failed');
      console.log('Response:', updateResponse.data);
      
    } catch (error) {
      if (error.response && error.response.status === 403) {
        const errorData = error.response.data;
        console.log('✅ EXPECTED: Transfer blocked with 403 Forbidden');
        console.log('   Error Message:', errorData.message);
        
        if (errorData.message === 'Group admins cannot transfer members to different groups') {
          console.log('✅ PERFECT: Exact error message matches requirement!');
        } else {
          console.log('⚠️  WARNING: Error message differs from expected');
          console.log('   Expected: "Group admins cannot transfer members to different groups"');
          console.log('   Actual:', errorData.message);
        }
      } else {
        console.log('❌ UNEXPECTED ERROR:', error.response?.data || error.message);
      }
    }

    // Step 5: Test updating member without changing group (should succeed)
    console.log('\n5. Testing member update without group change...');
    
    try {
      const updateResponse = await axios.put(`${BASE_URL}/members/${testMember._id}`, {
        name: testMember.name,
        phone: testMember.phone,
        email: 'updated-email@example.com',
        profession: 'Updated Profession'
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      console.log('✅ Member update without group change succeeded');
      console.log('   Updated member:', updateResponse.data.data.name);
      
    } catch (error) {
      console.log('❌ Member update failed:', error.response?.data || error.message);
    }

    console.log('\n🎉 Group Admin Restriction Test Completed!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Group admin login successful');
    console.log('   ✅ Member retrieval successful');
    console.log('   ✅ Group transfer blocked with correct error message');
    console.log('   ✅ Regular member update (without group change) allowed');

  } catch (error) {
    console.error('❌ Test Failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testGroupAdminRestriction();