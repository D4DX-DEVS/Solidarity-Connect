import { useState } from "react";
import { Building2, MapPin, Users, Plus, Edit, Trash2, Search, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import DataPagination from "@/components/app/DataPagination";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import { useSearchParams } from "react-router-dom";
import DistrictDialog from "@/components/DistrictDialog";
import GroupDialog from "@/components/GroupDialog";
import { useDistricts, useConfirmDeleteDistrict } from "@/hooks/useDistricts";
import { useGroups, useConfirmDeleteGroup } from "@/hooks/useGroups";
import { usePendingDeletes } from "@/lib/undoDelete";
import { useDebouncedParam, useListParams } from "@/hooks/useListParams";
import { District } from "@/lib/districts";
import { Group } from "@/lib/groups";

const MasterData = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "areas" ? "areas" : "districts";
  const handleTabChange = (tab: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === "areas") next.set("tab", "areas");
        else next.delete("tab");
        return next;
      },
      { replace: true },
    );
  };

  // District state — page, size and search live in the URL (districts_*)
  const districtList = useListParams("districts");
  const [districtSearch, setDistrictSearch] = useDebouncedParam(districtList, "q");
  const districtQuery = districtList.getParam("q").trim();
  const [showDistrictDialog, setShowDistrictDialog] = useState(false);
  const [districtDialogMode, setDistrictDialogMode] = useState<"add" | "edit">("add");
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);

  // Area (Group) state — page, size, search and district filter live in the URL (areas_*)
  const areaList = useListParams("areas");
  const [areaSearch, setAreaSearch] = useDebouncedParam(areaList, "q");
  const areaQuery = areaList.getParam("q").trim();
  const selectedDistrictFilter = areaList.getParam("district");
  const [districtFilterOpen, setDistrictFilterOpen] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupDialogMode, setGroupDialogMode] = useState<"add" | "edit">("add");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Fetch one page of districts
  const {
    data: districtsResponse,
    isLoading: districtsLoading,
    isError: districtsError,
    isPlaceholderData: districtsStale,
    refetch: refetchDistricts,
  } = useDistricts(
    {
      sort: 'name',
      isActive: true,
      page: districtList.page,
      limit: districtList.pageSize,
      ...(districtQuery ? { search: districtQuery } : {})
    },
    { keepPrevious: "page" }
  );
  const confirmDeleteDistrict = useConfirmDeleteDistrict();
  const pendingDeletes = usePendingDeletes();
  const districts = (districtsResponse?.data || []).filter((district) => !pendingDeletes.has(district._id));
  const districtTotal = districtsResponse?.pagination?.totalDocs ?? districts.length;

  // Every district, unfiltered — feeds the metric cards and the district pickers
  const { data: allDistrictsResponse } = useDistricts({ sort: 'name', isActive: true, limit: 100 });
  const allDistricts = allDistrictsResponse?.data || [];

  // Fetch one page of groups/areas
  const {
    data: groupsResponse,
    isLoading: groupsLoading,
    isError: groupsError,
    isPlaceholderData: groupsStale,
    refetch: refetchGroups,
  } = useGroups(
    {
      sort: 'name',
      isActive: true,
      page: areaList.page,
      limit: areaList.pageSize,
      ...(selectedDistrictFilter ? { district: selectedDistrictFilter } : {}),
      ...(areaQuery ? { search: areaQuery } : {})
    },
    { keepPrevious: "page" }
  );
  const confirmDeleteGroup = useConfirmDeleteGroup();
  const groups = (groupsResponse?.data || []).filter((group) => !pendingDeletes.has(group._id));
  const groupTotal = groupsResponse?.pagination?.totalDocs ?? groups.length;

  const totalDistricts = allDistrictsResponse?.pagination?.totalDocs ?? allDistricts.length;
  const totalGroups = allDistricts.reduce((sum, d) => sum + (d.statistics?.totalGroups || 0), 0);
  const totalMembers = allDistricts.reduce((sum, d) => sum + (d.statistics?.totalMembers || 0), 0);

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

  const clearAreaFilters = () => {
    setAreaSearch("");
    areaList.setParams({ q: "", district: "" });
  };

  return (
    <PageShell>
      <PageHero
        title="Master Data"
        subtitle="Manage districts and areas — the organizational backbone of the system."
        eyebrow="State Admin"
        icon={<Building2 className="h-6 w-6" />}
      />

      <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
        <MetricCard title="Districts" value={String(totalDistricts)} icon={Building2} tone="primary" />
        <MetricCard title="Areas" value={String(totalGroups)} icon={MapPin} tone="warning" />
        <MetricCard title="Total Members" value={String(totalMembers)} icon={Users} tone="success" />
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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
                aria-label="Search districts"
                value={districtSearch}
                onChange={(e) => setDistrictSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </SectionCard>

          {districtsLoading ? (
            <ListSkeleton rows={6} />
          ) : districtsError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
              <p className="font-medium text-destructive">Failed to load districts</p>
              <Button variant="outline" onClick={() => refetchDistricts()} className="mt-3">
                Retry
              </Button>
            </div>
          ) : districtTotal === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="font-medium text-foreground">No districts found</p>
              {districtQuery ? (
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => { setDistrictSearch(""); districtList.setParam("q", ""); }}
                >
                  Clear search
                </Button>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Add your first district to get started.</p>
              )}
            </div>
          ) : (
            <>
              <div className={`space-y-3 transition-opacity ${districtsStale ? "opacity-60" : ""}`}>
                {districts.map((district) => (
                  <Card key={district._id} className="surface-card border-border/70">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="action-tile-icon shrink-0">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold text-foreground">{district.name}</h3>
                            <p className="truncate text-xs text-muted-foreground">
                              Code: {district.code} · {district.statistics?.totalGroups || 0} Areas · {district.statistics?.totalMembers || 0} Members
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1 sm:gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEditDistrict(district)} aria-label={`Edit ${district.name}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => confirmDeleteDistrict(district)}
                            aria-label={`Delete ${district.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <DataPagination
                page={districtList.page}
                pageSize={districtList.pageSize}
                totalPages={districtsResponse?.pagination?.totalPages ?? 1}
                totalDocs={districtTotal}
                onPageChange={districtList.setPage}
                onPageSizeChange={districtList.setPageSize}
                itemLabel="districts"
                disabled={districtsStale}
              />
            </>
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
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Popover open={districtFilterOpen} onOpenChange={setDistrictFilterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={districtFilterOpen}
                    aria-label="Filter by district"
                    className="w-full min-w-0 justify-between rounded-2xl border-border/70 bg-card h-11 px-2.5 font-normal shadow-sm sm:px-4"
                  >
                    <span className="truncate">
                      {selectedDistrictFilter
                        ? allDistricts.find(d => d._id === selectedDistrictFilter)?.name || "All Districts"
                        : "All Districts"}
                    </span>
                    <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50 sm:ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search district..." />
                    <CommandList>
                      <CommandEmpty>No district found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            areaList.setParam("district", "");
                            setDistrictFilterOpen(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${!selectedDistrictFilter ? "opacity-100" : "opacity-0"}`} />
                          All Districts
                        </CommandItem>
                        {allDistricts.map((d) => (
                          <CommandItem
                            key={d._id}
                            value={d.name}
                            onSelect={() => {
                              areaList.setParam("district", d._id);
                              setDistrictFilterOpen(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${selectedDistrictFilter === d._id ? "opacity-100" : "opacity-0"}`} />
                            {d.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search areas..."
                  aria-label="Search areas"
                  value={areaSearch}
                  onChange={(e) => setAreaSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </SectionCard>

          {groupsLoading ? (
            <ListSkeleton rows={6} />
          ) : groupsError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
              <p className="font-medium text-destructive">Failed to load areas</p>
              <Button variant="outline" onClick={() => refetchGroups()} className="mt-3">
                Retry
              </Button>
            </div>
          ) : groupTotal === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
              <MapPin className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="font-medium text-foreground">No areas found</p>
              {areaQuery || selectedDistrictFilter ? (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">No areas match the current filters.</p>
                  <Button variant="outline" className="mt-3" onClick={clearAreaFilters}>
                    Clear filters
                  </Button>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Add your first area to get started.</p>
              )}
            </div>
          ) : (
            <>
              <div className={`space-y-3 transition-opacity ${groupsStale ? "opacity-60" : ""}`}>
                {groups.map((group) => (
                  <Card key={group._id} className="surface-card border-border/70">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="action-tile-icon shrink-0">
                            <MapPin className="h-5 w-5 text-orange-500" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold text-foreground">{group.name}</h3>
                            <p className="truncate text-xs text-muted-foreground">
                              {group.district?.name || "—"} · Code: {group.code} · {group.statistics?.totalMembers || 0} Members
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1 sm:gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEditGroup(group)} aria-label={`Edit ${group.name}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => confirmDeleteGroup(group)}
                            aria-label={`Delete ${group.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <DataPagination
                page={areaList.page}
                pageSize={areaList.pageSize}
                totalPages={groupsResponse?.pagination?.totalPages ?? 1}
                totalDocs={groupTotal}
                onPageChange={areaList.setPage}
                onPageSizeChange={areaList.setPageSize}
                itemLabel="areas"
                disabled={groupsStale}
              />
            </>
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
    </PageShell>
  );
};

export default MasterData;
