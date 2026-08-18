import { api } from '@/lib/api';

// Murabi and Coordinator admins sit at the same level as Area Admins — same permissions,
// same area scoping — but consolidate as their own rows.
export type ConsolidationUserType =
  | 'district_admin'
  | 'area_admin'
  | 'murabi_admin'
  | 'coordinator_admin'
  | 'unit_admin'
  | 'members';

export interface ConsolidationTarget {
  _id: string;
  title: string;
  category: string;
  isRecurring: boolean;
  recurringFrequency?: 'weekly' | 'monthly' | 'quarterly';
  targetValue: number;
  unit: string;
  startDate: string;
  endDate: string;
  targetAudience: string;
}

export interface ConsolidationUser {
  userId: string;
  name: string;
  phone: string;
  role?: string;
  roleTag?: string;
  adminKind?: string | null;
  area?: string;
  district: string;
  group: string;
  completedAt?: string | null;
  lastActivity?: string | null;
  status?: string;
  progressPercentage?: number;
  completedMonths?: string[];
  completedCount?: number;
  totalPeriods?: number;
}

export interface MonthlyBreakdown {
  month: number;
  year: number;
  label: string;
  total: number;
  completed: number;
  pending: number;
  completionRate: number;
}

export interface ConsolidationReport {
  target: {
    _id: string;
    title: string;
    category: string;
    isRecurring: boolean;
    recurringFrequency?: string;
    targetValue: number;
    unit: string;
  };
  summary: {
    totalUsers: number;
    completed: number;
    pending: number;
    completionRate: number;
  };
  monthlyBreakdown: MonthlyBreakdown[];
  users: {
    completed: ConsolidationUser[];
    pending: ConsolidationUser[];
  };
}

export interface ConsolidationFilters {
  userType: ConsolidationUserType;
  targetId: string;
  districtId?: string;
  groupId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const consolidationService = {
  getTargets: async (userType: ConsolidationUserType) => {
    return api.get<ConsolidationTarget[]>(`/consolidation/targets?userType=${userType}`);
  },

  getReport: async (filters: ConsolidationFilters) => {
    const params = new URLSearchParams();
    params.set('userType', filters.userType);
    params.set('targetId', filters.targetId);
    if (filters.districtId && filters.districtId !== 'all') params.set('districtId', filters.districtId);
    if (filters.groupId && filters.groupId !== 'all') params.set('groupId', filters.groupId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);

    return api.get<ConsolidationReport>(`/consolidation/report?${params.toString()}`);
  }
};
