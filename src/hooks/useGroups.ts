import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPlaceholder, type KeepPrevious } from '@/lib/listPlaceholder';
import { groupsApi, Group, CreateGroupData, GroupFilters } from '@/lib/groups';
import { confirmAction } from '@/lib/confirm';
import { undoableDelete } from '@/lib/undoDelete';

// Query keys
const groupKeys = {
  all: ['groups'] as const,
  lists: () => [...groupKeys.all, 'list'] as const,
  list: (filters: GroupFilters) => [...groupKeys.lists(), filters] as const,
  details: () => [...groupKeys.all, 'detail'] as const,
  detail: (id: string) => [...groupKeys.details(), id] as const,
  stats: (id: string) => [...groupKeys.detail(id), 'stats'] as const,
  members: (id: string) => [...groupKeys.detail(id), 'members'] as const,
};

// Get groups list. `keepPrevious` holds the current rows on screen while the next page loads.
export const useGroups = (params?: GroupFilters, options?: { keepPrevious?: KeepPrevious }) => {
  return useQuery({
    queryKey: groupKeys.list(params || {}),
    queryFn: () => groupsApi.getGroups(params),
    placeholderData: listPlaceholder(options?.keepPrevious, params),
  });
};

// Get single group
export const useGroup = (id: string) => {
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: () => groupsApi.getGroup(id),
    enabled: !!id,
  });
};

// Create group mutation
export const useCreateGroup = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateGroupData) => groupsApi.createGroup(data),
    onSuccess: () => {
      // Invalidate and refetch groups
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
      // Also invalidate districts as group creation affects district stats
      queryClient.invalidateQueries({ queryKey: ['districts'] });
    },
  });
};

// Update group mutation
export const useUpdateGroup = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateGroupData> }) => 
      groupsApi.updateGroup(id, data),
    onSuccess: (_, { id }) => {
      // Invalidate specific group and all groups
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
      // Also invalidate districts as group updates may affect district stats
      queryClient.invalidateQueries({ queryKey: ['districts'] });
    },
  });
};

// Delete group mutation
export const useDeleteGroup = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => groupsApi.deleteGroup(id),
    onSuccess: () => {
      // Invalidate and refetch groups
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
      // Also invalidate districts as group deletion affects district stats
      queryClient.invalidateQueries({ queryKey: ['districts'] });
    },
  });
};

// Ask, then delete with a 10 second Undo. Lists hide the row via usePendingDeletes().
// A Group record is an "area" in the UI.
export const useConfirmDeleteGroup = () => {
  const queryClient = useQueryClient();

  return async (group: Group): Promise<void> => {
    const confirmed = await confirmAction({
      title: 'Delete this area?',
      description: 'Only an area with no members can be deleted.',
      itemName: group.name,
      confirmLabel: 'Delete area',
      undoable: true,
    });
    if (!confirmed) return;
    undoableDelete({
      id: group._id,
      title: 'Area deleted',
      description: group.name,
      commit: () => groupsApi.deleteGroup(group._id),
      // Area counts live on the districts too
      onCommitted: () => Promise.all([
        queryClient.invalidateQueries({ queryKey: groupKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['districts'] }),
      ]),
    });
  };
};

// Get group statistics
export const useGroupStats = (id: string) => {
  return useQuery({
    queryKey: groupKeys.stats(id),
    queryFn: () => groupsApi.getGroupStats(id),
    enabled: !!id,
  });
};

// Get group members
export const useGroupMembers = (id: string, params?: { 
  page?: number; 
  limit?: number; 
  sort?: string; 
  status?: string;
  isApproved?: boolean;
  search?: string;
}) => {
  return useQuery({
    queryKey: groupKeys.members(id),
    queryFn: () => groupsApi.getGroupMembers(id, params),
    enabled: !!id,
  });
};