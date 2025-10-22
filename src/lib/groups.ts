import { api } from './api';

export interface Group {
  _id: string;
  name: string;
  code: string;
  district: {
    _id: string;
    name: string;
    code: string;
  };
  admin?: {
    _id: string;
    name: string;
    phone: string;
    email: string;
  };
  statistics: {
    totalMembers: number;
    activeMembers: number;
    inactiveMembers: number;
    abroadMembers: number;
    applicantMembers: number;
    approvedMembers: number;
    pendingMembers: number;
    totalBaithulMaal: number;
    totalPaid: number;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    _id: string;
    name: string;
    phone: string;
  };
}

export interface CreateGroupData {
  name: string;
  code: string;
  district: string;
  admin?: string;
  isActive?: boolean;
}

export interface GroupFilters {
  page?: number;
  limit?: number;
  sort?: string;
  district?: string;
  isActive?: boolean;
  search?: string;
}

export const groupsApi = {
  // Get all groups with optional filters
  getGroups: async (params?: GroupFilters) => {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    return api.get<Group[]>(`/groups${queryString ? `?${queryString}` : ''}`);
  },

  // Get single group by ID
  getGroup: async (id: string) => {
    return api.get<Group>(`/groups/${id}`);
  },

  // Create new group
  createGroup: async (data: CreateGroupData) => {
    return api.post<Group>('/groups', data);
  },

  // Update group
  updateGroup: async (id: string, data: Partial<CreateGroupData>) => {
    return api.put<Group>(`/groups/${id}`, data);
  },

  // Delete group
  deleteGroup: async (id: string) => {
    return api.delete(`/groups/${id}`);
  },

  // Get group statistics
  getGroupStats: async (id: string) => {
    return api.get(`/groups/${id}/stats`);
  },

  // Get members in group
  getGroupMembers: async (id: string, params?: { 
    page?: number; 
    limit?: number; 
    sort?: string; 
    status?: string;
    isApproved?: boolean;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    return api.get(`/groups/${id}/members${queryString ? `?${queryString}` : ''}`);
  },
};