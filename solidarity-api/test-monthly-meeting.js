import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const API_BASE_URL = 'http://localhost:3000/api';

// Test tokens for different roles
const STATE_ADMIN_TOKEN = 'state-admin-token-here';
const DISTRICT_ADMIN_TOKEN = 'district-admin-token-here';
const GROUP_ADMIN_TOKEN = 'group-admin-token-here';

// Test data for creating a monthly meeting
const monthlyMeetingData = {
  title: "January 2024 Monthly Training Sessions",
  synopsis: "Comprehensive monthly training program covering leadership development, community engagement, and organizational skills. This series will include multiple sessions throughout the month to ensure maximum participation and learning outcomes.",
  month: 1,
  year: 2024,
  targetAudience: "all",
  venue: "Community Center Hall",
  sessions: [
    {
      title: "Leadership Development Workshop",
      description: "Interactive session focusing on developing leadership skills and team management capabilities.",
      scheduledDate: "2024-01-05T10:00:00.000Z",
      duration: 120
    },
    {
      title: "Community Engagement Strategies",
      description: "Learn effective methods for community outreach and engagement programs.",
      scheduledDate: "2024-01-12T14:00:00.000Z",
      duration: 90
    },
    {
      title: "Financial Management Training",
      description: "Understanding budget management and financial planning for community projects.",
      scheduledDate: "2024-01-19T10:00:00.000Z",
      duration: 150
    },
    {
      title: "Digital Communication Tools",
      description: "Training on using modern communication tools and social media for community building.",
      scheduledDate: "2024-01-26T16:00:00.000Z",
      duration: 90
    }
  ]
};

async function testCompleteWorkflow() {
  try {
    console.log('🚀 Testing Complete Monthly Meeting Workflow...\n');

    // STEP 1: State Admin creates monthly meeting
    console.log('=== STEP 1: State Admin Creates Monthly Meeting ===');
    const stateHeaders = {
      'Authorization': `Bearer ${STATE_ADMIN_TOKEN}`,
      'Content-Type': 'application/json'
    };

    const createResponse = await axios.post(
      `${API_BASE_URL}/meetings/monthly`,
      monthlyMeetingData,
      { headers: stateHeaders }
    );
    
    console.log('✅ Monthly meeting created successfully!');
    console.log('Meeting ID:', createResponse.data.data.meeting._id);
    console.log('Sessions created:', createResponse.data.data.sessions.length);
    
    const meetingId = createResponse.data.data.meeting._id;
    const sessionId = createResponse.data.data.sessions[0]._id;

    // STEP 2: Group Admin views sessions (auto-initializes member attendance)
    console.log('\n=== STEP 2: Group Admin Views Sessions ===');
    const groupHeaders = {
      'Authorization': `Bearer ${GROUP_ADMIN_TOKEN}`,
      'Content-Type': 'application/json'
    };

    const sessionsResponse = await axios.get(
      `${API_BASE_URL}/meetings/${meetingId}/sessions`,
      { headers: groupHeaders }
    );
    
    console.log('✅ Sessions fetched successfully!');
    console.log('Total sessions:', sessionsResponse.data.data.length);
    console.log('Member attendance initialized for group');

    // STEP 3: Group Admin marks member attendance
    console.log('\n=== STEP 3: Group Admin Marks Member Attendance ===');
    
    // Example member IDs (replace with actual member IDs)
    const memberIds = ['member_id_1', 'member_id_2', 'member_id_3'];
    
    for (let i = 0; i < memberIds.length; i++) {
      const attendanceData = {
        memberId: memberIds[i],
        status: i === 0 ? 'present' : i === 1 ? 'late' : 'absent',
        notes: `Attendance marked for member ${i + 1}`
      };
      
      try {
        const memberAttendanceResponse = await axios.post(
          `${API_BASE_URL}/meetings/${meetingId}/sessions/${sessionId}/member-attendance`,
          attendanceData,
          { headers: groupHeaders }
        );
        console.log(`✅ Member ${i + 1} attendance marked as ${attendanceData.status}`);
      } catch (error) {
        console.log(`⚠️ Could not mark attendance for member ${i + 1} (member may not exist)`);
      }
    }

    // STEP 4: Group Admin adds guests
    console.log('\n=== STEP 4: Group Admin Adds Guests ===');
    
    const guestData = {
      name: 'John Doe',
      phone: '9876543210',
      organization: 'Community Leader',
      status: 'present',
      notes: 'Special guest speaker'
    };
    
    const guestResponse = await axios.post(
      `${API_BASE_URL}/meetings/${meetingId}/sessions/${sessionId}/add-guest`,
      guestData,
      { headers: groupHeaders }
    );
    
    console.log('✅ Guest added successfully!');
    console.log('Updated attendance stats:', guestResponse.data.data.attendanceStats);

    // STEP 5: Group Admin marks session as completed
    console.log('\n=== STEP 5: Group Admin Marks Session as Completed ===');
    
    const completeResponse = await axios.post(
      `${API_BASE_URL}/meetings/${meetingId}/sessions/${sessionId}/complete`,
      {},
      { headers: groupHeaders }
    );
    
    console.log('✅ Session marked as completed!');
    console.log('Completion details:', {
      status: completeResponse.data.data.sessionStatus,
      completedBy: completeResponse.data.data.completedBy,
      completedAt: completeResponse.data.data.completedAt
    });

    // STEP 6: State Admin views attendance report
    console.log('\n=== STEP 6: State Admin Views Attendance Report ===');
    
    const reportResponse = await axios.get(
      `${API_BASE_URL}/meetings/${meetingId}/attendance-report`,
      { headers: stateHeaders }
    );
    
    console.log('✅ Attendance report generated successfully!');
    console.log('Overall stats:', reportResponse.data.data.overallStats);
    console.log('Group stats:', reportResponse.data.data.groupStats);

    // STEP 7: State Admin views meetings summary
    console.log('\n=== STEP 7: State Admin Views Meetings Summary ===');
    
    const summaryResponse = await axios.get(
      `${API_BASE_URL}/meetings/reports/summary?month=1&year=2024`,
      { headers: stateHeaders }
    );
    
    console.log('✅ Meetings summary fetched successfully!');
    console.log('Total meetings:', summaryResponse.data.data.length);

    console.log('\n🎉 Complete workflow test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Test individual functions
async function testGroupAdminFunctions() {
  console.log('🧪 Testing Group Admin Functions...\n');
  
  const groupHeaders = {
    'Authorization': `Bearer ${GROUP_ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
  };

  const meetingId = 'your-meeting-id-here';
  const sessionId = 'your-session-id-here';

  try {
    // Test marking member attendance
    console.log('1. Testing member attendance marking...');
    const memberAttendance = await axios.post(
      `${API_BASE_URL}/meetings/${meetingId}/sessions/${sessionId}/member-attendance`,
      {
        memberId: 'member-id-here',
        status: 'present',
        notes: 'Active participant'
      },
      { headers: groupHeaders }
    );
    console.log('✅ Member attendance marked');

    // Test adding guest
    console.log('2. Testing guest addition...');
    const guestAdd = await axios.post(
      `${API_BASE_URL}/meetings/${meetingId}/sessions/${sessionId}/add-guest`,
      {
        name: 'Jane Smith',
        phone: '9876543211',
        organization: 'Local NGO',
        status: 'present'
      },
      { headers: groupHeaders }
    );
    console.log('✅ Guest added');

    // Test session completion
    console.log('3. Testing session completion...');
    const sessionComplete = await axios.post(
      `${API_BASE_URL}/meetings/${meetingId}/sessions/${sessionId}/complete`,
      {},
      { headers: groupHeaders }
    );
    console.log('✅ Session completed');

  } catch (error) {
    console.error('❌ Group admin test failed:', error.response?.data || error.message);
  }
}

// Example of how to create a monthly meeting via curl
console.log(`
📋 Example curl command to create monthly meeting:

curl -X POST ${API_BASE_URL}/meetings/monthly \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(monthlyMeetingData, null, 2)}'

📋 Example curl command to upload file to session:

curl -X POST ${API_BASE_URL}/meetings/MEETING_ID/sessions/SESSION_ID/upload \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -F "file=@/path/to/your/file.pdf"
`);

// Uncomment the line below to run the test
// testMonthlyMeetingAPI();

export { testMonthlyMeetingAPI, monthlyMeetingData };