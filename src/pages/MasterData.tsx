import { useState } from "react";
import { ArrowLeft, Building2, MapPin, Users, Plus, Edit, Trash2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import DistrictDialog from "@/components/DistrictDialog";
import GroupDialog from "@/components/GroupDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { useDistricts, useDeleteDistrict } from "@/hooks/useDistricts";
import { useGroups, useDeleteGroup } from "@/hooks/useGroups";
import { District } from "@/lib/districts";
import { Group } from "@/lib/groups";

const formSelectClassName = "w-full rounded-[1rem] border border-border/70 bg-background px-4 py-3 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

const MasterData = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("districts");

  // District state
  const [districtSearch, setDistrictSearch] = useState("");
  const [showDistrictDialog, setShowDistrictDialog] = useState(false);
  const [districtDialogMode, setDistrictDialogMode] = useState<"add" | "edit">("add");
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [showDistrictDeleteDialog, setShowDistrictDeleteDialog] = useState(false);
  const [districtToDelete, setDistrictToDelete] = useState<District | null>(null);

  // Area (Group) state
  const [areaSearch, setAreaSearch] = useState("");
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>("");
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupDialogMode, setGroupDialogMode] = useState<"add" | "edit">("add");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showGroupDeleteDialog, setShowGroupDeleteDialog] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);

  // Fetch districts
  const { data: districtsResponse, isLoading: districtsLoading } = useDistricts({
    sort: 'name',
    isActive: true,
    limit: 100,
    ...(districtSearch.trim() ? { search: districtSearch.trim() } : {})
  });
  const deleteDistrictMutation = useDeleteDistrict();
  const districts = districtsResponse?.data || [];

  // Fetch all districts for filter dropdown (without search filter)
  const { data: allDistrictsResponse } = useDistricts({ sort: 'name', isActive: true, limit: 100 });
  const allDistricts = allDistrictsResponse?.data || [];

  // Fetch groups/areas
  const { data: groupsResponse, isLoading: groupsLoading } = useGroups({
    sort: 'name',
    isActive: true,
    limit: 100,
    ...(selectedDistrictFilter ? { district: selectedDistrictFilter } : {}),
    ...(areaSearch.trim() ? { search: areaSearch.trim() } : {})
  });
  const deleteGroupMutation = useDeleteGroup();
  const groups = groupsResponse?.data || [];

  const totalGroups = districts.reduce((sum, d) => sum + (d.statistics?.totalGroups || 0), 0);
  const totalMembers = districts.reduce((sum, d) => sum + (d.statistics?.totalMembers || 0), 0);

  // District handlers
  const handleAddDistrict = () => {
    setDistrictDialogMode("add");
    setSelectedDistrict(null);
    setShowDistrictDialog(true);
  };

  const handleEditDistrict = (district: District) => {
    setDistrictDialogMode("edit");
    setSelectedDistrict(district);
    setShowDistrictDialog(true);
  };

  const handleDeleteDistrictClick = (district: District) => {
    setDistrictToDelete(district);
    setShowDistrictDeleteDialog(true);
  };

  const handleDeleteDistrictConfirm = async () => {
    if (!districtToDelete) return;
    try {
      await deleteDistrictMutation.mutateAsync(districtToDelete._id);
      toast({ title: "District Deleted", description: `${districtToDelete.name} has been deleted successfully.` });
      setShowDistrictDeleteDialog(false);
      setDistrictToDelete(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete district", variant: "destructive" });
    }
  };

  // Area/Group handlers
  const handleAddGroup = () => {
    setGroupDialogMode("add");
    setSelectedGroup(null);
    setShowGroupDialog(true);
  };

  const handleEditGroup = (group: Group) => {
    setGroupDialogMode("edit");
    setSelectedGroup(group);
    setShowGroupDialog(true);
  };

  const handleDeleteGroupClick = (group: Group) => {
    setGroupToDelete(group);
    setShowGroupDeleteDialog(true);
  };

  const handleDeleteGroupConfirm = async () => {
    if (!groupToDelete) return;
    try {
      await deleteGroupMutation.mutateAsync(groupToDelete._id);
      toast({ title: "Area Deleted", description: `${groupToDelete.name} has been deleted successfully.` });
      setShowGroupDeleteDialog(false);
      setGroupToDelete(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete area", variant: "destructive" });
    }
  };

  return (
    <PageShell>
      <PageHero
        title="Master Data"
        subtitle="Manage districts and areas — the organizational backbone of the system."
        eyebrow="State Admin"
        icon={<Building2 className="h-6 w-6" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/state-admin")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard title="Districts" value={String(districts.length)} icon={Building2} tone="primary" />
        <MetricCard title="Areas" value={String(totalGroups)} icon={MapPin} tone="warning" />
        <MetricCard title="Total Members" value={String(totalMembers)} icon={Users} tone="success" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="districts" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Districts
          </TabsTrigger>
          <TabsTrigger value="areas" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Areas
          </TabsTrigger>
        </TabsList>

        {/* Districts Tab */}
        <TabsContent value="districts" className="space-y-4 mt-4">
          <SectionCard
            title="District Management"
            description="Create, edit, or delete districts."
            action={
              <Button className="bg-primary hover:bg-primary/90" onClick={handleAddDistrict}>
                <Plus className="mr-2 h-4 w-4" />
                Add District
              </Button>
            }
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search districts..."
                value={districtSearch}
                onChange={(e) => setDistrictSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </SectionCard>

          {districtsLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading districts...
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
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="action-tile-icon">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{district.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            Code: {district.code} · {district.statistics?.totalGroups || 0} Areas · {district.statistics?.totalMembers || 0} Members
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => handleEditDistrict(district)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDeleteDistrictClick(district)}
                          disabled={deleteDistrictMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Areas Tab */}
        <TabsContent value="areas" className="space-y-4 mt-4">
          <SectionCard
            title="Area Management"
            description="Manage areas under each district."
            action={
              <Button className="bg-primary hover:bg-primary/90" onClick={handleAddGroup}>
                <Plus className="mr-2 h-4 w-4" />
                Add Area
              </Button>
            }
          >
            <div className="space-y-3">
              <select
                value={selectedDistrictFilter}
                onChange={(e) => setSelectedDistrictFilter(e.target.value)}
                className={formSelectClassName}
              >
                <option value="">All Districts</option>
                {allDistricts.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search areas..."
                  value={areaSearch}
                  onChange={(e) => setAreaSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </SectionCard>

          {groupsLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading areas...
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-[1.6rem] border border-border/60 bg-background/70 p-8 text-center">
              <MapPin className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="font-medium text-foreground">No areas found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedDistrictFilter ? "No areas in this district." : "Add your first area to get started."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <Card key={group._id} className="surface-card border-border/70">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="action-tile-icon">
                          <MapPin className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{group.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {group.district?.name || "—"} · Code: {group.code} · {group.statistics?.totalMembers || 0} Members
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => handleEditGroup(group)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDeleteGroupClick(group)}
                          disabled={deleteGroupMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <DistrictDialog
        open={showDistrictDialog}
        onOpenChange={setShowDistrictDialog}
        district={selectedDistrict}
        mode={districtDialogMode}
      />

      <GroupDialog
        open={showGroupDialog}
        onOpenChange={setShowGroupDialog}
        group={selectedGroup}
        mode={groupDialogMode}
        selectedDistrictId={selectedDistrictFilter || undefined}
        districts={allDistricts}
      />

      <DeleteConfirmDialog
        open={showDistrictDeleteDialog}
        onOpenChange={setShowDistrictDeleteDialog}
        onConfirm={handleDeleteDistrictConfirm}
        title="Delete District"
        description={`Are you sure you want to delete "${districtToDelete?.name}"? This will also delete all areas and members under this district.`}
      />

      <DeleteConfirmDialog
        open={showGroupDeleteDialog}
        onOpenChange={setShowGroupDeleteDialog}
        onConfirm={handleDeleteGroupConfirm}
        title="Delete Area"
        description={`Are you sure you want to delete "${groupToDelete?.name}"? This will also affect all members in this area.`}
      />
    </PageShell>
  );
};

export default MasterData;
