import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Users, Edit, Trash2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import GroupDialog from "@/components/GroupDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { useGroups, useDeleteGroup } from "@/hooks/useGroups";
import { useDistricts } from "@/hooks/useDistricts";
import { Group } from "@/lib/groups";

const formSelectClassName = "w-full rounded-[1rem] border border-border/70 bg-background px-4 py-3 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

const ManageGroups = () => {
  const navigate = useNavigate();
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
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/state-admin")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to State Admin
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard title="Selected District" value={selectedDistrict?.code || "None"} icon={Users} tone="primary" />
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="space-y-2">
            <label htmlFor="selected-district" className="text-sm font-medium text-foreground">Select District</label>
            {districtsLoading ? (
              <div className="flex items-center gap-2 rounded-[1rem] border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading districts...
              </div>
            ) : (
              <select
                id="selected-district"
                className={formSelectClassName}
                value={selectedDistrictId}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                disabled={districts.length === 0}
              >
                {districts.length === 0 ? (
                  <option value="">No districts available</option>
                ) : (
                  districts.map((district) => (
                    <option key={district._id} value={district._id}>
                      {district.name}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="group-search" className="text-sm font-medium text-foreground">Search Groups</label>
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
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading groups...
          </div>
        ) : error ? (
          <div className="rounded-[1.6rem] border border-destructive/20 bg-destructive/5 p-8 text-center">
            <p className="font-medium text-destructive">Failed to load groups</p>
            <Button variant="outline" onClick={() => window.location.reload()} className="mt-3">
              Retry
            </Button>
          </div>
        ) : !selectedDistrictId ? (
          <div className="rounded-[1.6rem] border border-border/60 bg-background/70 p-8 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-foreground">Select a district to view groups</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-[1.6rem] border border-border/60 bg-background/70 p-8 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-foreground">No groups found in this district</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first group to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Card key={group._id} className="surface-card border-border/70">
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="action-tile-icon">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{group.name}</h3>
                          <p className="text-sm text-muted-foreground">Code: {group.code}</p>
                        </div>
                        <div className="data-strip inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          {group.statistics?.totalMembers || 0} Members
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[260px]">
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
