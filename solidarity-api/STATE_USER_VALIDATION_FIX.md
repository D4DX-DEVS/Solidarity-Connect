# State User Validation Fix

## Issue
When creating a state user, validation was failing with errors:
- Phone number validation expected `+91` prefix but received 10-digit format
- Email validation was required even when empty
- District and group fields were showing as required for state admin

## Changes Made

### 1. User Model (`src/models/User.js`)
- **Phone validation**: Changed from `/^\+91[6-9]\d{9}$/` to `/^[6-9]\d{9}$/` to accept 10-digit format
- **Email validation**: Changed from `match` to custom `validate` function that allows empty values
- **District requirement**: Removed district requirement for state_admin role (only required for district_admin)

### 2. User Routes (`src/routes/users.js`)
- **Phone validation**: Updated to accept 10-digit format `/^[6-9]\d{9}$/`
- **Optional fields**: Added `{ checkFalsy: true }` to email, district, and group validations to properly handle empty strings

## Validation Rules for State User Creation

### Required Fields
- `name`: 2-100 characters
- `phone`: 10-digit number starting with 6-9 (e.g., 9947497805)
- `role`: Must be 'state_admin', 'district_admin', or 'group_admin'

### Optional Fields
- `email`: Valid email format (can be empty)
- `district`: MongoDB ObjectId (not required for state_admin)
- `group`: MongoDB ObjectId (not required for state_admin)

## Test Results
✓ Phone number validation accepts 10-digit format
✓ Email validation allows empty values  
✓ District validation allows empty values for state admin
✓ Group validation allows empty values for state admin

## API Usage Example
```javascript
POST /api/users
{
  "name": "Test State Admin",
  "phone": "9947497805",
  "role": "state_admin"
  // email, district, group are optional
}
```

The validation fix ensures state users can be created with minimal required fields while maintaining proper validation for other user types.