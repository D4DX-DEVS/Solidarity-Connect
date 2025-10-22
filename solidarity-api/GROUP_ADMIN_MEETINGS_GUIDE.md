# Group Admin Meetings Management Guide

## Enhanced `/meetings` Endpoint Features for Group Admins

The `/meetings` endpoint has been enhanced to provide comprehensive meeting management capabilities specifically designed for group administrators. **Important**: Meetings are visible to all group admins, but session attendance data is group-specific and only shows after a group admin starts managing their group's attendance.

## Important Behavior Changes

### Meeting Visibility vs Session Data
- **Meetings**: All group admins can see all meetings (common across groups)
- **Session Data**: Group-specific and only appears after a group admin starts managing their group's attendance
- **Attendance**: Each group admin only sees and manages their own group members' attendance
- **Initialization**: Group admins must initialize attendance for their group to start seeing session data

## Key Enhancements

### 1. Enhanced Meeting List (`GET /api/meetings`)

**Meeting Visibility:**
- **All group admins can see all meetings** targeted to group admins or all users
- No filtering by specific group - meetings are common across groups
- Session attendance data is **group-specific** and only shows after interaction

**New Query Parameters:**
- `myMeetings=true` - Filter to show only meetings created by the current user
- Enhanced session information with group-specific attendance details
- Quick action indicators for meetings requiring attention

**Enhanced Response Features:**
- **Session Details**: Complete breakdown of sessions with group-specific attendance statistics
- **Quick Actions**: Flags indicating what actions are needed (initialize attendance, mark attendance, etc.)
- **Status Indicators**: Visual indicators for meeting completion and attendance quality
- **Group-Specific Data**: Attendance data filtered to show only the group admin's group members

**Example Response Structure:**
```json
{
  "success": true,
  "data": [
    {
      "title": "Monthly Meeting - January 2025",
      "meetingType": "monthly_series",
      "sessionInfo": {
        "totalSessions": 4,
        "completedSessions": 2,
        "upcomingSessions": 2,
        "completionRate": "50.0",
        "overallAttendanceRate": "85.5",
        "sessions": [
          {
            "sessionId": "...",
            "sessionNumber": 1,
            "title": "Session 1",
            "status": "completed",
            "attendance": {
              "members": { "total": 25, "present": 22 },
              "guests": { "total": 2, "present": 2 },
              "attendanceRate": "88.9"
            },
            "canMarkAttendance": false,
            "canMarkComplete": false
          }
        ]
      },
      "quickActions": {
        "hasUpcomingSessions": true,
        "hasPendingAttendance": false,
        "nextActionRequired": "mark_attendance"
      },
      "statusIndicators": {
        "requiresAttention": true,
        "completionStatus": "in_progress",
        "attendanceStatus": "good"
      }
    }
  ],
  "summaryStats": {
    "totalMeetings": 5,
    "monthlySeriesMeetings": 3,
    "meetingsRequiringAttention": 1,
    "sessionStats": {
      "total": 12,
      "completed": 8,
      "pending": 4,
      "completionRate": "66.7"
    }
  }
}
```

### 2. My Meetings Endpoint (`GET /api/meetings/my-meetings`)

**Purpose**: Dedicated endpoint for group admins to manage their created meetings

**Query Parameters:**
- `status` - Filter by meeting status (all, active, completed, pending_attention)
- `meetingType` - Filter by meeting type
- `limit` - Number of meetings to return (default: 50)

**Key Features:**
- **Automatic Attendance Initialization**: Automatically initializes member attendance for group admin's group
- **Comprehensive Management Info**: Detailed statistics and action items for each meeting
- **Priority Indicators**: High/Medium/Low priority based on attention needed
- **Next Actions**: Clear indicators of what needs to be done next

### 3. Bulk Session Actions (`POST /api/meetings/:id/bulk-session-actions`)

**Purpose**: Perform bulk operations on multiple sessions at once

**Available Actions:**
- `initialize_attendance` - Initialize member attendance for all sessions
- `mark_all_present` - Mark all members as present for selected sessions
- `complete_ready_sessions` - Complete all sessions that have attendance recorded

**Request Body:**
```json
{
  "action": "initialize_attendance",
  "sessionIds": ["session1_id", "session2_id"] // Optional - if not provided, applies to all sessions
}
```

### 4. Attendance Summary (`GET /api/meetings/:id/attendance-summary`)

**Purpose**: Get a comprehensive attendance overview for dashboard display

**Features:**
- **Overall Statistics**: Total members, attendance rates, completion status
- **Session Breakdown**: Detailed view of each session's attendance
- **Member Overview**: Individual member attendance tracking across all sessions
- **Action Items**: Automated suggestions for improving meeting management

**Response Includes:**
- Meeting completion statistics
- Individual member attendance rates
- Low attendance alerts
- Pending session notifications

## Usage Examples

### 1. Get All Meetings with Enhanced Info
```javascript
GET /api/meetings?myMeetings=true&limit=20
```

### 2. Get Meetings Requiring Attention
```javascript
GET /api/meetings/my-meetings?status=pending_attention
```

### 3. Initialize Attendance for All Sessions
```javascript
POST /api/meetings/meeting_id/bulk-session-actions
{
  "action": "initialize_attendance"
}
```

### 4. Mark All Members Present for Specific Sessions
```javascript
POST /api/meetings/meeting_id/bulk-session-actions
{
  "action": "mark_all_present",
  "sessionIds": ["session1_id", "session2_id"]
}
```

### 5. Get Attendance Summary for Dashboard
```javascript
GET /api/meetings/meeting_id/attendance-summary
```

## Status Indicators

### Completion Status
- `not_started` - No sessions completed yet
- `in_progress` - Some sessions completed
- `completed` - All sessions completed

### Attendance Status
- `good` - 80%+ attendance rate
- `average` - 60-79% attendance rate
- `poor` - Below 60% attendance rate

### Priority Levels
- `high` - Sessions need immediate attention (overdue, no attendance)
- `medium` - Sessions scheduled but not urgent
- `low` - All sessions completed or no immediate action needed

## Best Practices for Group Admins

1. **Regular Monitoring**: Check `/my-meetings?status=pending_attention` daily
2. **Bulk Operations**: Use bulk actions to efficiently manage multiple sessions
3. **Attendance Tracking**: Initialize attendance early and mark regularly
4. **Completion Management**: Complete sessions promptly after conducting them
5. **Dashboard Usage**: Use attendance summary for quick overview and reporting

## Integration with Frontend

The enhanced API provides all necessary data for creating:
- **Dashboard Cards**: Quick overview of meeting status
- **Action Lists**: Prioritized tasks for group admins
- **Attendance Grids**: Visual attendance tracking
- **Progress Indicators**: Meeting and session completion status
- **Bulk Action Buttons**: Efficient meeting management tools

This enhanced system transforms the basic meetings list into a comprehensive meeting management platform specifically designed for group administrators' workflow.