import { ArrowLeft, Plus, Building2, Users, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import DistrictDialog from "@/components/DistrictDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

const ManageDistricts = () => {
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [selectedDistrict, setSelectedDistrict] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [districtToDelete, setDistrictToDelete] = useState<any>(null);

  const districts = [
    { id: 1, name: "Thrissur", groups: 8, members: 142 },
    { id: 2, name: "Malappuram", groups: 12, members: 235 },
    { id: 3, name: "Kozhikode", groups: 10, members: 198 },
    { id: 4, name: "Kannur", groups: 6, members: 95 },
  ];

  const handleAdd = () => {
    setDialogMode("add");
    setSelectedDistrict(null);
    setShowDialog(true);
  };

  const handleEdit = (district: any) => {
    setDialogMode("edit");
    setSelectedDistrict(district);
    setShowDialog(true);
  };

  const handleDeleteClick = (district: any) => {
    setDistrictToDelete(district);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    toast({
      title: "District Deleted",
      description: `${districtToDelete?.name} has been deleted successfully.`,
    });
    setShowDeleteDialog(false);
    setDistrictToDelete(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Manage Districts</h1>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add New District
        </Button>

        <div className="space-y-3">
          {districts.map((district) => (
            <Card key={district.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{district.name}</h3>
                      <div className="flex gap-4 mt-1">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{district.groups} Groups</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{district.members} Members</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEdit(district)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeleteClick(district)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DistrictDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          district={selectedDistrict}
          mode={dialogMode}
        />

        <DeleteConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleDeleteConfirm}
          title="Delete District"
          description={`Are you sure you want to delete ${districtToDelete?.name}? This will also delete all groups and members under this district. This action cannot be undone.`}
        />
      </main>
    </div>
  );
};

export default ManageDistricts;
