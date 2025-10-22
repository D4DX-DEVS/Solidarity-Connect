# Testing Monthly Meeting Creation

## Step 1: Login First

Before testing the meeting creation, you need to log in:

1. **Go to login page**: `http://localhost:8080/login`
2. **Select user type**: Choose "State Admin"
3. **Enter phone**: `9656550933` (this is the test state admin)
4. **Send OTP**: Click "Send OTP"
5. **Enter OTP**: Use any 4-digit number (e.g., `1234`) - in development mode, any 4-digit OTP works
6. **Verify**: Click "Verify OTP"

You should be redirected to the dashboard and logged in.

## Step 2: Test Meeting Creation

1. **Navigate to**: `http://localhost:8080/state-admin/create-meeting`
2. **Fill the form**:
   - **Title**: "Test Monthly Meeting" (minimum 5 characters)
   - **Description**: "This is a test monthly meeting description" (minimum 10 characters)
   - **Month**: Select any month (e.g., "January")
   - **Year**: Select "2025" or "2026"
   - **Sessions**: Optional - you can leave empty or add sessions
3. **Submit**: Click "Create Monthly Meeting"

## Expected Behavior

### If Not Logged In:
- You'll be redirected to login page
- Or see "Authentication Required" message

### If Logged In But Form Empty:
- You'll see validation errors for required fields
- Console will show what values are being submitted

### If Successful:
- You'll see "Monthly Meeting Created" success message
- You'll be redirected to meeting agenda page

## Debugging

Open browser console (F12) to see debug logs:
- Form data being submitted
- API call details
- Any errors

## Common Issues

1. **"Cannot read properties of undefined"**: User not logged in properly
2. **"Validation failed"**: Form fields are empty - check if inputs are working
3. **"Access denied"**: User doesn't have state_admin or district_admin role
4. **"Network error"**: Backend not running on port 3333

## Backend Test

You can also test the API directly:

```bash
# 1. Get a token first
curl -X POST http://localhost:3333/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9656550933", "userType": "state_admin"}'

curl -X POST http://localhost:3333/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9656550933", "otp": "1234", "userType": "state_admin"}'

# 2. Use the token to create meeting
curl -X POST http://localhost:3333/api/meetings/monthly \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "title=Test Meeting" \
  -F "description=Test Description for Monthly Meeting" \
  -F "month=1" \
  -F "year=2025" \
  -F "sessions=[]"
```

## Current Status

The API is working correctly. The issue is likely:
1. User not logged in properly
2. Form not capturing input values
3. Frontend-backend communication issue

Follow the login steps first, then test the form with the debugging enabled.