# Updated Meetings API Documentation

## Overview

The updated Meetings API provides comprehensive support for both regular meetings and monthly training series with session management, attendance tracking, and reporting capabilities.

## Key Features

### 1. **Enhanced Meeting Views**
- Meeting list with session information and completion statistics
- Detailed meeting view with full session data and user permissions
- Dashboard statistics for quick overview
- Creation form data with role-based options

### 2. **Role-Based Functionality**
- **State Admins**: Full access to create, manage, and view all meetings
- **District Admins**: Create and manage meetings for their district
- **Group Admins**: View assigned meetings, manage session attendance, mark completion
- **Members**: View meetings they're invited to

### 3. **Session Management**
- Auto-initialization of member attendance lists
- Guest participant management
- File uploads per session
- Session completion tracking

## Updated API Endpoints

### Meeting Management

#### 1. Get Creation Form Data
```
GET /api/meetings/create-data
```
**Access:** State Admin, District Admin

**Response:**
```json
{
  "success": true,
  "data": {
    "districts": [...],
    "groups": [...],
    "meetingTypes": [
      { "value": "general", "label": "General Meeting" },
      { "value": "monthly_series", "label": "Monthly Training Series" }
    ],
    "targetAudienceOptions": [...],
    "monthOptions": [...],
    "yearOptions": [...],
    "defaults": {
      "currentMonth": 10,
      "currentYear": 2024,
      "defaultDuration": 60,
      "defaultTargetAudience": "all"
    },
    "userInfo": {
      "role": "state_admin",
      "canCreateForAllDistricts": true
    }
  }
}
```

#### 2. Get Dashboard Statistics
```
GET /api/meetings/dashboard-stats
```
**Access:** All authenticated users

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalMeetings": 15,
      "upcomingMeetings": 5,
      "thisMonthMeetings": 3,
      "monthlySeriesMeetings": 2
    },
    "sessionStats": {
      "total": 12,
      "completed": 8,
      "pending": 4,
      "completionRate": "66.7"
    },
    "recentMeetings": [...],
    "upcomingSessions": [...],
    "userRole": "group_admin"
  }
}
```

#### 3. Enhanced Meeting List
```
GET /api/meetings
```
**Access:** All authenticated users

**Enhanced Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "meeting_id",
      "title": "January 2024 Leadership Training",
      "meetingType": "monthly_series",
      "monthlyDetails": {
        "month": 1,
        "year": 2024,
        "synopsis": "Leadership development program",
        "totalSessions": 4
      },
      "sessionInfo": {
        "totalSessions": 4,
        "completedSessions": 2,
        "upcomingSessions": 2,
        "completionRate": "50.0",
        "nextSession": {
          "title": "Communication Skills",
          "scheduledDate": "2024-01-15T10:00:00.000Z"
        }
      },
      "userInfo": {
        "canEdit": false,
        "canManageAttendance": true,
        "canViewReports": false
      }
    }
  ],
  "pagination": {...}
}
```

#### 4. Enhanced Meeting Detail
```
GET /api/meetings/:id
```
**Access:** Invited users

**Enhanced Response:**
```json
{
  "success": true,
  "data": {
    "_id": "meeting_id",
    "title": "January 2024 Leadership Training",
    "meetingType": "monthly_series",
    "monthlyDetails": {...},
    "sessions": [
      {
        "_id": "session_id",
        "sessionNumber": 1,
        "title": "Leadership Fundamentals",
        "scheduledDate": "2024-01-05T10:00:00.000Z",
        "sessionStatus": "completed",
        "memberAttendance": [
          {
            "member": {
              "name": "John Doe",
              "phone": "+919876543210"
            },
            "status": "present",
            "markedBy": {...},
            "markedAt": "2024-01-05T10:30:00.000Z"
          }
        ],
        "guestAttendance": [...]
      }
    ],
    "sessionSummary": {
      "totalSessions": 4,
      "completedSessions": 1,
      "upcomingSessions": 3,
      "completionRate": "25.0",
      "overallAttendanceRate": "85.5"
    },
    "userPermissions": {
      "canEdit": false,
      "canManageAttendance": true,
      "canMarkComplete": true,
      "canAddGuests": true,
      "canUploadFiles": true
    },
    "groupMembers": [
      {
        "name": "Member Name",
        "phone": "+919876543210",
        "status": "Active"
      }
    ]
  }
}
```

### Session Management

#### 5. Get Meeting Sessions
```
GET /api/meetings/:id/sessions
```
**Access:** Invited users
- Auto-initializes member attendance for group admins
- Returns complete session data with attendance

#### 6. Mark Member Attendance
```
POST /api/meetings/:id/sessions/:sessionId/member-attendance
```
**Access:** Group Admin, District Admin, State Admin

**Request:**
```json
{
  "memberId": "member_id",
  "status": "present", // present, absent, late, excused
  "notes": "Active participant"
}
```

#### 7. Add Guest Participant
```
POST /api/meetings/:id/sessions/:sessionId/add-guest
```
**Access:** Group Admin, District Admin, State Admin

**Request:**
```json
{
  "name": "Guest Name",
  "phone": "9876543210",
  "organization": "Local NGO",
  "status": "present",
  "notes": "Special speaker"
}
```

#### 8. Mark Session Complete
```
POST /api/meetings/:id/sessions/:sessionId/complete
```
**Access:** Group Admin, District Admin, State Admin

**Response:**
```json
{
  "success": true,
  "message": "Session marked as completed successfully",
  "data": {
    "sessionStatus": "completed",
    "completedBy": "Group Admin Name",
    "completedAt": "2024-01-05T12:00:00.000Z",
    "attendanceStats": {
      "members": {
        "total": 25,
        "present": 20,
        "absent": 3,
        "late": 1,
        "excused": 1
      },
      "guests": {
        "total": 2,
        "present": 2
      },
      "overall": {
        "totalParticipants": 27,
        "totalPresent": 23,
        "attendanceRate": "85.2"
      }
    }
  }
}
```

### Reporting

#### 9. Detailed Attendance Report
```
GET /api/meetings/:id/attendance-report
```
**Access:** State Admin, District Admin

**Response:**
```json
{
  "success": true,
  "data": {
    "meeting": {...},
    "overallStats": {
      "totalSessions": 4,
      "completedSessions": 2,
      "pendingSessions": 2,
      "completionRate": "50.0"
    },
    "sessionStats": [
      {
        "sessionId": "session_id",
        "sessionNumber": 1,
        "title": "Leadership Fundamentals",
        "status": "completed",
        "stats": {...}
      }
    ],
    "groupStats": [
      {
        "groupName": "Group A",
        "totalMembers": 15,
        "totalPresent": 12,
        "totalAbsent": 2,
        "totalLate": 1
      }
    ]
  }
}
```

#### 10. Summary Report
```
GET /api/meetings/reports/summary?month=1&year=2024
```
**Access:** State Admin, District Admin

**Query Parameters:**
- `month` (optional): Filter by month (1-12)
- `year` (optional): Filter by year
- `district` (optional): Filter by district ID
- `group` (optional): Filter by group ID

## Frontend Integration Guide

### 1. Meeting Creation Form

```javascript
// Get form data
const response = await fetch('/api/meetings/create-data', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { districts, groups, meetingTypes, targetAudienceOptions } = response.data;

// Create monthly meeting
const meetingData = {
  title: "Leadership Training Program",
  synopsis: "Comprehensive leadership development...",
  month: 1,
  year: 2024,
  targetAudience: "all",
  sessions: [
    {
      title: "Session 1: Fundamentals",
      description: "Basic leadership principles",
      scheduledDate: "2024-01-05T10:00:00.000Z",
      duration: 120
    }
  ]
};

await fetch('/api/meetings/monthly', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(meetingData)
});
```

### 2. Dashboard Statistics

```javascript
// Get dashboard data
const stats = await fetch('/api/meetings/dashboard-stats', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Display overview cards
const { overview, sessionStats, recentMeetings } = stats.data;
```

### 3. Session Management (Group Admin)

```javascript
// Get meeting with sessions
const meeting = await fetch(`/api/meetings/${meetingId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { sessions, groupMembers, userPermissions } = meeting.data;

// Mark member attendance
await fetch(`/api/meetings/${meetingId}/sessions/${sessionId}/member-attendance`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    memberId: member._id,
    status: 'present',
    notes: 'Active participant'
  })
});

// Add guest
await fetch(`/api/meetings/${meetingId}/sessions/${sessionId}/add-guest`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Guest Name',
    phone: '9876543210',
    organization: 'Local NGO'
  })
});

// Mark session complete
await fetch(`/api/meetings/${meetingId}/sessions/${sessionId}/complete`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### 4. File Upload

```javascript
// Upload session file
const formData = new FormData();
formData.append('file', fileInput.files[0]);

await fetch(`/api/meetings/${meetingId}/sessions/${sessionId}/upload`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

### 5. Reports (State/District Admin)

```javascript
// Get detailed report
const report = await fetch(`/api/meetings/${meetingId}/attendance-report`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Get summary report
const summary = await fetch('/api/meetings/reports/summary?month=1&year=2024', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## User Experience Flow

### For State/District Admins:
1. Use `/create-data` to populate meeting creation form
2. Create monthly meetings with `/monthly` endpoint
3. Monitor progress with `/dashboard-stats`
4. View detailed reports with `/attendance-report`

### For Group Admins:
1. View assigned meetings with enhanced meeting list
2. Access meeting details with auto-initialized attendance
3. Mark member attendance and add guests
4. Upload session materials
5. Mark sessions as completed

### For Members:
1. View meetings they're invited to
2. See session schedules and completion status
3. Access uploaded materials (if implemented)

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error message"
    }
  ]
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error