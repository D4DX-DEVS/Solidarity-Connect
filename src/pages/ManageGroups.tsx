import { useState } from "react";
import { ArrowLeft, Plus, Users, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import GroupDialog from "@/components/GroupDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

const ManageGroups = () => {
  const navigate = useNavigate();
  const [selectedDistrict, setSelectedDistrict] = useState("Thrissur");
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<any>(null);

  const groups = [
    { id: 1, name: "Varantharappalli", members: 17, district: "Thrissur" },
    { id: 2, name: "Perumpilavu", members: 24, district: "Thrissur" },
    { id: 3, name: "Ollur", members: 19, district: "Thrissur" },
    { id: 4, name: "Chavakkad", members: 31, district: "Thrissur" },
  ];

  const filteredGroups = groups.filter(g => g.district === selectedDistrict);

  const handleAdd = () => {
    setDialogMode("add");
    setSelectedGroup(null);
    setShowDialog(true);
  };

  const handleEdit = (group: any) => {
    setDialogMode("edit");
    setSelectedGroup(group);
    setShowDialog(true);
  };

  const handleDeleteClick = (group: any) => {
    setGroupToDelete(group);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    toast({
      title: "Group Deleted",
      description: `${groupToDelete?.name} has been deleted successfully.`,
    });
    setShowDeleteDialog(false);
    setGroupToDelete(null);
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
          <select
            className="w-full px-3 py-2 border rounded-md bg-background"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
          >
            <option value="Thrissur">Thrissur</option>
            <option value="Malappuram">Malappuram</option>
            <option value="Kozhikode">Kozhikode</option>
            <option value="Kannur">Kannur</option>
          </select>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add New Group
        </Button>

        <div className="space-y-3">
          {filteredGroups.map((group) => (
            <Card key={group.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{group.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {group.members} Members
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEdit(group)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeleteClick(group)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <GroupDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          group={selectedGroup}
          mode={dialogMode}
          selectedDistrict={selectedDistrict}
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
