import { useEffect, useState } from "react";
import { AlertTriangle, Building2, ChevronRight, RotateCw, UserCog, Users, X, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardOverview, type HierarchyRow } from "@/hooks/useDashboardOverview";
import { cn } from "@/lib/utils";
import { formatNumber, percent } from "./chartTheme";
import { HierarchyScorecard } from "./HierarchyScorecard";

interface DistrictDrilldownSheetProps {
  accountId: string | undefined;
  district: HierarchyRow | null;
  onClose: () => void;
  /** False when no report form is published — show admin counts, not 0/N reporting. */
  reporting?: boolean;
}

interface Stat {
  className?: string;
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tile: string;
}

// Same icon tiles as the dashboard KPI cards, so the sheet reads as part of the page.
function StatTile({ label, value, detail, icon: Icon, tile, className }: Stat) {
  return (
    <div className={cn("rounded-2xl border bg-card p-3 shadow-sm", className)}>
      <div className="flex items-center gap-2">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", tile)}>
          <Icon className="size-3.5" aria-hidden />
        </span>
        <p className="min-w-0 truncate text-[11px] font-medium text-muted-foreground sm:text-xs">{label}</p>
      </div>
      <p className="mt-1.5 text-lg font-bold tabular-nums tracking-tight text-foreground sm:text-xl">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{detail}</p>
    </div>
  );
}

/** State admin's drill-down: one district's areas, same scorecard one level down. */
export function DistrictDrilldownSheet({ accountId, district: selected, onClose, reporting = true }: DistrictDrilldownSheetProps) {
  const navigate = useNavigate();
  // Keep showing the last district while the sheet slides out, instead of flashing a blank skeleton.
  const [district, setDistrict] = useState(selected);
  useEffect(() => {
    if (selected) setDistrict(selected);
  }, [selected]);
  const query = useDashboardOverview(district ? accountId : undefined, district?.id);
  const data = query.data;

  // The row the admin clicked is already on screen — show it instantly, refine when areas load.
  const stats: Stat[] = district
    ? [
      // Same arrangement as the dashboard KPI row: members full width on phones, three across from sm.
      { label: "Members", value: formatNumber(district.total), detail: `${percent(district.active, district.total)}% active`, icon: Users, tile: "bg-info/10 text-info", className: "col-span-2 sm:col-span-1" },
      { label: "Areas", value: String(district.areas), detail: district.areasWithoutAdmin ? `${district.areasWithoutAdmin} without admin` : "All have an admin", icon: Building2, tile: "bg-[#7c5cff]/10 text-[#7c5cff]" },
      reporting
        ? { label: "Admins reporting", value: `${district.reportingAdmins}/${district.admins}`, detail: data ? `${data.activity.reportingWindow.from} – ${data.activity.reportingWindow.to}` : "Last 2 months", icon: UserCog, tile: "bg-warning/15 text-amber-600 dark:text-amber-400" }
        : { label: "Admins", value: formatNumber(district.admins), detail: "No report form yet", icon: UserCog, tile: "bg-warning/15 text-amber-600 dark:text-amber-400" },
    ]
    : [];

  return (
    <Sheet open={!!selected} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        hideClose
        overlayClassName="bg-black/40 backdrop-blur-[2px] data-[state=open]:duration-300 data-[state=closed]:duration-200"
        // Fixed header and footer; only the body scrolls. Quicker ease-out slide than the 500ms default.
        className="flex w-full flex-col gap-0 p-0 ease-out data-[state=closed]:duration-200 data-[state=open]:duration-300 sm:max-w-3xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b bg-card px-4 py-4 sm:px-5">
          <div className="min-w-0 space-y-0.5">
            <SheetTitle className="truncate text-lg tracking-tight">{district?.name}</SheetTitle>
            <SheetDescription>
              {district ? `${district.areas} area${district.areas === 1 ? "" : "s"} · largest first` : "Areas in this district"}
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <Button variant="outline" size="icon" className="size-11 shrink-0 rounded-xl sm:size-9" aria-label="Close">
              <X className="size-4" aria-hidden />
            </Button>
          </SheetClose>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 sm:gap-3 sm:p-5">
            {stats.map((s) => <StatTile key={s.label} {...s} />)}
          </div>

          <div className="mx-4 mb-4 overflow-hidden rounded-2xl border bg-card shadow-sm sm:mx-5 sm:mb-5">
            {query.isError ? (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <AlertTriangle className="size-5 text-destructive" aria-hidden />
                <p className="text-sm text-muted-foreground">Couldn't load this district's areas.</p>
                <Button variant="outline" size="sm" className="min-h-11 gap-2 sm:min-h-9" onClick={() => query.refetch()}>
                  <RotateCw className="size-4" aria-hidden /> Retry
                </Button>
              </div>
            ) : query.isPending ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: Math.min(Math.max(district?.areas ?? 6, 3), 8) }, (_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
              </div>
            ) : (
              <div className="pt-3 animate-in fade-in duration-300">
                <HierarchyScorecard rows={data?.children.rows ?? []} level="area" reporting={reporting} />
              </div>
            )}
          </div>
        </div>

        <footer className="shrink-0 border-t bg-card p-4 sm:px-5">
          <Button variant="outline" className="min-h-11 w-full gap-1 sm:min-h-10" onClick={() => navigate("/reports?tab=consolidated")}>
            Monthly reports <ChevronRight className="size-4" aria-hidden />
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
