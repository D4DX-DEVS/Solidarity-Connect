import { useState } from "react";
import { MapPin, Plus, Edit, Trash2, Search, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { SectionCard } from "@/components/app/AppShell";
import DataPagination from "@/components/app/DataPagination";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import GroupDialog from "@/components/GroupDialog";
import { useGroups, useConfirmDeleteGroup } from "@/hooks/useGroups";
import { usePendingDeletes } from "@/lib/undoDelete";
import { useDebouncedParam, useListParams } from "@/hooks/useListParams";
import { District } from "@/lib/districts";
import { Group } from "@/lib/groups";

interface AreasPanelProps {
  /** Districts offered in the district filter and the add/edit dialog */
  districts: District[];
  /**
   * District admin view: the API already limits the list to their own district,
   * so the district filter is hidden and the dialog stays on that district.
   */
  districtLocked?: boolean;
}

/** Master Data → Areas tab. Page, size, search and district filter live in the URL (areas_*). */
const AreasPanel = ({ districts, districtLocked = false }: AreasPanelProps) => {
  const areaList = useListParams("areas");
  const [areaSearch, setAreaSearch] = useDebouncedParam(areaList, "q");
  const areaQuery = areaList.getParam("q").trim();
  const selectedDistrictFilter = districtLocked ? "" : areaList.getParam("district");
  const [districtFilterOpen, setDistrictFilterOpen] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupDialogMode, setGroupDialogMode] = useState<"add" | "edit">("add");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Fetch one page of areas
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
  const pendingDeletes = usePendingDeletes();
  const groups = (groupsResponse?.data || []).filter((group) => !pendingDeletes.has(group._id));
  const groupTotal = groupsResponse?.pagination?.totalDocs ?? groups.length;

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

  const searchInput = (
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
  );

  return (
    <>
      <SectionCard
        title={districtLocked && districts[0] ? `${districts[0].name} Areas` : "Area Management"}
        description={districtLocked ? "Manage the areas in your district." : "Manage areas under each district."}
        action={
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={handleAddGroup}
            disabled={districts.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Area
          </Button>
        }
      >
        {districtLocked ? (
          searchInput
        ) : (
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
                      ? districts.find(d => d._id === selectedDistrictFilter)?.name || "All Districts"
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
                      {districts.map((d) => (
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
            {searchInput}
          </div>
        )}
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
                          {/* Every row shares the district when it's locked — no need to repeat it */}
                          {!districtLocked && `${group.district?.name || "—"} · `}
                          Code: {group.code} · {group.statistics?.totalMembers || 0} Members
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

      <GroupDialog
        open={showGroupDialog}
        onOpenChange={setShowGroupDialog}
        group={selectedGroup}
        mode={groupDialogMode}
        selectedDistrictId={(districtLocked ? districts[0]?._id : selectedDistrictFilter) || undefined}
        districts={districts}
        lockDistrict={districtLocked}
      />
    </>
  );
};

export default AreasPanel;
