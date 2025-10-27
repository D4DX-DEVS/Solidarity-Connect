# Frontend Login API Guide

## Issue Resolution
The login issue with phone number `9656550933` has been fixed. The problem was that the auth middleware was adding `+91` prefix to phone numbers, but the database stores them in 10-digit format.

## API Endpoints

### 1. Send OTP
```
POST /api/auth/send-otp
```

**Request Body:**
```json
{
  "phone": "9656550933",
  "userType": "state_admin"
}
```

**Required Parameters:**
- `phone`: 10-digit phone number (without +91)
- `userType`: Must be one of:
  - `state_admin`
  - `district_admin` 
  - `group_admin`

### 2. Verify OTP
```
POST /api/auth/verify-otp
```

**Request Body:**
```json
{
  "phone": "9656550933",
  "otp": "1234",
  "userType": "state_admin"
}
```

**Required Parameters:**
- `phone`: Same 10-digit phone number used in send-otp
- `otp`: 4-digit OTP received
- `userType`: Same userType used in send-otp

## Available Test Accounts

### State Admins
- `9656550933` - State Admin
- `9876543210` - State Admin  
- `9544321355` - State Admin
- `9947497805` - State Admin

### District Admins
- `9876543230` - ALAPPUZHA District Admin
- `9876543231` - ERANAKULAM District Admin
- `9876543232` - KANNUR District Admin
- `9876543233` - KASARAGOD District Admin
- `9876543234` - KOCHI CITY District Admin

### Group Admins
- `9876543235` - CHERTHALA Group Admin
- `9876543236` - AMBALAPPUZHA Group Admin
- `9876543237` - ALAPPUZHA Group Admin
- `9876543238` - KAYAMKULAM Group Admin
- `9876543239` - HARIPPAD Group Admin
- `9876543240` - ALUVA Group Admin
- And more...

## Important Notes

1. **Phone Format**: Always use 10-digit format (e.g., `9656550933`), NOT `+919656550933`
2. **UserType Required**: The `userType` parameter is mandatory for both send-otp and verify-otp
3. **Development Mode**: Any 4-digit OTP works in development mode
4. **Case Sensitive**: userType values are case-sensitive

## Example Frontend Code

```javascript
// Send OTP
const sendOTP = async (phone, userType) => {
  const response = await fetch('/api/auth/send-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone: phone,
      userType: userType
    })
  });
  return response.json();
};

// Verify OTP
const verifyOTP = async (phone, otp, userType) => {
  const response = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone: phone,
      otp: otp,
      userType: userType
    })
  });
  return response.json();
};
```

## Database Structure

The database now contains:
- **14 Districts** (including real Kerala districts)
- **118 Groups** (based on actual CSV data)
- **1,008+ Members** (from CSV data)
- **20 Admin Users** (state, district, and group admins)

All data relationships are properly established with ObjectId references.