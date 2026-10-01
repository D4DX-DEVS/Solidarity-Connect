import { useEffect, useState } from "react";
import { AlertTriangle, ChevronRight, RotateCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardOverview, type HierarchyRow } from "@/hooks/useDashboardOverview";
import { formatNumber, percent } from "./chartTheme";
import { HierarchyScorecard } from "./HierarchyScorecard";

interface DistrictDrilldownSheetProps {
  accountId: string | undefined;
  district: HierarchyRow | null;
  onClose: () => void;
}

/** State admin's drill-down: one district's areas, same scorecard one level down. */
export function DistrictDrilldownSheet({ accountId, district: selected, onClose }: DistrictDrilldownSheetProps) {
  const navigate = useNavigate();
  // Keep showing the last district while the sheet slides out, instead of flashing a blank skeleton.
  const [district, setDistrict] = useState(selected);
  useEffect(() => {
    if (selected) setDistrict(selected);
  }, [selected]);
  const query = useDashboardOverview(district ? accountId : undefined, district?.id);
  const data = query.data;

  // The row the admin clicked is already on screen — show it instantly, refine when areas load.
  const stats = district
    ? [
      { label: "Members", value: formatNumber(district.total), detail: `${percent(district.active, district.total)}% active` },
      { label: "Areas", value: String(district.areas), detail: district.areasWithoutAdmin ? `${district.areasWithoutAdmin} without admin` : "All have an admin" },
      { label: "Admins reporting", value: `${district.reportingAdmins}/${district.admins}`, detail: data ? `${data.activity.reportingWindow.from} – ${data.activity.reportingWindow.to}` : "Last 2 months" },
      { label: "Profiles complete", value: `${percent(district.completeProfiles, district.total)}%`, detail: `${formatNumber(district.total - district.completeProfiles)} need details` },
    ]
    : [];

  return (
    <Sheet open={!!selected} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-3xl">
        <SheetHeader className="space-y-1 border-b px-5 py-4 text-left">
          <SheetTitle className="text-lg">{district?.name}</SheetTitle>
          <SheetDescription>Areas in this district, largest first</SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 sm:gap-3 sm:p-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border bg-muted/30 p-3">
              <p className="truncate text-[11px] font-medium text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold tabular-nums text-foreground">{s.value}</p>
              <p className="truncate text-[11px] text-muted-foreground">{s.detail}</p>
            </div>
          ))}
        </div>

        <div className="border-t pt-3">
          {query.isError ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <AlertTriangle className="size-5 text-destructive" aria-hidden />
              <p className="text-sm text-muted-foreground">Couldn't load this district's areas.</p>
              <Button variant="outline" size="sm" className="min-h-11 gap-2 sm:min-h-9" onClick={() => query.refetch()}>
                <RotateCw className="size-4" aria-hidden /> Retry
              </Button>
            </div>
          ) : query.isPending ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : (
            <HierarchyScorecard rows={data?.children.rows ?? []} level="area" />
          )}
        </div>

        <div className="border-t p-4 sm:p-5">
          <Button variant="outline" className="min-h-11 w-full gap-1 sm:min-h-10" onClick={() => navigate("/state-admin/group-reports")}>
            Full census report <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
