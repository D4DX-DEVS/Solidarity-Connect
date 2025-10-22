# Frontend Integration Guide for Meetings API

## Issue Identified
The frontend (running on `localhost:8080`) is showing "No Meetings Scheduled" because it's not properly connecting to the API server.

## API Server Details
- **API Server URL**: `http://localhost:3333/api`
- **Meetings Endpoint**: `GET http://localhost:3333/api/meetings`
- **Authentication**: Required (JWT Bearer token)
- **CORS**: Already configured to allow `localhost:8080`

## Frontend Configuration Needed

### 1. API Base URL Configuration
The frontend needs to be configured to call the API on the correct port:

```javascript
// Frontend API configuration
const API_BASE_URL = 'http://localhost:3333/api';

// Or use environment variables
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3333/api';
```

### 2. Authentication Token
Ensure the frontend is sending the JWT token in the Authorization header:

```javascript
// Example API call
const response = await fetch(`${API_BASE_URL}/meetings`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  }
});
```

### 3. Test Endpoints Available

#### Test API Connection
```
GET http://localhost:3333/api/meetings/test
Headers: Authorization: Bearer <token>
```

#### Get All Meetings
```
GET http://localhost:3333/api/meetings
Headers: Authorization: Bearer <token>
```

#### Health Check (No Auth Required)
```
GET http://localhost:3333/health
```

## Debugging Steps

### 1. Check API Server Status
```bash
curl http://localhost:3333/health
```
Expected response:
```json
{
  "status": "OK",
  "timestamp": "2025-01-XX...",
  "uptime": 123.456
}
```

### 2. Test Authentication
```bash
curl -H "Authorization: Bearer <your-jwt-token>" http://localhost:3333/api/meetings/test
```

### 3. Check Meetings Endpoint
```bash
curl -H "Authorization: Bearer <your-jwt-token>" http://localhost:3333/api/meetings
```

## Expected API Response Structure

### Successful Response
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "title": "Test Monthly Meeting - January 2025",
      "description": "...",
      "meetingType": "monthly_series",
      "targetAudience": "group_admins",
      "status": "scheduled",
      "sessionInfo": {
        "totalSessions": 4,
        "completedSessions": 0,
        "sessions": [...]
      },
      "userInfo": {
        "canManageAttendance": true,
        "role": "group_admin"
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalDocs": 1
  }
}
```

### Error Response (No Auth)
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

## Common Issues & Solutions

### 1. CORS Errors
- **Issue**: Frontend can't connect due to CORS
- **Solution**: API already configured for `localhost:8080`

### 2. Authentication Errors
- **Issue**: 401 Unauthorized
- **Solution**: Ensure JWT token is valid and included in headers

### 3. Wrong Port
- **Issue**: Frontend calling wrong port
- **Solution**: Update frontend API base URL to `http://localhost:3333/api`

### 4. No Meetings Found
- **Issue**: Empty response even with valid auth
- **Solution**: Check if meetings exist in database using test endpoint

## Frontend Code Example

```javascript
// API service
class MeetingsAPI {
  constructor() {
    this.baseURL = 'http://localhost:3333/api';
    this.token = localStorage.getItem('authToken'); // or however you store the token
  }

  async getMeetings(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.baseURL}/meetings${queryString ? '?' + queryString : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }

    return await response.json();
  }

  async testConnection() {
    const response = await fetch(`${this.baseURL}/meetings/test`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    return await response.json();
  }
}

// Usage
const api = new MeetingsAPI();

// Test connection
api.testConnection()
  .then(result => console.log('API Test:', result))
  .catch(error => console.error('API Test Failed:', error));

// Get meetings
api.getMeetings()
  .then(result => {
    if (result.success) {
      console.log('Meetings:', result.data);
      // Update UI with meetings
    } else {
      console.error('API Error:', result.message);
    }
  })
  .catch(error => console.error('Request Failed:', error));
```

## Next Steps

1. **Update Frontend API Configuration**: Change base URL to `http://localhost:3333/api`
2. **Verify Authentication**: Ensure JWT token is being sent correctly
3. **Test Connection**: Use the test endpoint to verify connectivity
4. **Check Network Tab**: Use browser dev tools to see actual API calls
5. **Add Error Handling**: Implement proper error handling for API failures

## Database Status
- ✅ Test meeting created: "Test Monthly Meeting - January 2025"
- ✅ API server running on port 3333
- ✅ CORS configured for localhost:8080
- ✅ Authentication middleware working
- ✅ Meetings endpoint responding correctly

The issue is likely in the frontend configuration or authentication setup.