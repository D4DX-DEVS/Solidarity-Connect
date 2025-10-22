# Monthly Meetings API - Usage Examples

## Complete Workflow Example

### Step 1: State Admin Creates Monthly Meeting

```bash
curl -X POST http://localhost:3333/api/meetings/monthly \
  -H "Authorization: Bearer YOUR_STATE_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "January 2024 Leadership Development Program",
    "synopsis": "Comprehensive monthly training covering leadership skills, community engagement, and organizational development across multiple sessions.",
    "month": 1,
    "year": 2024,
    "targetAudience": "all",
    "venue": "Community Center",
    "sessions": [
      {
        "title": "Leadership Fundamentals",
        "description": "Basic leadership principles and team management",
        "scheduledDate": "2024-01-05T10:00:00.000Z",
        "duration": 120
      },
      {
        "title": "Communication Skills",
        "description": "Effective communication and public speaking",
        "scheduledDate": "2024-01-12T14:00:00.000Z",
        "duration": 90
      },
      {
        "title": "Community Engagement",
        "description": "Strategies for community outreach and involvement",
        "scheduledDate": "2024-01-19T10:00:00.000Z",
        "duration": 150
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Monthly meeting with sessions created successfully",
  "data": {
    "meeting": {
      "_id": "65a1b2c3d4e5f6789012345",
      "title": "January 2024 Leadership Development Program",
      "meetingType": "monthly_series",
      "monthlyDetails": {
        "month": 1,
        "year": 2024,
        "synopsis": "Comprehensive monthly training...",
        "totalSessions": 3
      }
    },
    "sessions": [...]
  }
}
```

### Step 2: Group Admin Views Sessions

```bash
curl -X GET http://localhost:3333/api/meetings/65a1b2c3d4e5f6789012345/sessions \
  -H "Authorization: Bearer YOUR_GROUP_ADMIN_TOKEN"
```

This automatically initializes attendance for all active members in the group admin's group.

### Step 3: Group Admin Marks Member Attendance

```bash
# Mark member as present
curl -X POST http://localhost:3333/api/meetings/65a1b2c3d4e5f6789012345/sessions/65a1b2c3d4e5f6789012346/member-attendance \
  -H "Authorization: Bearer YOUR_GROUP_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "65a1b2c3d4e5f6789012347",
    "status": "present",
    "notes": "Active participant, asked good questions"
  }'

# Mark member as late
curl -X POST http://localhost:3333/api/meetings/65a1b2c3d4e5f6789012345/sessions/65a1b2c3d4e5f6789012346/member-attendance \
  -H "Authorization: Bearer YOUR_GROUP_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "65a1b2c3d4e5f6789012348",
    "status": "late",
    "notes": "Arrived 15 minutes late"
  }'

# Mark member as excused
curl -X POST http://localhost:3333/api/meetings/65a1b2c3d4e5f6789012345/sessions/65a1b2c3d4e5f6789012346/member-attendance \
  -H "Authorization: Bearer YOUR_GROUP_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "65a1b2c3d4e5f6789012349",
    "status": "excused",
    "notes": "Medical appointment"
  }'
```

### Step 4: Group Admin Adds Guests

```bash
curl -X POST http://localhost:3333/api/meetings/65a1b2c3d4e5f6789012345/sessions/65a1b2c3d4e5f6789012346/add-guest \
  -H "Authorization: Bearer YOUR_GROUP_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Sarah Johnson",
    "phone": "9876543210",
    "organization": "Leadership Institute",
    "status": "present",
    "notes": "Guest speaker on leadership principles"
  }'
```

### Step 5: Group Admin Uploads Session Materials

```bash
curl -X POST http://localhost:3333/api/meetings/65a1b2c3d4e5f6789012345/sessions/65a1b2c3d4e5f6789012346/upload \
  -H "Authorization: Bearer YOUR_GROUP_ADMIN_TOKEN" \
  -F "file=@session-materials.pdf"
```

### Step 6: Group Admin Marks Session as Completed

```bash
curl -X POST http://localhost:3333/api/meetings/65a1b2c3d4e5f6789012345/sessions/65a1b2c3d4e5f6789012346/complete \
  -H "Authorization: Bearer YOUR_GROUP_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Session marked as completed successfully",
  "data": {
    "sessionStatus": "completed",
    "completedBy": "Group Admin Name",
    "completedAt": "2024-01-05T12:30:00.000Z",
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

### Step 7: State Admin Views Attendance Report

```bash
curl -X GET http://localhost:3333/api/meetings/65a1b2c3d4e5f6789012345/attendance-report \
  -H "Authorization: Bearer YOUR_STATE_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "meeting": {
      "_id": "65a1b2c3d4e5f6789012345",
      "title": "January 2024 Leadership Development Program",
      "monthlyDetails": {...}
    },
    "overallStats": {
      "totalSessions": 3,
      "completedSessions": 2,
      "pendingSessions": 1,
      "totalMembers": 25,
      "totalGuests": 1.5,
      "completionRate": "66.7"
    },
    "sessionStats": [
      {
        "sessionId": "65a1b2c3d4e5f6789012346",
        "sessionNumber": 1,
        "title": "Leadership Fundamentals",
        "status": "completed",
        "stats": {
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
    ],
    "groupStats": [
      {
        "groupName": "Group A",
        "totalMembers": 15,
        "totalPresent": 12,
        "totalAbsent": 2,
        "totalLate": 1,
        "totalExcused": 0
      }
    ]
  }
}
```

### Step 8: State Admin Views Summary Report

```bash
# Get summary for specific month
curl -X GET "http://localhost:3333/api/meetings/reports/summary?month=1&year=2024" \
  -H "Authorization: Bearer YOUR_STATE_ADMIN_TOKEN"

# Get summary for entire year
curl -X GET "http://localhost:3333/api/meetings/reports/summary?year=2024" \
  -H "Authorization: Bearer YOUR_STATE_ADMIN_TOKEN"

# Get summary for specific district
curl -X GET "http://localhost:3333/api/meetings/reports/summary?district=65a1b2c3d4e5f6789012350" \
  -H "Authorization: Bearer YOUR_STATE_ADMIN_TOKEN"
```

## API Endpoints Summary

### Meeting Creation
- `POST /api/meetings/monthly` - Create monthly meeting with sessions

### Session Management
- `GET /api/meetings/:id/sessions` - Get all sessions (auto-initializes member attendance for group admins)
- `PUT /api/meetings/:id/sessions/:sessionId` - Update session details
- `POST /api/meetings/:id/sessions/:sessionId/upload` - Upload file to session

### Attendance Management
- `POST /api/meetings/:id/sessions/:sessionId/member-attendance` - Mark member attendance
- `POST /api/meetings/:id/sessions/:sessionId/add-guest` - Add guest participant
- `POST /api/meetings/:id/sessions/:sessionId/complete` - Mark session as completed

### Reporting
- `GET /api/meetings/:id/attendance-report` - Detailed attendance report for meeting
- `GET /api/meetings/reports/summary` - Summary report across meetings

## Attendance Status Options

### Member Attendance
- `present` - Member attended the session
- `absent` - Member did not attend
- `late` - Member arrived late but participated
- `excused` - Member had valid reason for absence

### Guest Attendance
- `present` - Guest attended
- `absent` - Guest did not attend
- `late` - Guest arrived late

## Permissions

| Role | Create Meeting | View Sessions | Mark Attendance | Add Guests | Complete Session | View Reports |
|------|----------------|---------------|-----------------|------------|------------------|--------------|
| State Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| District Admin | ✅ (own district) | ✅ | ✅ | ✅ | ✅ | ✅ (own district) |
| Group Admin | ❌ | ✅ (assigned) | ✅ (own group) | ✅ | ✅ | ❌ |
| Members | ❌ | ✅ (view only) | ❌ | ❌ | ❌ | ❌ |

## File Upload Specifications

- **Maximum file size:** 10MB
- **Supported formats:** PDF, DOC, DOCX, TXT, XLS, XLSX, PPT, PPTX, JPG, JPEG, PNG, GIF
- **Storage location:** `uploads/meetings/`
- **File naming:** Automatic with timestamp and random suffix for security

## Error Responses

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
- `201` - Created successfully
- `400` - Bad request (validation errors)
- `401` - Unauthorized (invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Resource not found
- `500` - Internal server error