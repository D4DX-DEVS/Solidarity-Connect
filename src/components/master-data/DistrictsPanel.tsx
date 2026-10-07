import { useState } from "react";
import { Building2, Plus, Edit, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/app/AppShell";
import DataPagination from "@/components/app/DataPagination";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import DistrictDialog from "@/components/DistrictDialog";
import { useDistricts, useConfirmDeleteDistrict } from "@/hooks/useDistricts";
import { usePendingDeletes } from "@/lib/undoDelete";
import { useDebouncedParam, useListParams } from "@/hooks/useListParams";
import { District } from "@/lib/districts";

/** Master Data → Districts tab (state admin). Page, size and search live in the URL (districts_*). */
const DistrictsPanel = () => {
  const districtList = useListParams("districts");
  const [districtSearch, setDistrictSearch] = useDebouncedParam(districtList, "q");
  const districtQuery = districtList.getParam("q").trim();
  const [showDistrictDialog, setShowDistrictDialog] = useState(false);
  const [districtDialogMode, setDistrictDialogMode] = useState<"add" | "edit">("add");
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);

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

  return (
    <>
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

      <DistrictDialog
        open={showDistrictDialog}
        onOpenChange={setShowDistrictDialog}
        district={selectedDistrict}
        mode={districtDialogMode}
      />
    </>
  );
};

export default DistrictsPanel;
