// Centralized API utility for consistent API calls across the application
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://solidarity-app-api-erv6h.ondigitalocean.app/api';

// Debug logging
console.log('🔧 API Configuration:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  API_BASE_URL: API_BASE_URL,
  NODE_ENV: import.meta.env.NODE_ENV,
});

// Generic API call function
export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  // Add auth token if available
  const token = localStorage.getItem('token');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  console.log(`🌐 API Call: ${config.method || 'GET'} ${url}`);

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status}`, data);
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    console.log(`✅ API Success: ${config.method || 'GET'} ${url}`);
    return data;
  } catch (error) {
    console.error(`💥 API Call Failed: ${url}`, error);
    throw error;
  }
};

// Auth API calls
export const authAPI = {
  sendOTP: (phone: string, userType: string) => 
    apiCall('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, userType }),
    }),

  verifyOTP: (phone: string, otp: string, userType: string) =>
    apiCall('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, userType }),
    }),

  resendOTP: (phone: string, userType: string) =>
    apiCall('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, userType }),
    }),

  getProfile: () => apiCall('/auth/me'),
};

// Member Auth API calls
export const memberAuthAPI = {
  sendOTP: (phone: string) =>
    apiCall('/member-auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  verifyOTP: (phone: string, otp: string) =>
    apiCall('/member-auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    }),

  resendOTP: (phone: string) =>
    apiCall('/member-auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  getProfile: () => apiCall('/member-auth/profile'),

  getTargets: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/member-auth/targets${queryString}`);
  },

  getMeetings: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/member-auth/meetings${queryString}`);
  },

  getNotifications: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/member-auth/notifications${queryString}`);
  },

  getBaithulMaal: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/member-auth/baithul-maal${queryString}`);
  },
};

// Users API calls
export const usersAPI = {
  getUsers: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/users${queryString}`);
  },

  createUser: (userData: any) =>
    apiCall('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  updateUser: (userId: string, userData: any) =>
    apiCall(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),

  toggleUserStatus: (userId: string) =>
    apiCall(`/users/${userId}/toggle-status`, {
      method: 'POST',
    }),

  deleteUser: (userId: string) =>
    apiCall(`/users/${userId}`, {
      method: 'DELETE',
    }),

  getUserStats: () => apiCall('/users/stats/overview'),
};

// Districts API calls
export const districtsAPI = {
  getDistricts: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/districts${queryString}`);
  },

  getDistrictGroups: (districtId: string, params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/districts/${districtId}/groups${queryString}`);
  },
};

// Groups API calls
export const groupsAPI = {
  getGroups: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/groups${queryString}`);
  },
};

// Members API calls
export const membersAPI = {
  getMembers: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/members${queryString}`);
  },

  getMember: (id: string) => apiCall(`/members/${id}`),

  createMember: (memberData: any) =>
    apiCall('/members', {
      method: 'POST',
      body: JSON.stringify(memberData),
    }),

  updateMember: (id: string, memberData: any) =>
    apiCall(`/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(memberData),
    }),

  getUserContext: () => apiCall('/members/user-context'),
};

// Meetings API calls
export const meetingsAPI = {
  getMeetings: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/meetings${queryString}`);
  },

  getAdminOverview: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/meetings/admin/overview${queryString}`);
  },

  getAdminReview: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/meetings/admin/review${queryString}`);
  },

  initializeAttendance: (meetingId: string) =>
    apiCall(`/meetings/${meetingId}/initialize-attendance`, {
      method: 'POST',
    }),

  markSessionComplete: (meetingId: string, sessionId: string) =>
    apiCall(`/meetings/${meetingId}/sessions/${sessionId}/complete`, {
      method: 'POST',
    }),

  addGuest: (meetingId: string, guestData: any) =>
    apiCall(`/meetings/${meetingId}/guests`, {
      method: 'POST',
      body: JSON.stringify(guestData),
    }),
};

// Baithul Maal API calls
export const baithulMaalAPI = {
  getStats: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/baithul-maal/stats${queryString}`);
  },
  
  getBaithulData: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/baithul-maal${queryString}`);
  },

  getPayments: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/baithul-maal-payments${queryString}`);
  },

  getMemberPayments: (memberId: string) => 
    apiCall(`/baithul-maal-payments/member/${memberId}`),

  createPayment: (paymentData: any) =>
    apiCall('/baithul-maal-payments', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    }),

  updatePayment: (paymentId: string, paymentData: any) =>
    apiCall(`/baithul-maal-payments/${paymentId}`, {
      method: 'PUT',
      body: JSON.stringify(paymentData),
    }),

  deletePayment: (paymentId: string) =>
    apiCall(`/baithul-maal-payments/${paymentId}`, {
      method: 'DELETE',
    }),
};

// Transfer Requests API calls
export const transferRequestsAPI = {
  createTransferRequest: (requestData: any) =>
    apiCall('/transfer-requests', {
      method: 'POST',
      body: JSON.stringify(requestData),
    }),
};

// Reports API calls
export const reportsAPI = {
  getDashboard: () => apiCall('/reports/dashboard'),
  getMembers: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/reports/members${queryString}`);
  },
  getBaithulMaal: (params?: Record<string, any>) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall(`/reports/baithul-maal${queryString}`);
  },
};

export default {
  apiCall,
  authAPI,
  memberAuthAPI,
  usersAPI,
  districtsAPI,
  groupsAPI,
  membersAPI,
  meetingsAPI,
  baithulMaalAPI,
  transferRequestsAPI,
  reportsAPI,
};