# Frontend Integration Guide

## Group Admin Member Management

### API Endpoint for User Context
```
GET /api/members/user-context
```

This endpoint returns user context information that the frontend should use to conditionally show/hide form fields.

### Response for Group Admin:
```json
{
  "success": true,
  "data": {
    "userRole": "group_admin",
    "canSelectDistrict": false,
    "canSelectGroup": false,
    "showDistrictField": false,
    "showGroupField": false,
    "assignedDistrict": {
      "_id": "...",
      "name": "Thrissur",
      "code": "TSR"
    },
    "assignedGroup": {
      "_id": "...",
      "name": "Varantharappalli", 
      "code": "VRP"
    },
    "permissions": {
      "canCreateMember": true,
      "canEditMember": true,
      "canDeleteMember": false,
      "canApproveMember": false,
      "canViewReports": true,
      "canBulkImport": true
    }
  }
}
```

### Frontend Implementation:

1. **Call the user-context API** when loading the add/edit member form
2. **Hide District and Group fields** when `showDistrictField: false` and `showGroupField: false`
3. **Display assigned district/group info** (read-only) using `assignedDistrict` and `assignedGroup`
4. **Hide delete button** when `permissions.canDeleteMember: false`

### Member Creation/Update:
- For group admins, **DO NOT** send `district` and `group` in the request body
- The backend will automatically assign the correct district and group
- Even if sent, the backend will override with the group admin's assigned values

### Example Frontend Logic:
```javascript
// Get user context
const context = await fetch('/api/members/user-context');
const { showDistrictField, showGroupField, assignedDistrict, assignedGroup, permissions } = context.data;

// Conditionally render form fields
if (showDistrictField) {
  // Show district dropdown
} else {
  // Show read-only district info: assignedDistrict.name
}

if (showGroupField) {
  // Show group dropdown  
} else {
  // Show read-only group info: assignedGroup.name
}

// Hide delete button for group admins
if (!permissions.canDeleteMember) {
  // Hide delete button
}
```

### Member Form Data:
For group admins, only send these fields:
```json
{
  "name": "Member Name",
  "phone": "+919876543210",
  "email": "email@example.com",
  "dateOfBirth": "1990-01-15",
  "bloodGroup": "A+",
  "profession": "Engineer",
  "education": "B.Tech",
  "address": "Full Address",
  "status": "Inactive" // Optional, defaults to Inactive
}
```

**Note:** Do NOT include `district` or `group` fields for group admins - they will be auto-assigned by the backend.