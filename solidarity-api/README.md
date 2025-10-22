# Solidarity Members Management API

A comprehensive Node.js backend API for the Solidarity Members Management System, built with Express.js and MongoDB.

## Features

- **Authentication & Authorization**: OTP-based login with JWT tokens
- **User Management**: Multi-role system (State Admin, District Admin, Group Admin)
- **Member Management**: CRUD operations with approval workflow
- **District & Group Management**: Hierarchical organization structure
- **Meeting Management**: Create, schedule, and track meetings with attendance
- **Request System**: Member edit/transfer requests with approval workflow
- **Notifications**: WhatsApp notifications via DXing API
- **Baithul Maal**: Financial contribution tracking
- **Bulk Import**: CSV-based member import with validation
- **Reports**: Comprehensive analytics and data export
- **File Upload**: Support for CSV files and attachments

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens
- **File Upload**: Multer
- **CSV Processing**: csv-parser
- **WhatsApp API**: DXing integration
- **Validation**: express-validator, Joi
- **Security**: Helmet, CORS, Rate limiting

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd solidarity-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   # Database
   MONGODB_URI=mongodb+srv://hi:owOF2zCPTR6J24b0@cluster0.6thpa.mongodb.net/solidarity-memeberapp?retryWrites=true&w=majority&appName=Cluster0
   
   # Server
   PORT=5000
   NODE_ENV=development
   
   # JWT
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=7d
   
   # DXing WhatsApp API
   DXING_API_SECRET=18ed3b36a814c961ecf50b5ab3079f9bcd1704e7
   DXING_ACCOUNT_ID=1757601594a5771bce93e200c36f7cd9dfd0e5deaa68c2df3a20261
   DXING_API_URL=https://app.dxing.in/api/send/whatsapp
   ```

4. **Create upload directories**
   ```bash
   mkdir -p uploads/bulk-import
   ```

5. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### Send OTP
```http
POST /api/auth/send-otp
Content-Type: application/json

{
  "phone": "+919846058901",
  "userType": "group_admin"
}
```

#### Verify OTP & Login
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "phone": "+919846058901",
  "otp": "1234",
  "userType": "group_admin"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <jwt-token>
```

### Member Management

#### Get Members
```http
GET /api/members?page=1&limit=20&status=Active&district=<district-id>
Authorization: Bearer <jwt-token>
```

#### Create Member
```http
POST /api/members
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "+919876543210",
  "email": "john@example.com",
  "district": "<district-id>",
  "group": "<group-id>",
  "dateOfBirth": "1990-01-15",
  "bloodGroup": "A+",
  "profession": "Engineer",
  "education": "B.Tech"
}
```

#### Update Member
```http
PUT /api/members/<member-id>
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "John Doe Updated",
  "profession": "Senior Engineer"
}
```

#### Approve Member
```http
POST /api/members/<member-id>/approve
Authorization: Bearer <jwt-token>
```

### District Management

#### Get Districts
```http
GET /api/districts
Authorization: Bearer <jwt-token>
```

#### Create District
```http
POST /api/districts
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "Thrissur",
  "code": "TSR",
  "admin": "<user-id>"
}
```

### Group Management

#### Get Groups
```http
GET /api/groups?district=<district-id>
Authorization: Bearer <jwt-token>
```

#### Create Group
```http
POST /api/groups
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "Varantharappalli",
  "code": "VRP",
  "district": "<district-id>",
  "admin": "<user-id>"
}
```

### Meeting Management

#### Get Meetings
```http
GET /api/meetings?upcoming=true
Authorization: Bearer <jwt-token>
```

#### Create Meeting
```http
POST /api/meetings
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "title": "Monthly General Meeting",
  "description": "Regular monthly meeting",
  "scheduledDate": "2024-01-15T10:00:00Z",
  "duration": 120,
  "venue": "Community Hall",
  "targetAudience": "all"
}
```

### Notification System

#### Send Notification
```http
POST /api/notifications
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "title": "Important Announcement",
  "message": "This is an important message for all members.",
  "type": "announcement",
  "priority": "high",
  "targetAudience": "all",
  "channels": ["whatsapp"]
}
```

### Bulk Import

#### Upload CSV
```http
POST /api/bulk-import/members
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data

csvFile: <file>
district: <district-id>
group: <group-id>
```

#### Download Template
```http
GET /api/bulk-import/template
Authorization: Bearer <jwt-token>
```

### Reports

#### Dashboard Report
```http
GET /api/reports/dashboard
Authorization: Bearer <jwt-token>
```

#### Member Report
```http
GET /api/reports/members?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <jwt-token>
```

#### Export Members CSV
```http
GET /api/reports/export/members
Authorization: Bearer <jwt-token>
```

## User Roles & Permissions

### State Admin
- Full system access
- Manage all districts, groups, and members
- Approve all requests
- Send notifications to all audiences
- View all reports

### District Admin
- Manage groups and members within their district
- Approve district-level requests
- Send notifications to district/group admins and members
- View district-specific reports

### Group Admin (Murabbi)
- Manage members within their group
- Create member edit requests
- Send notifications to group members
- View group-specific reports
- Manage Baithul Maal for their group

## Error Handling

The API uses standard HTTP status codes and returns errors in the following format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "phone",
      "message": "Phone number is required"
    }
  ]
}
```

## Rate Limiting

- 100 requests per 15 minutes per IP address
- Configurable via environment variables

## Security Features

- JWT-based authentication
- Role-based access control
- Input validation and sanitization
- Rate limiting
- CORS protection
- Helmet security headers
- File upload restrictions

## Development

### Running Tests
```bash
npm test
```

### Code Linting
```bash
npm run lint
```

### Database Seeding
```bash
# Create sample data for development
npm run seed
```

## Deployment

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=<production-mongodb-uri>
JWT_SECRET=<strong-production-secret>
DXING_API_SECRET=<production-dxing-secret>
```

### PM2 Deployment
```bash
npm install -g pm2
pm2 start src/server.js --name solidarity-api
pm2 startup
pm2 save
```

### Docker Deployment
```bash
docker build -t solidarity-api .
docker run -p 5000:5000 --env-file .env solidarity-api
```

## API Health Check

```http
GET /health
```

Returns:
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "uptime": 3600
}
```

## Support

For support and questions, please contact the development team.

## License

This project is licensed under the MIT License.