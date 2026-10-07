import { Plus, Building2, Users, Edit, Trash2, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import DataPagination from "@/components/app/DataPagination";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import DistrictDialog from "@/components/DistrictDialog";
import { useDistricts, useConfirmDeleteDistrict } from "@/hooks/useDistricts";
import { usePendingDeletes } from "@/lib/undoDelete";
import { useDebouncedParam, useListParams } from "@/hooks/useListParams";
import { District } from "@/lib/districts";

const ManageDistricts = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  // Page, size and search live in the URL
  const list = useListParams();
  const [searchQuery, setSearchQuery] = useDebouncedParam(list, "q");
  const committedSearch = list.getParam("q").trim();

  // Fetch one page of districts
  const { data: districtsResponse, isLoading, error, isPlaceholderData, refetch } = useDistricts(
    {
      sort: 'name',
      isActive: true,
      page: list.page,
      limit: list.pageSize,
      ...(committedSearch ? { search: committedSearch } : {})
    },
    { keepPrevious: "page" }
  );
  const confirmDeleteDistrict = useConfirmDeleteDistrict();
  const pendingDeletes = usePendingDeletes();

  const districts = (districtsResponse?.data || []).filter((district) => !pendingDeletes.has(district._id));
  const districtTotal = districtsResponse?.pagination?.totalDocs ?? districts.length;

  // Metric cards cover every district, not just the visible page
  const { data: allDistrictsResponse } = useDistricts({ sort: 'name', isActive: true, limit: 100 });
  const allDistricts = allDistrictsResponse?.data || [];
  const totalDistricts = allDistrictsResponse?.pagination?.totalDocs ?? allDistricts.length;
  const totalGroups = allDistricts.reduce((sum, district) => sum + (district.statistics?.totalGroups || 0), 0);
  const totalMembers = allDistricts.reduce((sum, district) => sum + (district.statistics?.totalMembers || 0), 0);

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

  return (
    <PageShell>
      <PageHero
        title="Manage Districts"
        subtitle="Create, update, and retire district records without leaving the admin workspace."
        eyebrow="Organization"
        icon={<Building2 className="h-6 w-6" />}
      />

      <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
        <MetricCard title="Active Districts" value={String(totalDistricts)} icon={Building2} tone="primary" />
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
            aria-label="Search districts"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </SectionCard>

      <SectionCard title="District Directory" description="Review district coverage, totals, and management actions.">
        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
            <p className="font-medium text-destructive">Failed to load districts</p>
            <Button variant="outline" onClick={() => refetch()} className="mt-3">
              Retry
            </Button>
          </div>
        ) : districtTotal === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-foreground">No districts found</p>
            {committedSearch ? (
              <Button variant="outline" className="mt-3" onClick={() => { setSearchQuery(""); list.setParam("q", ""); }}>
                Clear search
              </Button>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Add your first district to get started.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`space-y-3 transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}>
              {districts.map((district) => (
                <Card key={district._id} className="surface-card border-border/70">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="action-tile-icon shrink-0">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <h3 className="truncate text-sm font-semibold text-foreground sm:text-base">{district.name}</h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs text-muted-foreground">Code: {district.code}</p>
                            <div className="data-strip inline-flex items-center gap-1.5 px-2 py-0.5 text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              {district.statistics?.totalGroups || 0} Groups
                            </div>
                            <div className="data-strip inline-flex items-center gap-1.5 px-2 py-0.5 text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              {district.statistics?.totalMembers || 0} Members
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 lg:min-w-[220px]">
                        <Button size="sm" variant="outline" className="w-full" onClick={() => handleEdit(district)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-destructive"
                          onClick={() => confirmDeleteDistrict(district)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <DataPagination
              page={list.page}
              pageSize={list.pageSize}
              totalPages={districtsResponse?.pagination?.totalPages ?? 1}
              totalDocs={districtTotal}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
              itemLabel="districts"
              disabled={isPlaceholderData}
            />
          </div>
        )}
      </SectionCard>

        <DistrictDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          district={selectedDistrict}
          mode={dialogMode}
        />
    </PageShell>
  );
};

export default ManageDistricts;
