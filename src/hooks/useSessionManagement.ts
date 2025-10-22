import { useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi } from '@/lib/meetings';
import { meetingKeys } from './useMeetings';

export const useMarkMemberAttendance = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      meetingId, 
      sessionId, 
      memberId, 
      status, 
      notes 
    }: {
      meetingId: string;
      sessionId: string;
      memberId: string;
      status: 'present' | 'absent' | 'late' | 'excused';
      notes?: string;
    }) => meetingsApi.markMemberAttendance(meetingId, sessionId, memberId, status, notes),
    onSuccess: (_, { meetingId }) => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.detail(meetingId) });
      queryClient.invalidateQueries({ queryKey: meetingKeys.all });
    },
  });
};

export const useAddGuest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      meetingId, 
      sessionId, 
      guestData 
    }: {
      meetingId: string;
      sessionId: string;
      guestData: {
        name: string;
        phone?: string;
        organization?: string;
        status?: 'present' | 'absent' | 'late';
        notes?: string;
      };
    }) => meetingsApi.addGuest(meetingId, sessionId, guestData),
    onSuccess: (_, { meetingId }) => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.detail(meetingId) });
      queryClient.invalidateQueries({ queryKey: meetingKeys.all });
    },
  });
};

export const useCompleteSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ meetingId, sessionId }: { meetingId: string; sessionId: string }) => 
      meetingsApi.completeSession(meetingId, sessionId),
    onSuccess: (_, { meetingId }) => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.detail(meetingId) });
      queryClient.invalidateQueries({ queryKey: meetingKeys.all });
    },
  });
};

export const useBulkSessionActions = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      meetingId, 
      action, 
      sessionIds 
    }: {
      meetingId: string;
      action: 'initialize_attendance' | 'mark_all_present' | 'complete_ready_sessions';
      sessionIds?: string[];
    }) => meetingsApi.bulkSessionActions(meetingId, action, sessionIds),
    onSuccess: (_, { meetingId }) => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.detail(meetingId) });
      queryClient.invalidateQueries({ queryKey: meetingKeys.all });
    },
  });
};