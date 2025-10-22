# 🎯 Solidarity API - Testing Setup

## ✅ Current Configuration

### 🔧 Mock Mode: **ENABLED**
- DXing WhatsApp API is disabled for testing
- OTP will be displayed in console instead of sent via WhatsApp
- Perfect for development and testing

### 📱 Test Credentials
- **Phone Number**: `+919656550933`
- **User Types**: `state_admin`, `district_admin`, `group_admin`
- **OTP**: Any 4-digit number (or use the one displayed in console)

### 🚀 Server Configuration
- **Port**: 3333
- **Base URL**: `http://localhost:3333/api`
- **Health Check**: `http://localhost:3333/health`

## 🎮 How to Test

### 1. Start the API Server
```bash
cd solidarity-api
npm start
```

### 2. Update Your React Frontend
Update your API base URL to:
```javascript
const API_BASE_URL = 'http://localhost:3333/api';
```

### 3. Test Login Flow
1. Open your React app
2. Enter phone: `+919656550933`
3. Select any user type (state_admin, district_admin, group_admin)
4. Click "Send OTP"
5. **Check the API console** - you'll see:

```
🎯 ================================
🔐 OTP GENERATED FOR TESTING
================================
📱 Phone: +919656550933
🔢 OTP: 1234
👤 User Type: state_admin
⏰ Expires: [timestamp]
================================
💡 Use this OTP in your app!
================================
```

6. Enter the displayed OTP in your React app
7. You should be logged in successfully!

## 📋 API Endpoints

### Authentication
```bash
# Send OTP
POST /api/auth/send-otp
{
  "phone": "+919656550933",
  "userType": "state_admin"
}

# Verify OTP
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

## 🔄 Switch to Real WhatsApp (When Ready)

To enable real WhatsApp OTP sending:

1. Set `DXING_MOCK_MODE=false` in `.env`
2. Restart the server
3. OTP will be sent via WhatsApp instead of console

## 🎉 What's Working

✅ **Authentication System**: OTP-based login with JWT tokens  
✅ **Multi-Role Support**: State Admin, District Admin, Group Admin  
✅ **Database**: MongoDB connected with sample data  
✅ **WhatsApp Integration**: DXing API configured (mock mode for testing)  
✅ **Complete API**: All endpoints for members, districts, groups, meetings, etc.  
✅ **Security**: Role-based access control, input validation  
✅ **File Upload**: CSV bulk import support  
✅ **Reports**: Analytics and data export  

## 🚀 Ready for Integration!

Your Solidarity API backend is fully functional and ready to be integrated with your React frontend. The OTP will be clearly displayed in the console for easy testing!