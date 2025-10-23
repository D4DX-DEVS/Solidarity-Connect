# Personal Targets and Member Login System Implementation

## Overview

This implementation adds two major features to the Solidarity Members Management System:

1. **Personal Targets System**: Allows state admins to create monthly targets for members (e.g., Quran recitation, prayers, etc.)
2. **Member Login System**: Provides a separate login portal for members to view their profile, targets, meetings, and notifications

## Features Implemented

### 1. Personal Targets System

#### Backend Components

**Models:**
- `PersonalTarget.js`: Main target model with categories, audience targeting, and progress tracking
- `MemberTargetProgress.js`: Tracks individual member progress on targets with daily progress logging

**Routes:**
- `/api/personal-targets`: CRUD operations for targets (State Admin only)
- `/api/member-target-progress`: Progress tracking and statistics

**Key Features:**
- **Target Categories**: Quran, Hadith, Prayer, Charity, Knowledge, Community, Other
- **Target Types**: Daily, Weekly, Monthly
- **Audience Targeting**: All members, specific districts, or specific groups
- **Progress Tracking**: Daily progress logging with percentage completion
- **Statistics**: Leaderboards, completion rates, and progress analytics

#### Frontend Components

**Pages:**
- `PersonalTargets.tsx`: State admin interface for creating and managing targets
- Target creation form with validation and audience selection
- Target list with edit/delete functionality

### 2. Member Login System

#### Backend Components

**Models:**
- `MemberAuth.js`: Authentication model for members with OTP support and device tracking
- Enhanced security with login attempt limits and account locking

**Routes:**
- `/api/member-auth/send-otp`: Send OTP to member's phone
- `/api/member-auth/verify-otp`: Verify OTP and login
- `/api/member-auth/profile`: Get member profile and baithul maal details
- `/api/member-auth/targets`: Get member's assigned targets
- `/api/member-auth/meetings`: View upcoming meetings (read-only)
- `/api/member-auth/notifications`: View notifications
- `/api/member-auth/baithul-maal`: View payment history

**Utilities:**
- `createMemberAuthRecords.js`: Utility to create auth records for existing members
- `init-member-auth.js`: Initialization script

#### Frontend Components

**Pages:**
- `MemberDashboard.tsx`: Comprehensive member dashboard with tabs for:
  - Overview: Stats cards and recent activity
  - Profile: Personal information and baithul maal details
  - Targets: Current month targets with progress tracking
  - Meetings: Upcoming meetings (view-only)
  - Notifications: Recent notifications

**Enhanced Login:**
- Updated `Login.tsx` to support member login type
- Different API endpoints for member vs admin authentication
- Automatic routing to appropriate dashboard

## Database Schema

### PersonalTarget Collection
```javascript
{
  title: String,
  description: String,
  category: String, // quran, hadith, prayer, charity, knowledge, community, other
  targetType: String, // daily, weekly, monthly
  targetValue: Number,
  unit: String,
  month: Number, // 1-12
  year: Number,
  targetAudience: String, // all, specific_districts, specific_groups
  targetDistricts: [ObjectId],
  targetGroups: [ObjectId],
  status: String, // active, inactive, completed
  startDate: Date,
  endDate: Date,
  instructions: String,
  rewards: String,
  createdBy: ObjectId
}
```

### MemberTargetProgress Collection
```javascript
{
  member: ObjectId,
  personalTarget: ObjectId,
  currentProgress: Number,
  targetValue: Number,
  progressPercentage: Number,
  status: String, // not_started, in_progress, completed, overdue
  completedAt: Date,
  notes: String,
  dailyProgress: [{
    date: Date,
    value: Number,
    notes: String
  }]
}
```

### MemberAuth Collection
```javascript
{
  member: ObjectId,
  phone: String,
  isActive: Boolean,
  lastLogin: Date,
  otp: {
    code: String,
    expiresAt: Date,
    attempts: Number
  },
  loginAttempts: Number,
  lockUntil: Date,
  deviceInfo: [{
    deviceId: String,
    deviceName: String,
    lastUsed: Date,
    isActive: Boolean
  }]
}
```

## API Endpoints

### Personal Targets
- `POST /api/personal-targets` - Create new target (State Admin)
- `GET /api/personal-targets` - List targets with filtering
- `GET /api/personal-targets/:id` - Get specific target
- `PUT /api/personal-targets/:id` - Update target (State Admin)
- `DELETE /api/personal-targets/:id` - Delete target (State Admin)
- `GET /api/personal-targets/:id/progress` - Get target statistics

### Member Target Progress
- `GET /api/member-target-progress/member/:memberId` - Get member's progress
- `GET /api/member-target-progress/:progressId` - Get specific progress details
- `POST /api/member-target-progress/:progressId/daily` - Add daily progress
- `GET /api/member-target-progress/:progressId/daily` - Get daily progress history
- `GET /api/member-target-progress/:progressId/weekly` - Get weekly summary
- `PUT /api/member-target-progress/:progressId/notes` - Update progress notes
- `GET /api/member-target-progress/target/:targetId/members` - Get all member progress for a target

### Member Authentication
- `POST /api/member-auth/send-otp` - Send OTP to member
- `POST /api/member-auth/verify-otp` - Verify OTP and login
- `POST /api/member-auth/resend-otp` - Resend OTP
- `GET /api/member-auth/profile` - Get member profile
- `GET /api/member-auth/baithul-maal` - Get payment history
- `GET /api/member-auth/meetings` - Get meetings (read-only)
- `GET /api/member-auth/targets` - Get assigned targets
- `GET /api/member-auth/notifications` - Get notifications
- `POST /api/member-auth/logout` - Logout member

## Security Features

### Member Authentication
- OTP-based login with 10-minute expiry
- Account locking after 5 failed attempts (2-hour lockout)
- Device tracking for security monitoring
- JWT tokens with 30-day expiry for members
- Phone number validation and formatting

### Access Control
- Role-based access control for target management
- Members can only view their own data
- District/Group admins can view their jurisdiction's data
- State admins have full access

## Usage Instructions

### For State Admins

1. **Creating Personal Targets:**
   - Navigate to `/personal-targets`
   - Click "Create Target"
   - Fill in target details:
     - Title and description
     - Category (Quran, Hadith, etc.)
     - Target value and unit
     - Month and year
     - Start and end dates
     - Target audience (all, specific districts/groups)
     - Instructions and rewards (optional)

2. **Managing Targets:**
   - View all created targets
   - Edit existing targets
   - Delete targets (removes all progress data)
   - View progress statistics

### For Members

1. **Login:**
   - Go to login page
   - Select "Member" as user type
   - Enter 10-digit mobile number
   - Receive and enter OTP
   - Access member dashboard

2. **Dashboard Features:**
   - **Overview**: View stats and recent activity
   - **Profile**: See personal info and baithul maal details
   - **Targets**: View assigned targets and track progress
   - **Meetings**: See upcoming meetings (read-only)
   - **Notifications**: View recent notifications

## Installation and Setup

1. **Initialize Member Auth System:**
   ```bash
   cd solidarity-api
   node init-member-auth.js
   ```

2. **Server Routes:**
   - New routes are automatically included in `server.js`
   - No additional configuration needed

3. **Frontend Routes:**
   - Member dashboard accessible at `/member-dashboard`
   - Personal targets management at `/personal-targets`

## Example Target Creation

```javascript
{
  "title": "Quran Sura Yaseen Recitation",
  "description": "Recite 10-15 Ayah from Sura Yaseen daily",
  "category": "quran",
  "targetType": "monthly",
  "targetValue": 300,
  "unit": "Ayah",
  "month": 11,
  "year": 2024,
  "targetAudience": "all",
  "startDate": "2024-11-01",
  "endDate": "2024-11-30",
  "instructions": "Recite with proper pronunciation and understanding",
  "rewards": "Certificate of completion and recognition in monthly meeting"
}
```

## Progress Tracking Example

Members can log daily progress:
```javascript
{
  "value": 15,
  "notes": "Completed Ayah 1-15 with translation study"
}
```

## Testing

1. **Create a test member** with active status and approved flag
2. **Run the init script** to create auth records
3. **Create a personal target** using the state admin interface
4. **Test member login** with the member's phone number
5. **Verify dashboard functionality** and target display

## Future Enhancements

1. **Progress Analytics**: Advanced charts and statistics
2. **Gamification**: Points, badges, and achievements
3. **Social Features**: Member leaderboards and sharing
4. **Mobile App**: React Native implementation
5. **Offline Support**: PWA capabilities
6. **Push Notifications**: Real-time updates
7. **Target Templates**: Pre-defined target templates
8. **Group Challenges**: Collaborative targets

## Troubleshooting

### Common Issues

1. **Member can't login**: Ensure member status is 'Active' and isApproved is true
2. **No targets showing**: Check target audience settings and member's district/group
3. **OTP not received**: Check phone number format and SMS service configuration
4. **Progress not updating**: Verify member has access to the target

### Debug Commands

```bash
# Check member auth records
db.memberauths.find({})

# Check member status
db.members.find({ status: 'Active', isApproved: true })

# Check target assignments
db.membertargetprogresses.find({ member: ObjectId('member_id') })
```

This implementation provides a comprehensive personal targets system with member login functionality, enabling better engagement and progress tracking for solidarity members.