import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi, Meeting, CreateMeetingData, CreateMonthlyMeetingData, CreateFormData } from '@/lib/meetings';

// Query keys
export const meetingKeys = {
  all: ['meetings'] as const,
  lists: () => [...meetingKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...meetingKeys.lists(), filters] as const,
  details: () => [...meetingKeys.all, 'detail'] as const,
  detail: (id: string) => [...meetingKeys.details(), id] as const,
  upcoming: () => [...meetingKeys.all, 'upcoming'] as const,
  createData: () => [...meetingKeys.all, 'create-data'] as const,
};

// Get all meetings
export const useMeetings = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  meetingType?: string;
  targetAudience?: string;
  upcoming?: boolean;
  past?: boolean;
  search?: string;
}) => {
  return useQuery({
    queryKey: meetingKeys.list(params || {}),
    queryFn: () => meetingsApi.getMeetings(params),
  });
};

// Get upcoming meetings
export const useUpcomingMeetings = () => {
  return useQuery({
    queryKey: meetingKeys.upcoming(),
    queryFn: meetingsApi.getUpcomingMeetings,
  });
};

// Get single meeting
export const useMeeting = (id: string) => {
  return useQuery({
    queryKey: meetingKeys.detail(id),
    queryFn: () => meetingsApi.getMeeting(id),
    enabled: !!id,
  });
};

// Get create form data
export const useCreateFormData = () => {
  return useQuery({
    queryKey: meetingKeys.createData(),
    queryFn: meetingsApi.getCreateFormData,
    retry: 2,
    retryDelay: 1000,
  });
};

// Create meeting mutation
export const useCreateMeeting = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateMeetingData) => meetingsApi.createMeeting(data),
    onSuccess: () => {
      // Invalidate and refetch meetings
      queryClient.invalidateQueries({ queryKey: meetingKeys.all });
    },
  });
};

// Create monthly meeting mutation
export const useCreateMonthlyMeeting = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateMonthlyMeetingData) => meetingsApi.createMonthlyMeeting(data),
    onSuccess: () => {
      // Invalidate and refetch meetings
      queryClient.invalidateQueries({ queryKey: meetingKeys.all });
    },
  });
};

// Update meeting mutation
export const useUpdateMeeting = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateMeetingData> }) => 
      meetingsApi.updateMeeting(id, data),
    onSuccess: (_, { id }) => {
      // Invalidate specific meeting and all meetings
      queryClient.invalidateQueries({ queryKey: meetingKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: meetingKeys.all });
    },
  });
};

// Delete meeting mutation
export const useDeleteMeeting = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => meetingsApi.deleteMeeting(id),
    onSuccess: () => {
      // Invalidate and refetch meetings
      queryClient.invalidateQueries({ queryKey: meetingKeys.all });
    },
  });
};