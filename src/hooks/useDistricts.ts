import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { districtsApi, District, CreateDistrictData, DistrictFilters } from '@/lib/districts';

// Query keys
const districtKeys = {
  all: ['districts'] as const,
  lists: () => [...districtKeys.all, 'list'] as const,
  list: (filters: DistrictFilters) => [...districtKeys.lists(), filters] as const,
  details: () => [...districtKeys.all, 'detail'] as const,
  detail: (id: string) => [...districtKeys.details(), id] as const,
  stats: (id: string) => [...districtKeys.detail(id), 'stats'] as const,
  groups: (id: string) => [...districtKeys.detail(id), 'groups'] as const,
  members: (id: string) => [...districtKeys.detail(id), 'members'] as const,
};

// Get districts list
export const useDistricts = (params?: DistrictFilters) => {
  return useQuery({
    queryKey: districtKeys.list(params || {}),
    queryFn: () => districtsApi.getDistricts(params),
  });
};

// Get single district
export const useDistrict = (id: string) => {
  return useQuery({
    queryKey: districtKeys.detail(id),
    queryFn: () => districtsApi.getDistrict(id),
    enabled: !!id,
  });
};

// Create district mutation
export const useCreateDistrict = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateDistrictData) => districtsApi.createDistrict(data),
    onSuccess: () => {
      // Invalidate and refetch districts
      queryClient.invalidateQueries({ queryKey: districtKeys.lists() });
    },
  });
};

// Update district mutation
export const useUpdateDistrict = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateDistrictData> }) => 
      districtsApi.updateDistrict(id, data),
    onSuccess: (_, { id }) => {
      // Invalidate specific district and all districts
      queryClient.invalidateQueries({ queryKey: districtKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: districtKeys.lists() });
    },
  });
};

// Delete district mutation
export const useDeleteDistrict = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => districtsApi.deleteDistrict(id),
    onSuccess: () => {
      // Invalidate and refetch districts
      queryClient.invalidateQueries({ queryKey: districtKeys.lists() });
    },
  });
};

// Get district statistics
export const useDistrictStats = (id: string) => {
  return useQuery({
    queryKey: districtKeys.stats(id),
    queryFn: () => districtsApi.getDistrictStats(id),
    enabled: !!id,
  });
};

// Get district groups
export const useDistrictGroups = (id: string, params?: { page?: number; limit?: number; sort?: string; isActive?: boolean }) => {
  return useQuery({
    queryKey: districtKeys.groups(id),
    queryFn: () => districtsApi.getDistrictGroups(id, params),
    enabled: !!id,
  });
};

// Get district members
export const useDistrictMembers = (id: string, params?: { 
  page?: number; 
  limit?: number; 
  sort?: string; 
  status?: string;
  group?: string;
  isApproved?: boolean;
}) => {
  return useQuery({
    queryKey: districtKeys.members(id),
    queryFn: () => districtsApi.getDistrictMembers(id, params),
    enabled: !!id,
  });
};