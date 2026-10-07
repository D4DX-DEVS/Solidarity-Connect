// Centralized API utility for consistent API calls across the application
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://solidarity-app-api-erv6h.ondigitalocean.app/api';

// Debug logging
console.log('🔧 API Configuration:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  API_BASE_URL: API_BASE_URL,
  NODE_ENV: import.meta.env.NODE_ENV,
});

/**
 * Parsed JSON body of an API response. Left loose on purpose: dozens of pages
 * read fields straight off it, and each endpoint's shape is typed where it is
 * used (e.g. `as DashboardOverview`). Narrow at the call site, don't widen here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the one untyped boundary; see above
export type ApiJson = any;

/** Query-string values as callers pass them. */
export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/** "?a=1&b=x" — each value stringified exactly as URLSearchParams always did; "" without params. */
const toQuery = (params?: QueryParams): string =>
  params ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : '';

// Generic API call function
export const apiCall = async (endpoint: string, options: RequestInit = {}): Promise<ApiJson> => {
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
    // A delete flushed as the tab closes (undo window) still reaches the server.
    ...(options.method === 'DELETE' ? { keepalive: true } : {}),
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  console.log(`🌐 API Call: ${config.method || 'GET'} ${url}`);

  try {
    const response = await fetch(url, config);
    
    // Handle non-JSON responses (e.g. 429 rate limit plain text)
    const contentType = response.headers.get('content-type');
    let data: ApiJson;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = (await response.text()).trim();
      // ponytail: gateways (502/504) answer with a whole HTML error page — never
      // show that to a user; only short plain text is a real message.
      const usable = text && !text.startsWith('<') && text.length <= 200;
      data = { message: usable ? text : `Service unavailable (HTTP ${response.status}). Please try again.` };
    }

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status}`, data);
      const error = new Error(data.message || `HTTP ${response.status}`) as Error & { data?: unknown; status?: number };
      error.data = data;
      error.status = response.status;
      throw error;
    }

    console.log(`✅ API Success: ${config.method || 'GET'} ${url}`);
    return data;
  } catch (error) {
    console.error(`💥 API Call Failed: ${url}`, error);
    throw error;
  }
};

// Multipart API call (for file uploads — no Content-Type header so browser sets boundary)
export const multipartApiCall = async (endpoint: string, formData: FormData) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { method: 'POST', headers, body: formData });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
  return data;
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

  checkRoles: (phone: string) =>
    apiCall('/auth/check-roles', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  switchRole: (targetRole: string) =>
    apiCall('/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ targetRole }),
    }),

  getProfile: () => apiCall('/auth/me'),

  // Every account on the signed-in number, for the in-app switcher.
  listAccounts: () => apiCall('/auth/accounts'),

  // Switch by account id, so two area-level accounts (e.g. Area + Murabi) on the
  // same number are distinguishable — role-name-based switchRole cannot do that.
  switchAccount: (accountId: string, accountType: 'admin' | 'member') =>
    apiCall('/auth/switch-account', {
      method: 'POST',
      body: JSON.stringify({ accountId, accountType }),
    }),
};

/**
 * Phone-first sign-in: one WhatsApp code per number, then pick which of that
 * number's accounts to enter. Replaces the old pick-a-role-then-send-a-code flow.
 */
export const loginAPI = {
  sendOTP: (phone: string, resend = false) =>
    apiCall('/auth/login/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, resend }),
    }),

  verifyOTP: (phone: string, otp: string) =>
    apiCall('/auth/login/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    }),

  selectAccount: (ticket: string, accountId: string, accountType: 'admin' | 'member') =>
    apiCall('/auth/login/select-account', {
      method: 'POST',
      body: JSON.stringify({ ticket, accountId, accountType }),
    }),
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

  getMeetings: (params?: QueryParams) =>
    apiCall(`/member-auth/meetings${toQuery(params)}`),

  getNotifications: (params?: QueryParams) =>
    apiCall(`/member-auth/notifications${toQuery(params)}`),

  getBaithulMaal: (params?: QueryParams) =>
    apiCall(`/member-auth/baithul-maal${toQuery(params)}`),

  getDistricts: () => apiCall('/member-auth/districts'),

  getGroups: (params?: QueryParams) =>
    apiCall(`/member-auth/groups${toQuery(params)}`),

  /** The member's own area's monthly report totals. */
  getAreaReport: (params: { year: number; month: number }) =>
    apiCall(`/member-auth/area-report${toQuery(params)}`),

  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return multipartApiCall('/member-auth/uploads', formData);
  },

  getOrgFiles: (params?: QueryParams) =>
    apiCall(`/member-auth/org-files${toQuery(params)}`),

  /** Read-only directory of every member (org-wide). */
  getMembers: (params?: QueryParams) =>
    apiCall(`/member-auth/members${toQuery(params)}`),

  // keepalive: a change sent as the tab closes (undo window flush) still arrives
  updateProfile: (data: Record<string, unknown>, options: { keepalive?: boolean } = {}) =>
    apiCall('/member-auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options,
    }),

  requestProfileChange: (data: { name?: string; phone?: string; note?: string }) =>
    apiCall('/member-auth/profile-change-request', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Users API calls
export const usersAPI = {
  getUsers: (params?: QueryParams) =>
    apiCall(`/users${toQuery(params)}`),

  createUser: (userData: unknown) =>
    apiCall('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  updateUser: (userId: string, userData: unknown) =>
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
  getDistricts: (params?: QueryParams) =>
    apiCall(`/districts${toQuery(params)}`),

  getDistrictGroups: (districtId: string, params?: QueryParams) =>
    apiCall(`/districts/${districtId}/groups${toQuery(params)}`),

  // Minimal (id, name, code) list of any district's active groups — target picker for transfers.
  getTransferTargetGroups: (districtId: string) =>
    apiCall(`/districts/${districtId}/transfer-groups`),
};

// Groups API calls
export const groupsAPI = {
  getGroups: (params?: QueryParams) =>
    apiCall(`/groups${toQuery(params)}`),
};

// Members API calls
export const membersAPI = {
  getMembers: (params?: QueryParams) =>
    apiCall(`/members${toQuery(params)}`),

  getMember: (id: string) => apiCall(`/members/${id}`),

  approveMember: (id: string) =>
    apiCall(`/members/${id}/approve`, {
      method: 'POST',
    }),

  createMember: (memberData: unknown) =>
    apiCall('/members', {
      method: 'POST',
      body: JSON.stringify(memberData),
    }),

  updateMember: (id: string, memberData: unknown) =>
    apiCall(`/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(memberData),
    }),

  getUserContext: () => apiCall('/members/user-context'),

  updateMemberLeader: (memberId: string, data: { isLeader: boolean; roleTag?: { type?: string; name?: string; listingOrder?: number | null }; extraRoles?: { type?: string; name?: string; listingOrder?: number | null }[] }) =>
    apiCall(`/members/${memberId}/leader`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // District admins: move a member to another group (+ optional unit) inside their own district.
  moveMemberWithinDistrict: (memberId: string, data: { group: string; unit?: string }) =>
    apiCall(`/members/${memberId}/move`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Meetings API calls
export const meetingsAPI = {
  getMeetings: (params?: QueryParams) =>
    apiCall(`/meetings${toQuery(params)}`),

  getAdminOverview: (params?: QueryParams) =>
    apiCall(`/meetings/admin/overview${toQuery(params)}`),

  getAdminReview: (params?: QueryParams) =>
    apiCall(`/meetings/admin/review${toQuery(params)}`),

  initializeAttendance: (meetingId: string) =>
    apiCall(`/meetings/${meetingId}/bulk-session-actions`, {
      method: 'POST',
      body: JSON.stringify({ action: 'initialize_attendance' }),
    }),

  markSessionComplete: (meetingId: string, sessionId: string) =>
    apiCall(`/meetings/${meetingId}/sessions/${sessionId}/complete`, {
      method: 'POST',
    }),

  addGuest: (meetingId: string, guestData: unknown) =>
    apiCall(`/meetings/${meetingId}/add-guest`, {
      method: 'POST',
      body: JSON.stringify(guestData),
    }),
};

// Baithul Maal API calls
export const baithulMaalAPI = {
  getStats: (params?: QueryParams) =>
    apiCall(`/baithul-maal/stats${toQuery(params)}`),
  
  getBaithulData: (params?: QueryParams) =>
    apiCall(`/baithul-maal${toQuery(params)}`),

  getPayments: (params?: QueryParams) =>
    apiCall(`/baithul-maal-payments${toQuery(params)}`),

  getMemberPayments: (memberId: string) =>
    apiCall(`/baithul-maal-payments/member/${memberId}`),

  updateMemberAmount: (memberId: string, data: { monthlyAmount: number; startMonth?: string }) =>
    apiCall(`/baithul-maal/member/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  createPayment: (paymentData: unknown) =>
    apiCall('/baithul-maal-payments', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    }),

  updatePayment: (paymentId: string, paymentData: unknown) =>
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
  createTransferRequest: (requestData: unknown) =>
    apiCall('/transfer-requests', {
      method: 'POST',
      body: JSON.stringify(requestData),
    }),
};

// Requests API calls (edit/approval workflow)
export const requestsAPI = {
  getRequests: (params?: QueryParams) =>
    apiCall(`/requests${toQuery(params)}`),

  getRequest: (id: string) => apiCall(`/requests/${id}`),

  createRequest: (requestData: unknown) =>
    apiCall('/requests', {
      method: 'POST',
      body: JSON.stringify(requestData),
    }),

  approveRequest: (id: string) =>
    apiCall(`/requests/${id}/approve`, {
      method: 'POST',
    }),

  rejectRequest: (id: string, reason: string) =>
    apiCall(`/requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  addComment: (id: string, comment: string) =>
    apiCall(`/requests/${id}/comment`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    }),
};

// Reports API calls
export const reportsAPI = {
  getDashboard: () => apiCall('/reports/dashboard'),
  getDistrictCensus: (params?: QueryParams) =>
    apiCall(`/reports/census/districts${toQuery(params)}`),
  getDistrictUnits: (districtId: string) =>
    apiCall(`/reports/census/districts/${districtId}/units`),
  getMembers: (params?: QueryParams) =>
    apiCall(`/reports/members${toQuery(params)}`),
  getBaithulMaal: (params?: QueryParams) =>
    apiCall(`/reports/baithul-maal${toQuery(params)}`),
};

// Leaders API calls
export const leadersAPI = {
  getLeaders: (params?: QueryParams) =>
    apiCall(`/users/leaders${toQuery(params)}`),
  getMemberLeaders: (params?: QueryParams) =>
    apiCall(`/member-auth/leaders${toQuery(params)}`),
  updateLeader: (userId: string, data: { isLeader: boolean; roleTag?: { type?: string; name?: string; listingOrder?: number | null }; extraRoles?: { type?: string; name?: string; listingOrder?: number | null }[] }) =>
    apiCall(`/users/${userId}/leader`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Uploads API calls (DigitalOcean Spaces)
export const uploadsAPI = {
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return multipartApiCall('/uploads', formData);
  },
};

// Notifications API calls
export const notificationsAPI = {
  getNotifications: (params?: QueryParams) =>
    apiCall(`/notifications${toQuery(params)}`),
  getNotification: (id: string) => apiCall(`/notifications/${id}`),
  createNotification: (data: unknown) =>
    apiCall('/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateNotification: (id: string, data: unknown) =>
    apiCall(`/notifications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteNotification: (id: string) =>
    apiCall(`/notifications/${id}`, { method: 'DELETE' }),
};

export default {
  apiCall,
  multipartApiCall,
  authAPI,
  memberAuthAPI,
  usersAPI,
  districtsAPI,
  groupsAPI,
  membersAPI,
  meetingsAPI,
  baithulMaalAPI,
  transferRequestsAPI,
  requestsAPI,
  reportsAPI,
  leadersAPI,
  uploadsAPI,
  notificationsAPI,
};