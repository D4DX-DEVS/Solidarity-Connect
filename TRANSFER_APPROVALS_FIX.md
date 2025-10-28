# Transfer Approvals Fix

## Issues Found and Fixed

### 1. **Frontend Data Access Bug** (Fixed) ⭐ MAIN ISSUE
**Location:** `solidarity-app/src/pages/TransferApprovals.tsx` - `fetchTransferRequests()` method

**Problem:** The frontend was trying to access `response.data.data` instead of `response.data`, causing the array to be undefined.

**Fix Applied:**
```typescript
// Before (WRONG):
setTransferRequests(response.data.data || []);  // ❌ response.data.data is undefined!

// After (CORRECT):
setTransferRequests(response.data || []);  // ✅ response.data contains the array
```

Also fixed pagination access:
```typescript
// Before (WRONG):
if (response.data.pagination) { ... }  // ❌ Wrong path!

// After (CORRECT):
if (response.pagination) { ... }  // ✅ Correct path
```

### 2. **District Admin Filter Bug** (Fixed)
**Location:** `solidarity-api/src/models/TransferRequest.js` - `getPendingForUser()` method

**Problem:** The filter for district admins was incorrectly overwriting the `$or` condition, making it impossible to see cross-district transfers.

**Fix Applied:**
```javascript
// Before (WRONG):
filter.$or = [
  { currentDistrict: user.district._id },
  { targetDistrict: user.district._id }
];
filter.currentDistrict = filter.targetDistrict = user.district._id; // ❌ Overwrites $or!

// After (CORRECT):
filter.currentDistrict = user.district._id;
filter.targetDistrict = user.district._id;
```

### 2. **Missing Virtual Fields** (Fixed)
**Location:** `solidarity-api/src/models/TransferRequest.js` - Schema options

**Problem:** Virtual fields like `isCrossDistrict` were not being serialized in API responses.

**Fix Applied:**
```javascript
// Added to schema options:
{
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
}
```

## Testing Instructions

### Step 1: Restart the API Server
```bash
cd solidarity-app/solidarity-api
npm run dev
```

### Step 2: Check Database for Pending Requests
Run the test script to see what's in the database:
```bash
cd solidarity-app/solidarity-api
node test-transfer-requests.js
```

This will show:
- All pending transfer requests
- Whether they are cross-district or within-district
- Who requested them
- Status breakdown

### Step 3: Test the API Endpoint Directly
Use curl or Postman to test the endpoint:

```bash
# Get your auth token from localStorage in the browser
# Then test the endpoint:

curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  "https://solidarity-app-api-erv6h.ondigitalocean.app/api/transfer-requests?status=pending"
```

### Step 4: Check Frontend
1. Log in as a state admin
2. Navigate to `/state-admin/transfer-approvals`
3. Check browser console for any errors
4. Check Network tab to see the API response

## Common Issues to Check

### If No Requests Are Showing:

1. **No pending requests exist in database**
   - Run the test script to verify
   - Create a test transfer request from a group admin account

2. **Authentication issue**
   - Check if token is valid
   - Check browser console for 401/403 errors

3. **API endpoint not responding**
   - Check if API server is running
   - Check CORS configuration
   - Verify the API URL in `.env` files

4. **Wrong status filter**
   - The frontend filters by `status=pending`
   - Check if requests have status 'pending' (not 'approved' or 'completed')

### Environment Variables to Check:

**Frontend** (`solidarity-app/.env.development`):
```
VITE_API_URL=http://localhost:5003/api
```

**Backend** (`solidarity-app/solidarity-api/.env`):
```
PORT=5003
MONGODB_URI=your_mongodb_connection_string
```

## API Endpoint Details

**Endpoint:** `GET /api/transfer-requests`

**Query Parameters:**
- `status` - Filter by status (pending, approved, rejected, completed)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `sort` - Sort field (default: -createdAt)

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "member": { "name": "...", "phone": "..." },
      "currentDistrict": { "name": "...", "code": "..." },
      "currentGroup": { "name": "...", "code": "..." },
      "targetDistrict": { "name": "...", "code": "..." },
      "targetGroup": { "name": "...", "code": "..." },
      "status": "pending",
      "isCrossDistrict": true,
      "reason": "...",
      "requestedBy": { "name": "...", "role": "..." },
      "createdAt": "..."
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalDocs": 5,
    "hasNextPage": false
  }
}
```

## Next Steps

1. Restart the API server to apply the fixes
2. Run the test script to verify database state
3. Test the frontend
4. If still not working, check the specific error messages in console
