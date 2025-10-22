# Testing Guide - Monthly Meeting Creation

## 🚀 Complete Testing Flow

### Step 1: Start the Servers

1. **Start Backend:**
   ```bash
   cd solidarity-api
   npm start
   ```
   - Backend runs on `http://localhost:3333`
   - Health check: `http://localhost:3333/health`

2. **Start Frontend:**
   ```bash
   npm run dev
   ```
   - Frontend runs on `http://localhost:8080`
   - Proxy configured to forward `/api` requests to `localhost:3333`

### Step 2: Login Process

1. **Navigate to Login:**
   - Go to `http://localhost:8080/login`

2. **Select User Type:**
   - Choose "State Admin" from dropdown

3. **Enter Phone Number:**
   - Use: `9656550933` (this is the seeded state admin user)

4. **Send OTP:**
   - Click "Send OTP" button
   - In development mode, any 4-digit OTP works

5. **Enter OTP:**
   - Use any 4-digit code like: `1234`
   - Click "Verify OTP"

6. **Login Success:**
   - You'll be redirected to `/dashboard`
   - Token will be stored in localStorage

### Step 3: Access Create Meeting

1. **Navigate to Create Meeting:**
   - Go to `http://localhost:8080/state-admin/create-meeting`
   - OR use the navigation menu

2. **Form Should Load:**
   - Month/Year dropdowns populated (2025, 2026)
   - All form fields available
   - No 400 error

### Step 4: Test Form Functionality

1. **Fill Basic Information:**
   ```
   Title: January 2025 Leadership Training
   Description: Monthly leadership development program
   Month: January
   Year: 2025
   ```

2. **Add Sessions:**
   - Click "Add Session" button
   - Fill session details:
     ```
     Session Title: Leadership Fundamentals
     Description: Basic leadership principles
     Duration: 90 minutes
   