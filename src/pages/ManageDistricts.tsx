import { ArrowLeft, Plus, Building2, Users, Edit, Trash2, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import DistrictDialog from "@/components/DistrictDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { useDistricts, useDeleteDistrict } from "@/hooks/useDistricts";
import { District } from "@/lib/districts";

const ManageDistricts = () => {
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [districtToDelete, setDistrictToDelete] = useState<District | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch districts from API
  const { data: districtsResponse, isLoading, error } = useDistricts({ 
    sort: 'name',
    isActive: true,
    ...(searchQuery.trim() ? { search: searchQuery.trim() } : {})
  });
  const deleteDistrictMutation = useDeleteDistrict();

  const districts = districtsResponse?.data || [];

  const handleAdd = () => {
    setDialogMode("add");
    setSelectedDistrict(null);
    setShowDialog(true);
  };

  const handleEdit = (district: District) => {
    setDialogMode("edit");
    setSelectedDistrict(district);
    setShowDialog(true);
  };

  const handleDeleteClick = (district: District) => {
    setDistrictToDelete(district);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!districtToDelete) return;

    try {
      await deleteDistrictMutation.mutateAsync(districtToDelete._id);
      toast({
        title: "District Deleted",
        description: `${districtToDelete.name} has been deleted successfully.`,
      });
      setShowDeleteDialog(false);
      setDistrictToDelete(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete district",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/state-admin")}>
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search districts…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading districts...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive">Failed to load districts</p>
            <Button variant="outline" onClick={() => window.location.reload()} className="mt-2">
              Retry
            </Button>
          </div>
        ) : districts.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No districts found</p>
            <p className="text-sm text-muted-foreground">Add your first district to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {districts.map((district) => (
              <Card key={district._id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{district.name}</h3>
                        <p className="text-sm text-muted-foreground mb-1">Code: {district.code}</p>
                        <div className="flex gap-4 mt-1">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>{district.statistics?.totalGroups || 0} Groups</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>{district.statistics?.totalMembers || 0} Members</span>
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
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-destructive" 
                      onClick={() => handleDeleteClick(district)}
                      disabled={deleteDistrictMutation.isPending}
                    >
                      {deleteDistrictMutation.isPending ? (
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
