import { ArrowLeft, Plus, Building2, Users, Edit, Trash2, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
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
  const totalGroups = districts.reduce((sum, district) => sum + (district.statistics?.totalGroups || 0), 0);
  const totalMembers = districts.reduce((sum, district) => sum + (district.statistics?.totalMembers || 0), 0);

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
    <PageShell>
      <PageHero
        title="Manage Districts"
        subtitle="Create, update, and retire district records without leaving the admin workspace."
        eyebrow="Organization"
        icon={<Building2 className="h-6 w-6" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/state-admin")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to State Admin
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard title="Active Districts" value={String(districts.length)} icon={Building2} tone="primary" />
        <MetricCard title="Mapped Groups" value={String(totalGroups)} icon={Users} tone="warning" />
        <MetricCard title="Mapped Members" value={String(totalMembers)} icon={Users} tone="success" />
      </div>

      <SectionCard
        title="District Controls"
        description="Search district records or add a new district without leaving this page."
        action={
          <Button className="bg-primary hover:bg-primary/90" onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add New District
          </Button>
        }
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search districts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </SectionCard>

      <SectionCard title="District Directory" description="Review district coverage, totals, and management actions.">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading districts...
          </div>
        ) : error ? (
          <div className="rounded-[1.6rem] border border-destructive/20 bg-destructive/5 p-8 text-center">
            <p className="font-medium text-destructive">Failed to load districts</p>
            <Button variant="outline" onClick={() => window.location.reload()} className="mt-3">
              Retry
            </Button>
          </div>
        ) : districts.length === 0 ? (
          <div className="rounded-[1.6rem] border border-border/60 bg-background/70 p-8 text-center">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-foreground">No districts found</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first district to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {districts.map((district) => (
              <Card key={district._id} className="surface-card border-border/70">
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="action-tile-icon">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{district.name}</h3>
                          <p className="text-sm text-muted-foreground">Code: {district.code}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <div className="data-strip inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            {district.statistics?.totalGroups || 0} Groups
                          </div>
                          <div className="data-strip inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            {district.statistics?.totalMembers || 0} Members
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[260px]">
                      <Button size="sm" variant="outline" className="w-full" onClick={() => handleEdit(district)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-destructive"
                        onClick={() => handleDeleteClick(district)}
                        disabled={deleteDistrictMutation.isPending}
                      >
                        {deleteDistrictMutation.isPending ? (
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
    </PageShell>
  );
};

export default ManageDistricts;
