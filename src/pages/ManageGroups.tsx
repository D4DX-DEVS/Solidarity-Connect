import { useEffect, useState } from "react";
import { Plus, Users, Edit, Trash2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import { toast } from "@/hooks/use-toast";
import GroupDialog from "@/components/GroupDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { useGroups, useDeleteGroup } from "@/hooks/useGroups";
import { useDistricts } from "@/hooks/useDistricts";
import { Group } from "@/lib/groups";

const ManageGroups = () => {
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);

  // Fetch districts for the dropdown
  const { data: districtsResponse, isLoading: districtsLoading } = useDistricts({ 
    sort: 'name',
    isActive: true 
  });
  const districts = districtsResponse?.data || [];
  const selectedDistrict = districts.find((district) => district._id === selectedDistrictId) || null;

  // Set default district if not selected and districts are loaded
  useEffect(() => {
    if (!selectedDistrictId && districts.length > 0) {
      setSelectedDistrictId(districts[0]._id);
    }
  }, [districts, selectedDistrictId]);

  // Fetch groups for selected district
  const { data: groupsResponse, isLoading: groupsLoading, error } = useGroups({ 
    district: selectedDistrictId,
    sort: 'name',
    isActive: true,
    ...(searchQuery.trim() ? { search: searchQuery.trim() } : {})
  });
  const deleteGroupMutation = useDeleteGroup();

  const groups = groupsResponse?.data || [];
  const totalMembers = groups.reduce((sum, group) => sum + (group.statistics?.totalMembers || 0), 0);

  const handleAdd = () => {
    setDialogMode("add");
    setSelectedGroup(null);
    setShowDialog(true);
  };

  const handleEdit = (group: Group) => {
    setDialogMode("edit");
    setSelectedGroup(group);
    setShowDialog(true);
  };

  const handleDeleteClick = (group: Group) => {
    setGroupToDelete(group);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!groupToDelete) return;

    try {
      await deleteGroupMutation.mutateAsync(groupToDelete._id);
      toast({
        title: "Group Deleted",
        description: `${groupToDelete.name} has been deleted successfully.`,
      });
      setShowDeleteDialog(false);
      setGroupToDelete(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete group",
        variant: "destructive",
      });
    }
  };

  return (
    <PageShell>
      <PageHero
        title="Manage Groups"
        subtitle="Switch districts, review active groups, and manage area-level structure from one place."
        eyebrow="Organization"
        icon={<Users className="h-6 w-6" />}
      />

      <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
        <MetricCard title="Selected District" value={selectedDistrict?.name || "None"} icon={Users} tone="primary" />
        <MetricCard title="Active Groups" value={String(groups.length)} icon={Users} tone="warning" />
        <MetricCard title="Mapped Members" value={String(totalMembers)} icon={Users} tone="success" />
      </div>

      <SectionCard
        title="Group Controls"
        description="Choose a district, search within its groups, and open group management dialogs."
        action={
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={handleAdd}
            disabled={!selectedDistrictId}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Group
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="space-y-1.5 sm:space-y-2">
            <label htmlFor="selected-district" className="text-xs font-medium text-foreground sm:text-sm">Select District</label>
            {districtsLoading ? (
              <Skeleton className="h-12 w-full rounded-xl" />
            ) : (
              <Select
                value={selectedDistrictId}
                onValueChange={(val) => setSelectedDistrictId(val)}
                disabled={districts.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={districts.length === 0 ? "No districts available" : "Select district"} />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((district) => (
                    <SelectItem key={district._id} value={district._id}>
                      {district.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <label htmlFor="group-search" className="text-xs font-medium text-foreground sm:text-sm">Search Groups</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="group-search"
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Group Directory" description="Review groups for the selected district and manage their details.">
        {groupsLoading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
            <p className="font-medium text-destructive">Failed to load groups</p>
            <Button variant="outline" onClick={() => window.location.reload()} className="mt-3">
              Retry
            </Button>
          </div>
        ) : !selectedDistrictId ? (
          <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-foreground">Select a district to view groups</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-foreground">No groups found in this district</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first group to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Card key={group._id} className="surface-card border-border/70">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="action-tile-icon shrink-0">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h3 className="truncate text-sm font-semibold text-foreground sm:text-base">{group.name}</h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs text-muted-foreground">Code: {group.code}</p>
                          <div className="data-strip inline-flex items-center gap-1.5 px-2 py-0.5 text-xs text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {group.statistics?.totalMembers || 0} Members
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 lg:min-w-[220px]">
                      <Button size="sm" variant="outline" className="w-full" onClick={() => handleEdit(group)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-destructive"
                        onClick={() => handleDeleteClick(group)}
                        disabled={deleteGroupMutation.isPending}
                      >
                        {deleteGroupMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>

        <GroupDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          group={selectedGroup}
          mode={dialogMode}
          selectedDistrictId={selectedDistrictId}
          districts={districts}
        />

        <DeleteConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleDeleteConfirm}
          title="Delete Group"
          description={`Are you sure you want to delete ${groupToDelete?.name}? This will also delete all members in this group. This action cannot be undone.`}
        />
    </PageShell>
  );
};

export default ManageGroups;
