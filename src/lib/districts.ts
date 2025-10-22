import { api } from './api';

export interface District {
  _id: string;
  name: string;
  code: string;
  admin?: {
    _id: string;
    name: string;
    phone: string;
    email: string;
  };
  statistics: {
    totalGroups: number;
    totalMembers: number;
    activeMembers: number;
    inactiveMembers: number;
    abroadMembers: number;
    applicantMembers: number;
    approvedMembers: number;
    pendingMembers: number;
    totalBaithulMaal: number;
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

export interface CreateDistrictData {
  name: string;
  code: string;
  admin?: string;
  isActive?: boolean;
}

export interface DistrictFilters {
  page?: number;
  limit?: number;
  sort?: string;
  isActive?: boolean;
  search?: string;
}

export const districtsApi = {
  // Get all districts with optional filters
  getDistricts: async (params?: DistrictFilters) => {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    return api.get<District[]>(`/districts${queryString ? `?${queryString}` : ''}`);
  },

  // Get single district by ID
  getDistrict: async (id: string) => {
    return api.get<District>(`/districts/${id}`);
  },

  // Create new district
  createDistrict: async (data: CreateDistrictData) => {
    return api.post<District>('/districts', data);
  },

  // Update district
  updateDistrict: async (id: string, data: Partial<CreateDistrictData>) => {
    return api.put<District>(`/districts/${id}`, data);
  },

  // Delete district
  deleteDistrict: async (id: string) => {
    return api.delete(`/districts/${id}`);
  },

  // Get district statistics
  getDistrictStats: async (id: string) => {
    return api.get(`/districts/${id}/stats`);
  },

  // Get groups in district
  getDistrictGroups: async (id: string, params?: { page?: number; limit?: number; sort?: string; isActive?: boolean }) => {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    return api.get(`/districts/${id}/groups${queryString ? `?${queryString}` : ''}`);
  },

  // Get members in district
  getDistrictMembers: async (id: string, params?: { 
    page?: number; 
    limit?: number; 
    sort?: string; 
    status?: string;
    group?: string;
    isApproved?: boolean;
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
    return api.get(`/districts/${id}/members${queryString ? `?${queryString}` : ''}`);
  },
};