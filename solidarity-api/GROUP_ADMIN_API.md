# Group Admin API Guide

## Key Points for Frontend Development

### 1. Check User Context First
```javascript
GET /api/members/user-context

// Response for group admin:
{
  "showDistrictField": false,  // ❌ Hide district dropdown
  "showGroupField": false,     // ❌ Hide group dropdown
  "assignedDistrict": {
    "name": "Thrissur",
    "code": "TSR"
  },
  "assignedGroup": {
    "name": "Varantharappalli", 
    "code": "VRP"
  }
}
```

### 2. Frontend Form for Group Admin
```html
<!-- Show these fields -->
<input name="name" placeholder="Member Name" required />
<input name="phone" placeholder="+919876543210" required />
<input name="email" placeholder="email@example.com" />
<input name="profession" placeholder="Engineer" />
<input name="education" placeholder="B.Tech" />

<!-- DON'T show these for group admin -->
<!-- <select name="district">...</select> ❌ -->
<!-- <select name="group">...</select> ❌ -->

<!-- Instead, show read-only info -->
<div>District: Thrissur (Auto-assigned)</div>
<div>Group: Varantharappalli (Auto-assigned)</div>
```

### 3. API Request (Group Admin)
```javascript
// What frontend sends (NO district/group)
POST /api/members
{
  "name": "John Doe",
  "phone": "+919876543210", 
  "email": "john@example.com",
  "profession": "Engineer",
  "education": "B.Tech"
  // ❌ NO "district" field
  // ❌ NO "group" field
}

// What backend returns (WITH district/group auto-assigned)
{
  "success": true,
  "data": {
    "name": "John Doe",
    "phone": "+919876543210",
    "district": {
      "name": "Thrissur",
      "code": "TSR"
    },
    "group": {
      "name": "Varantharappalli", 
      "code": "VRP"
    },
    "status": "Inactive",  // Default
    "isApproved": false    // Group admin cannot auto-approve
  }
}
```

### 4. Implementation Steps

1. **Call user-context API** when page loads
2. **If `showDistrictField: false`** → Hide district dropdown
3. **If `showGroupField: false`** → Hide group dropdown  
4. **Show assigned district/group** as read-only text
5. **Don't send district/group** in create/update requests
6. **Backend handles everything automatically**

### 5. Benefits
- ✅ Simpler frontend form for group admins
- ✅ No risk of wrong district/group selection
- ✅ Automatic assignment from user profile
- ✅ Consistent data integrity
- ✅ Better user experience