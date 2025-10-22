import { useState } from "react";
import { ArrowLeft, Plus, Users, Edit, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import GroupDialog from "@/components/GroupDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { useGroups, useDeleteGroup } from "@/hooks/useGroups";
import { useDistricts } from "@/hooks/useDistricts";
import { Group } from "@/lib/groups";

const ManageGroups = () => {
  const navigate = useNavigate();
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("");
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

  // Set default district if not selected and districts are loaded
  if (!selectedDistrictId && districts.length > 0) {
    setSelectedDistrictId(districts[0]._id);
  }

  // Fetch groups for selected district
  const { data: groupsResponse, isLoading: groupsLoading, error } = useGroups({ 
    district: selectedDistrictId,
    sort: 'name',
    isActive: true 
  });
  const deleteGroupMutation = useDeleteGroup();

  const groups = groupsResponse?.data || [];

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
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/state-admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Manage Groups</h1>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Select District</label>
          {districtsLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading districts...</span>
            </div>
          ) : (
            <select
              className="w-full px-3 py-2 border rounded-md bg-background"
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
      </header>

      <main className="p-4 space-y-4">
        <Button 
          className="w-full bg-primary hover:bg-primary/90" 
          onClick={handleAdd}
          disabled={!selectedDistrictId}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New Group
        </Button>

        {groupsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading groups...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive">Failed to load groups</p>
            <Button variant="outline" onClick={() => window.location.reload()} className="mt-2">
              Retry
            </Button>
          </div>
        ) : !selectedDistrictId ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a district to view groups</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No groups found in this district</p>
            <p className="text-sm text-muted-foreground">Add your first group to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Card key={group._id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{group.name}</h3>
                        <p className="text-sm text-muted-foreground mb-1">Code: {group.code}</p>
                        <p className="text-sm text-muted-foreground">
                          {group.statistics?.totalMembers || 0} Members
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEdit(group)}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-destructive" 
                      onClick={() => handleDeleteClick(group)}
                      disabled={deleteGroupMutation.isPending}
                    >
                      {deleteGroupMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-1" />
                      )}
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

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
      </main>
    </div>
  );
};

export default ManageGroups;
