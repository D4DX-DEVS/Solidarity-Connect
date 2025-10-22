# Attendance Management for State and District Admins

This document outlines the comprehensive attendance management features available for State Admins and District Admins in the Solidarity API.

## Overview

The attendance system has been enhanced to provide state and district administrators with detailed insights into meeting attendance across their jurisdictions. The system tracks both member and guest attendance for all meeting types, with special focus on monthly series meetings.

## Key Features

### 1. Role-Based Access Control
- **State Admin**: Can view attendance data for all districts and groups
- **District Admin**: Can only view attendance data for their assigned district
- Both roles can filter data by month, year, district, and group

### 2. Comprehensive Attendance Tracking
- Member attendance (present, absent, late, excused)
- Guest attendance (present, absent, late)
- Session-based tracking for monthly series meetings
- Real-time attendance rate calculations

### 3. Statistical Analysis
- Group-wise attendance statistics
- District-wise attendance statistics
- Monthly attendance trends
- Top performing groups identification
- Session completion tracking

## API Endpoints

### Attendance Reports

#### 1. Attendance Summary Dashboard
```
GET /api/reports/attendance/summary
```
**Access**: State Admin, District Admin  
**Description**: Get attendance summary statistics for dashboard display

**Response includes**:
- This month's attendance statistics
- Overall attendance statistics (last 6 months)
- Top performing groups by attendance rate
- Monthly attendance trends (last 12 mon