# Simplified Monthly Meeting API

## Overview

This simplified API focuses on creating monthly meetings with just the essential fields:
- **Title**: Meeting title
- **Description**: Meeting description  
- **File Upload**: Optional file attachment
- **Duration**: Session duration
- **Month/Year**: For which month the meeting is being created
- **Sessions**: Multiple sessions for the month

## API Endpoints

### 1. Get Creation Form Data

```
GET /api/meetings/create-data
```

**Response:**
```json
{
  "success": true,
  "data": {
    "monthOptions": [
      { "value": 1, "label": "January" },
      { "value": 2, "label": "February" },
      ...
    ],
    "yearOptions": [
      { "value": 2024, "label": "2024" },
      { "value": 2025, "label": "2025" },
      { "value": 2026, "label": "2026" }
    ],
    "defaults": {
      "currentMonth": 10,
      "currentYear": 2024
    },
    "userInfo": {
      "role": "state_admin",
      "district": {...},
      "group": {...}
    }
  }
}
```

### 2. Create Monthly Meeting (Simplified)

```
POST /api/meetings/monthly
Content-Type: multipart/form-data
```

**Form Fields:**
- `title` (required): Meeting title
- `description` (required): Meeting description
- `month` (required): Month number (1-12)
- `year` (required): Year (2020-2050)
- `sessions` (required): JSON string of sessions array
- `file` (optional): File upload

**Sessions JSON Format:**
```json
[
  {
    "title": "Session 1: Introduction",
    "description": "Basic introduction session",
    "scheduledDate": "2024-01-05T10:00:00.000Z",
    "duration": 90
  },
  {
    "title": "Session 2: Advanced Topics",
    "description": "Advanced discussion",
    "scheduledDate": "2024-01-12T14:00:00.000Z",
    "duration": 120
  }
]
```

## Frontend Form Example

### HTML Form
```html
<form id="monthlyMeetingForm" enctype="multipart/form-data">
  <!-- Meeting Title -->
  <div>
    <label for="title">Meeting Title *</label>
    <input type="text" id="title" name="title" required 
           placeholder="e.g., Monthly State Meeting">
  </div>

  <!-- Description -->
  <div>
    <label for="description">Description *</label>
    <textarea id="description" name="description" required 
              placeholder="Meeting description and agenda details"></textarea>
  </div>

  <!-- Month & Year -->
  <div>
    <label for="month">Month *</label>
    <select id="month" name="month" required>
      <option value="">Select Month</option>
      <!-- Populated from API -->
    </select>
  </div>

  <div>
    <label for="year">Year *</label>
    <select id="year" name="year" required>
      <option value="">Select Year</option>
      <!-- Populated from API -->
    </select>
  </div>

  <!-- File Upload -->
  <div>
    <label for="file">Upload File (Optional)</label>
    <input type="file" id="file" name="file" 
           accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.ppt,.pptx,.jpg,.jpeg,.png,.gif">
  </div>

  <!-- Sessions -->
  <div id="sessionsContainer">
    <h3>Sessions</h3>
    <div id="sessionsList">
      <!-- Sessions will be added dynamically -->
    </div>
    <button type="button" onclick="addSession()">Add Session</button>
  </div>

  <button type="submit">Create Monthly Meeting</button>
</form>
```

### JavaScript Implementation
```javascript
// Load form data
async function loadFormData() {
  const response = await fetch('/api/meetings/create-data', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  // Populate month options
  const monthSelect = document.getElementById('month');
  data.data.monthOptions.forEach(option => {
    monthSelect.innerHTML += `<option value="${option.value}">${option.label}</option>`;
  });
  
  // Populate year options
  const yearSelect = document.getElementById('year');
  data.data.yearOptions.forEach(option => {
    yearSelect.innerHTML += `<option value="${option.value}">${option.label}</option>`;
  });
  
  // Set defaults
  monthSelect.value = data.data.defaults.currentMonth;
  yearSelect.value = data.data.defaults.currentYear;
}

// Session management
let sessionCount = 0;

function addSession() {
  sessionCount++;
  const sessionHtml = `
    <div class="session-item" data-session="${sessionCount}">
      <h4>Session ${sessionCount}</h4>
      
      <div>
        <label>Session Title *</label>
        <input type="text" name="session_${sessionCount}_title" required 
               placeholder="e.g., Leadership Fundamentals">
      </div>
      
      <div>
        <label>Description</label>
        <textarea name="session_${sessionCount}_description" 
                  placeholder="Session description"></textarea>
      </div>
      
      <div>
        <label>Scheduled Date & Time *</label>
        <input type="datetime-local" name="session_${sessionCount}_date" required>
      </div>
      
      <div>
        <label>Duration (minutes)</label>
        <input type="number" name="session_${sessionCount}_duration" 
               value="60" min="30" max="240">
      </div>
      
      <button type="button" onclick="removeSession(${sessionCount})">Remove Session</button>
    </div>
  `;
  
  document.getElementById('sessionsList').innerHTML += sessionHtml;
}

function removeSession(sessionId) {
  const sessionElement = document.querySelector(`[data-session="${sessionId}"]`);
  sessionElement.remove();
}

// Form submission
document.getElementById('monthlyMeetingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData();
  
  // Basic fields
  formData.append('title', document.getElementById('title').value);
  formData.append('description', document.getElementById('description').value);
  formData.append('month', document.getElementById('month').value);
  formData.append('year', document.getElementById('year').value);
  
  // File upload
  const fileInput = document.getElementById('file');
  if (fileInput.files[0]) {
    formData.append('file', fileInput.files[0]);
  }
  
  // Collect sessions
  const sessions = [];
  const sessionItems = document.querySelectorAll('.session-item');
  
  sessionItems.forEach((item, index) => {
    const sessionNum = item.dataset.session;
    const session = {
      title: document.querySelector(`[name="session_${sessionNum}_title"]`).value,
      description: document.querySelector(`[name="session_${sessionNum}_description"]`).value,
      scheduledDate: new Date(document.querySelector(`[name="session_${sessionNum}_date"]`).value).toISOString(),
      duration: parseInt(document.querySelector(`[name="session_${sessionNum}_duration"]`).value)
    };
    sessions.push(session);
  });
  
  formData.append('sessions', JSON.stringify(sessions));
  
  // Submit form
  try {
    const response = await fetch('/api/meetings/monthly', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('Monthly meeting created successfully!');
      // Redirect or refresh
      window.location.href = '/meetings';
    } else {
      alert('Error: ' + result.message);
    }
  } catch (error) {
    alert('Error creating meeting: ' + error.message);
  }
});

// Initialize form
loadFormData();
addSession(); // Add first session by default
```

## cURL Example

```bash
curl -X POST http://localhost:3333/api/meetings/monthly \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=January 2024 Leadership Training" \
  -F "description=Comprehensive leadership development program for all members" \
  -F "month=1" \
  -F "year=2024" \
  -F 'sessions=[
    {
      "title": "Leadership Fundamentals",
      "description": "Basic leadership principles and team management",
      "scheduledDate": "2024-01-05T10:00:00.000Z",
      "duration": 120
    },
    {
      "title": "Communication Skills",
      "description": "Effective communication and public speaking",
      "scheduledDate": "2024-01-12T14:00:00.000Z",
      "duration": 90
    }
  ]' \
  -F "file=@meeting-materials.pdf"
```

## Response Format

```json
{
  "success": true,
  "message": "Monthly meeting with sessions created successfully",
  "data": {
    "meeting": {
      "_id": "meeting_id",
      "title": "January 2024 Leadership Training",
      "description": "Comprehensive leadership development program",
      "meetingType": "monthly_series",
      "monthlyDetails": {
        "month": 1,
        "year": 2024,
        "synopsis": "Comprehensive leadership development program",
        "totalSessions": 2
      },
      "scheduledDate": "2024-01-05T10:00:00.000Z",
      "targetAudience": "all",
      "createdBy": {...}
    },
    "sessions": [
      {
        "_id": "session_id_1",
        "sessionNumber": 1,
        "title": "Leadership Fundamentals",
        "description": "Basic leadership principles and team management",
        "scheduledDate": "2024-01-05T10:00:00.000Z",
        "duration": 120,
        "attachments": [
          {
            "filename": "file-1234567890-123456789.pdf",
            "originalName": "meeting-materials.pdf",
            "mimetype": "application/pdf",
            "size": 1024000,
            "uploadedBy": "user_id",
            "uploadedAt": "2024-01-01T12:00:00.000Z"
          }
        ]
      },
      {
        "_id": "session_id_2",
        "sessionNumber": 2,
        "title": "Communication Skills",
        "description": "Effective communication and public speaking",
        "scheduledDate": "2024-01-12T14:00:00.000Z",
        "duration": 90,
        "attachments": []
      }
    ]
  }
}
```

## Key Simplifications

1. **Removed Complex Fields**: No target audience selection, meeting type selection
2. **Default Values**: Automatically sets `targetAudience` to "all" and `meetingType` to "monthly_series"
3. **File Upload**: Single file upload that gets attached to the first session
4. **Simplified Validation**: Reduced field requirements and validation complexity
5. **Form-Friendly**: Supports both JSON and form-data submission for easier frontend integration

## Usage Flow

1. **Load Form**: Call `/create-data` to get month/year options
2. **Fill Form**: User enters title, description, selects month/year
3. **Add Sessions**: User adds multiple sessions with titles, descriptions, dates, and durations
4. **Upload File**: Optional file upload for meeting materials
5. **Submit**: Form submits as multipart/form-data to `/monthly` endpoint
6. **Success**: Meeting and sessions are created, file is attached to first session