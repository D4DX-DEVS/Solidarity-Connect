import { api } from './api';

export interface Meeting {
  _id: string;
  title: string;
  description?: string;
  scheduledDate: string;
  duration: number;
  meetingType: 'general' | 'emergency' | 'training' | 'review';
  targetAudience: 'all' | 'group_admins' | 'district_admins' | 'specific_groups' | 'specific_districts';
  targetGroups?: Array<{
    _id: string;
    name: string;
    code: string;
  }>;
  targetDistricts?: Array<{
    _id: string;
    name: string;
    code: string;
  }>;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled' | 'postponed';
  createdBy: {
    _id: string;
    name: string;
    phone: string;
    role: string;
  };
  createdAt: string;
  updatedAt: string;
  attendance?: Array<{
    user?: string;
    member?: string;
    status: 'present' | 'absent' | 'late';
    markedAt: string;
  }>;
  minutes?: {
    summary?: string;
    decisions?: string[];
    actionItems?: Array<{
      description: string;
      assignedTo?: string;
      dueDate?: string;
      status: 'pending' | 'in_progress' | 'completed';
    }>;
  };
}

export interface CreateMeetingData {
  title: string;
  description?: string;
  scheduledDate: string;
  duration: number;
  meetingType: 'general' | 'emergency' | 'training' | 'review';
  targetAudience: 'all' | 'group_admins' | 'district_admins' | 'specific_groups' | 'specific_districts';
  targetGroups?: string[];
  targetDistricts?: string[];
}

export interface SessionData {
  title: string;
  description?: string;
  duration: number;
}

export interface CreateMonthlyMeetingData {
  title: string;
  description: string;
  month: number;
  year: number;
  sessions?: SessionData[];
  file?: File;
}

export interface CreateFormData {
  monthOptions: Array<{ value: number; label: string }>;
  yearOptions: Array<{ value: number; label: string }>;
  defaults: {
    currentMonth: number;
    currentYear: number;
  };
  userInfo: {
    role: string;
    district?: any;
    group?: any;
  };
}

export const meetingsApi = {
  // Get all meetings with optional filters
  getMeetings: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    meetingType?: string;
    targetAudience?: string;
    upcoming?: boolean;
    past?: boolean;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    return api.get<Meeting[]>(`/meetings${queryString ? `?${queryString}` : ''}`);
  },

  // Get upcoming meetings
  getUpcomingMeetings: async () => {
    return api.get<Meeting[]>('/meetings/upcoming/list');
  },

  // Get single meeting by ID
  getMeeting: async (id: string) => {
    return api.get<Meeting>(`/meetings/${id}`);
  },

  // Get create form data
  getCreateFormData: async () => {
    return api.get<CreateFormData>('/meetings/create-data');
  },

  // Create new meeting
  createMeeting: async (data: CreateMeetingData) => {
    return api.post<Meeting>('/meetings', data);
  },

  // Create monthly meeting with sessions
  createMonthlyMeeting: async (data: CreateMonthlyMeetingData) => {
    console.log('API: Creating monthly meeting with data:', data);
    
    const formData = new FormData();
    
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('month', data.month.toString());
    formData.append('year', data.year.toString());
    formData.append('sessions', JSON.stringify(data.sessions || []));
    
    if (data.file) {
      formData.append('file', data.file);
    }

    // Debug: Log what's being sent
    console.log('FormData contents:');
    for (let [key, value] of formData.entries()) {
      console.log(key, value);
    }

    return api.postFormData('/meetings/monthly', formData);
  },

  // Update meeting
  updateMeeting: async (id: string, data: Partial<CreateMeetingData>) => {
    return api.put<Meeting>(`/meetings/${id}`, data);
  },

  // Delete meeting
  deleteMeeting: async (id: string) => {
    return api.delete(`/meetings/${id}`);
  },

  // Mark attendance
  markAttendance: async (id: string, status: 'present' | 'absent' | 'late', memberId: string, notes?: string) => {
    return api.post(`/meetings/${id}/attendance`, { status, memberId, notes });
  },

  // Get attendance
  getAttendance: async (id: string) => {
    return api.get(`/meetings/${id}/attendance`);
  },

  // Update meeting minutes
  updateMinutes: async (id: string, minutes: {
    summary?: string;
    decisions?: string[];
    actionItems?: Array<{
      description: string;
      assignedTo?: string;
      dueDate?: string;
      status: 'pending' | 'in_progress' | 'completed';
    }>;
  }) => {
    return api.put(`/meetings/${id}/minutes`, minutes);
  },

  // Session management for group admins
  markMemberAttendance: async (meetingId: string, sessionId: string, memberId: string, status: 'present' | 'absent' | 'late' | 'excused', notes?: string) => {
    return api.post(`/meetings/${meetingId}/sessions/${sessionId}/member-attendance`, {
      memberId,
      status,
      notes
    });
  },

  addGuest: async (meetingId: string, sessionId: string, guestData: {
    name: string;
    phone?: string;
    organization?: string;
    status?: 'present' | 'absent' | 'late';
    notes?: string;
  }) => {
    return api.post(`/meetings/${meetingId}/sessions/${sessionId}/add-guest`, guestData);
  },

  completeSession: async (meetingId: string, sessionId: string) => {
    return api.post(`/meetings/${meetingId}/sessions/${sessionId}/complete`);
  },

  // Bulk actions for group admins
  bulkSessionActions: async (meetingId: string, action: 'initialize_attendance' | 'mark_all_present' | 'complete_ready_sessions', sessionIds?: string[]) => {
    return api.post(`/meetings/${meetingId}/bulk-session-actions`, {
      action,
      sessionIds
    });
  },

  // Get attendance summary
  getAttendanceSummary: async (meetingId: string) => {
    return api.get(`/meetings/${meetingId}/attendance-summary`);
  },

  // Get group members for attendance
  getGroupMembers: async (groupId: string) => {
    return api.get(`/groups/${groupId}/members?limit=100`);
  },

  // Add guest to meeting (meeting-level, not session-level)
  addMeetingGuest: async (meetingId: string, guestData: {
    name: string;
    phone?: string;
    organization?: string;
    status?: 'present' | 'absent' | 'late';
    notes?: string;
  }) => {
    return api.post(`/meetings/${meetingId}/add-guest`, guestData);
  },
};