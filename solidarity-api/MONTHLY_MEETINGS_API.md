# Monthly Meetings API Documentation

## Overview

The Monthly Meetings API provides a complete workflow for managing monthly meeting programs:

1. **State/District Admins** create monthly meetings with multiple sessions
2. **Group Admins** view sessions and manage attendance for their group members
3. **Group Admins** can add guest participants and mark sessions as completed
4. **State/District Admins** can view comprehensive attendance reports

## Workflow

### 1. Meeting Creation (State/District Admin)
- Create monthly meeting with synopsis and multiple sessions
- Define target audience (all, specific groups, specific districts)

### 2. Session Management (Group Admin)
- View assigned sessions with auto-initialized member attendance list
- Mark attendance for group members (present/absent/late/excused)
- Add guest participants with their details
- Mark sessions as completed when done

### 3. Reporting (State/District Admin)
- View detailed attendance reports for specific meetings
- Generate summary reports across multiple meetings
- Track completion rates and participation statistics

## New Endpoints

### 1. Create Monthly Meeting with Sessions

**POST** `/api/meetings/monthly`

Creates a monthly meeting with multiple sessions for the specified month.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "January 2024 Monthly Training Sessions",
  "synopsis": "Comprehensive monthly training program covering leadership development...",
  "month": 1,
  "year": 2024,
  "targetAudience": "all",
  "targetGroups": ["group_id_1", "group_id_2"], // optional, for specific groups
  "targetDistricts": ["district_id_1"], // optional, for specific districts
  "venue": "Community Center Hall",
  "sessions": [
    {
      "title": "Leadership Development Workshop",
      "description": "Interactive session focusing on developing leadership skills...",
      "scheduledDate": "2024-01-05T10:00:00.000Z",
      "duration": 120
    },
    {
      "title": "Community Engagement Strategies",
      "description": "Learn effective methods for community outreach...",
      "scheduledDate": "2024-01-12T14:00:00.000Z",
      "duration": 90
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Monthly meeting with sessions created successfully",
  "data": {
    "meeting": {
      "_id": "meeting_id",
      "title": "January 2024 Monthly Training Sessions",
      "meetingType": "monthly_series",
      "monthlyDetails": {
        "month": 1,
        "year": 2024,
        "synopsis": "Comprehensive monthly training program...",
        "totalSessions": 2
      },
      "createdBy": {...},
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "sessions": [
      {
        "_id": "session_id_1",
        "meeting": "meeting_id",
        "sessionNumber": 1,
        "title": "Leadership Development Workshop",
        "description": "Interactive session focusing on...",
        "scheduledDate": "2024-01-05T10:00:00.000Z",
        "duration": 120,
        "status": "scheduled",
        "attachments": [],
        "attendance": []
      }
    ]
  }
}
```

### 2. Get Meeting Sessions

**GET** `/api/meetings/:meetingId/sessions`

Retrieves all sessions for a specific meeting.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "session_id",
      "meeting": "meeting_id",
      "sessionNumber": 1,
      "title": "Session Title",
      "description": "Session description",
      "scheduledDate": "2024-01-05T10:00:00.000Z",
      "duration": 120,
      "status": "scheduled",
      "attachments": [],
      "attendance": [],
      "createdBy": {...}
    }
  ]
}
```

### 3. Update Session

**PUT** `/api/meetings/:meetingId/sessions/:sessionId`

Updates session details.

**Request Body:**
```json
{
  "title": "Updated Session Title",
  "description": "Updated description",
  "scheduledDate": "2024-01-05T11:00:00.000Z",
  "duration": 150,
  "status": "completed"
}
```

### 4. Upload File to Session

**POST** `/api/meetings/:meetingId/sessions/:sessionId/upload`

Uploads a file attachment to a specific session.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: The file to upload (max 10MB)

**Supported File Types:**
- Documents: PDF, DOC, DOCX, TXT, XLS, XLSX, PPT, PPTX
- Images: JPEG, JPG, PNG, GIF

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "filename": "file-1234567890-123456789.pdf",
    "originalName": "meeting-agenda.pdf",
    "mimetype": "application/pdf",
    "size": 1024000,
    "uploadedAt": "2024-01-01T12:00:00.000Z",
    "uploadedBy": "user_id"
  }
}
```

### 5. Mark Member Attendance (Group Admin)

**POST** `/api/meetings/:meetingId/sessions/:sessionId/member-attendance`

Marks attendance for a group member in a specific session.

**Access:** Group Admin, District Admin, State Admin

**Request Body:**
```json
{
  "memberId": "member_id",
  "status": "present", // "present", "absent", "late", "excused"
  "notes": "Optional notes about attendance"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Member attendance marked successfully",
  "data": {
    "attendanceStats": {
      "members": {
        "total": 15,
        "present": 12,
        "absent": 2,
        "late": 1,
        "excused": 0
      },
      "guests": {
        "total": 2,
        "present": 2
      },
      "overall": {
        "totalParticipants": 17,
        "totalPresent": 15,
        "attendanceRate": "88.2"
      }
    }
  }
}
```

### 6. Add Guest Participant (Group Admin)

**POST** `/api/meetings/:meetingId/sessions/:sessionId/add-guest`

Adds a guest participant to a session.

**Access:** Group Admin, District Admin, State Admin

**Request Body:**
```json
{
  "name": "Guest Name",
  "phone": "9876543210", // optional
  "organization": "Organization Name", // optional
  "status": "present", // "present", "absent", "late"
  "notes": "Optional notes"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Guest added successfully",
  "data": {
    "attendanceStats": { /* updated stats */ }
  }
}
```

### 7. Mark Session as Completed (Group Admin)

**POST** `/api/meetings/:meetingId/sessions/:sessionId/complete`

Marks a session as completed.

**Access:** Group Admin, District Admin, State Admin

**Response:**
```json
{
  "success": true,
  "message": "Session marked as completed successfully",
  "data": {
    "sessionStatus": "completed",
    "completedBy": "Admin Name",
    "completedAt": "2024-01-05T12:00:00.000Z",
    "attendanceStats": { /* final stats */ }
  }
}
```

### 8. Get Attendance Report (State/District Admin)

**GET** `/api/meetings/:meetingId/attendance-report`

Gets detailed attendance report for a meeting.

**Access:** State Admin, District Admin

**Response:**
```json
{
  "success": true,
  "data": {
    "meeting": { /* meeting details */ },
    "overallStats": {
      "totalSessions": 4,
      "completedSessions": 3,
      "pendingSessions": 1,
      "totalMembers": 15,
      "totalGuests": 2,

## Data Models

### Meeting Model (Updated)

The Meeting model now includes support for monthly series:

```javascript
{
  meetingType: "monthly_series", // new type
  monthlyDetails: {
    month: 1, // 1-12
    year: 2024,
    synopsis: "Monthly program description",
    totalSessions: 4
  }
}
```

### MeetingSession Model (New)

```javascript
{
  meeting: ObjectId, // reference to Meeting
  sessionNumber: 1,
  title: "Session Title",
  description: "Session description",
  scheduledDate: Date,
  duration: 60, // minutes
  status: "scheduled", // scheduled, ongoing, completed, cancelled, postponed
  attachments: [{
    filename: "stored-filename.pdf",
    originalName: "original-filename.pdf",
    mimetype: "application/pdf",
    size: 1024000,
    uploadedAt: Date,
    uploadedBy: ObjectId
  }],
  attendance: [{
    user: ObjectId,
    member: ObjectId,
    status: "present", // present, absent, late
    joinedAt: Date,
    leftAt: Date
  }],
  notes: {
    summary: "Session summary",
    keyPoints: ["Point 1", "Point 2"],
    decisions: ["Decision 1"],
    actionItems: [{
      task: "Task description",
      assignedTo: ObjectId,
      dueDate: Date,
      status: "pending"
    }]
  }
}
```

## Usage Examples

### Creating a Monthly Meeting

```bash
curl -X POST http://localhost:3000/api/meetings/monthly \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "February 2024 Leadership Training",
    "synopsis": "Monthly leadership development program",
    "month": 2,
    "year": 2024,
    "sessions": [
      {
        "title": "Session 1: Communication Skills",
        "description": "Effective communication techniques",
        "scheduledDate": "2024-02-05T10:00:00.000Z",
        "duration": 120
      }
    ]
  }'
```

### Uploading a File to Session

```bash
curl -X POST http://localhost:3000/api/meetings/MEETING_ID/sessions/SESSION_ID/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/document.pdf"
```

### Marking Attendance

```bash
curl -X POST http://localhost:3000/api/meetings/MEETING_ID/sessions/SESSION_ID/attendance \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "present"}'
```

## Permissions

- **State Admins**: Can create monthly meetings for any audience
- **District Admins**: Can create monthly meetings for their district only
- **Group Admins**: Can view meetings they're invited to
- **All Users**: Can mark their own attendance and view sessions they have access to

## File Storage

- Files are stored in `uploads/meetings/` directory
- Maximum file size: 10MB
- Files are renamed with timestamp and random suffix for security
- Original filename is preserved in database

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [] // validation errors if applicable
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error