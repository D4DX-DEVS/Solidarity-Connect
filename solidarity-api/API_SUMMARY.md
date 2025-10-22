# Solidarity Members Management API - Complete Backend

## 🚀 Quick Start

The Solidarity API backend is now fully functional and ready to use with your React frontend.

### Server Details
- **Base URL**: `http://localhost:8888/api`
- **Health Check**: `http://localhost:8888/health`
- **Environment**: Development
- **Database**: MongoDB (Connected and Seeded)

### Authentication
- **Login Phone**: `+919656550933` (for all user types)
- **OTP**: Any 4-digit number (e.g., `1234`) in development mode
- **User Types**: `state_admin`, `district_admin`, `group_admin`

## 📱 WhatsApp Integration (DXing)

### Current Status
- **Mock Mode**: Enabled for development (`DXING_MOCK_MODE=true`)
- **Real API**: Available but needs verification with DXing support
- **OTP Delivery**: Simulated in development, shows in console logs

### To Enable Real WhatsApp Messages
1. Set `DXING_MOCK_MODE=false` in `.env`
2. Verify DXing API credentials with their support team
3. Test with the provided credentials

## 🔑 API Endpoints

### Authentication
```bash
# Send OTP
POST /api/auth/send-otp
{
  "phone": "+919656550933",
  "userType": "state_admin"
}

# Verify OTP & Login
POST /api/auth/verify-otp
{
  "phone": "+919656550933",
  "otp": "1234",
  "userType": "state_admin"
}

# Get Current User
GET /api/auth/me
Authorization: Bearer <token>
```

### Members Management
```bash
# Get Members (with filtering & pagination)
GET /api/members?page=1&limit=20&status=Active&district=<id>
Authorization: Bearer <token>

# Create Member
POST /api/members
Authorization: Bearer <token>
{
  "name": "John Doe",
  "phone": "+919876543210",
  "district": "<district-id>",
  "group": "<group-id>",
  "email": "john@example.com"
}

# Update Member
PUT /api/members/<member-id>
Authorization: Bearer <token>

# Approve Member
POST /api/members/<member-id>/approve
Authorization: Bearer <token>
```

### Districts & Groups
```bash
# Get Districts
GET /api/districts
Authorization: Bearer <token>

# Get Groups
GET /api/groups?district=<district-id>
Authorization: Bearer <token>

# Create District (State Admin only)
POST /api/districts
Authorization: Bearer <token>

# Create Group (State/District Admin)
POST /api/groups
Authorization: Bearer <token>
```

### Meetings
```bash
# Get Meetings
GET /api/meetings?upcoming=true
Authorization: Bearer <token>

# Create Meeting
POST /api/meetings
Authorization: Bearer <token>
{
  "title": "Monthly Meeting",
  "scheduledDate": "2024-01-15T10:00:00Z",
  "targetAudience": "all"
}
```

### Notifications
```bash
# Create Notification (State Admin Only)
POST /api/notifications
Authorization: Bearer <token> (State Admin)
{
  "title": "Important Notice",
  "message": "This is an important message",
  "targetAudience": "all",
  "channels": ["whatsapp"]
}

# Get Notifications (All admins can view)
GET /api/notifications
Authorization: Bearer <token>

# Send Notification (State Admin Only)
POST /api/notifications/<id>/send
Authorization: Bearer <token> (State Admin)

# Get Notification Stats (State Admin Only)
GET /api/notifications/stats
Authorization: Bearer <token> (State Admin)
```

### Requests (Approval System)
```bash
# Get Requests
GET /api/requests?status=pending
Authorization: Bearer <token>

# Create Request
POST /api/requests
Authorization: Bearer <token>
{
  "type": "member_edit",
  "member": "<member-id>",
  "title": "Update member details",
  "proposedData": { "profession": "Engineer" }
}

# Approve Request
POST /api/requests/<request-id>/approve
Authorization: Bearer <token>
```

### Baithul Maal (Financial)
```bash
# Get Baithul Maal Data
GET /api/baithul-maal
Authorization: Bearer <token>

# Update Member's Contribution
PUT /api/baithul-maal/member/<member-id>
Authorization: Bearer <token>
{
  "monthlyAmount": 100
}

# Record Payment
POST /api/baithul-maal/member/<member-id>/payment
Authorization: Bearer <token>
{
  "amount": 100,
  "paymentDate": "2024-01-15"
}
```

### Bulk Import
```bash
# Upload CSV
POST /api/bulk-import/members
Authorization: Bearer <token>
Content-Type: multipart/form-data
csvFile: <file>
district: <district-id>
group: <group-id>

# Download Template
GET /api/bulk-import/template
Authorization: Bearer <token>
```

### Reports & Analytics
```bash
# Dashboard Report
GET /api/reports/dashboard
Authorization: Bearer <token>

# Member Report
GET /api/reports/members?startDate=2024-01-01
Authorization: Bearer <token>

# Baithul Maal Report
GET /api/reports/baithul-maal
Authorization: Bearer <token>

# Export Members CSV
GET /api/reports/export/members
Authorization: Bearer <token>
```

## 👥 User Roles & Permissions

### State Admin (`state_admin`)
- Full system access
- Manage all districts, groups, and members
- Approve all requests
- **Create and send notifications to all audiences** (EXCLUSIVE)
- View all reports and analytics
- Bulk import members

### District Admin (`district_admin`)
- Manage groups and members within their district
- Approve district-level requests
- **View notifications** targeted to them or their district
- View district-specific reports
- Bulk import members to their district

### Group Admin / Murabbi (`group_admin`)
- Manage members within their group
- Create member edit requests
- **View notifications** targeted to them or their group
- View group-specific reports
- Manage Baithul Maal for their group
- Bulk import members to their group

## 📊 Sample Data

The database is seeded with:
- **3 Users**: One for each role type (all use same phone number)
- **2 Districts**: Thrissur, Malappuram
- **3 Groups**: Varantharappalli, Perumpilavu, Manjeri
- **7 Members**: Sample members with different statuses
- **Baithul Maal Data**: Sample financial contributions

## 🔧 Development Commands

```bash
# Start server
npm start

# Development with auto-reload
npm run dev

# Seed database
npm run seed

# Test API endpoints
node test-api.js

# Test DXing integration
node test-dxing.js
```

## 🌐 Frontend Integration

### Update your React app's API base URL to:
```javascript
const API_BASE_URL = 'http://localhost:8888/api';
```

### Authentication Flow:
1. User selects role and enters phone number
2. Frontend calls `/api/auth/send-otp`
3. User enters any 4-digit OTP
4. Frontend calls `/api/auth/verify-otp`
5. Store the returned JWT token
6. Use token in Authorization header for all subsequent requests

### Error Handling:
All API responses follow this format:
```json
{
  "success": true/false,
  "message": "Description",
  "data": {...},
  "errors": [...]
}
```

## 🔒 Security Features

- JWT-based authentication
- Role-based access control
- Input validation and sanitization
- Rate limiting (100 requests per 15 minutes)
- CORS protection
- Helmet security headers
- File upload restrictions

## 📝 Notes

1. **Development Mode**: OTP verification accepts any 4-digit code
2. **WhatsApp Mock**: Messages are logged to console instead of sent
3. **Database**: Automatically connects to provided MongoDB URI
4. **File Uploads**: Supported for CSV bulk import
5. **Pagination**: Most list endpoints support pagination
6. **Filtering**: Members, groups, districts support various filters

## 🚨 Production Checklist

Before deploying to production:

1. Change `NODE_ENV=production`
2. Set strong `JWT_SECRET`
3. Set `DXING_MOCK_MODE=false`
4. Verify DXing API credentials
5. Configure proper CORS origins
6. Set up proper logging
7. Configure rate limiting
8. Set up database backups
9. Configure SSL/HTTPS
10. Set up monitoring

The API is now ready for integration with your React frontend! 🎉