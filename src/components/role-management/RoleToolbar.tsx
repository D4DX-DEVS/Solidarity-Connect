import { useState } from "react";
import { Loader2, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ToolbarOption {
  value: string;
  label: string;
}

interface FilterControl {
  value: string;
  options: ToolbarOption[];
  onChange: (value: string) => void;
}

interface RoleToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  role: FilterControl;
  /** Each is omitted when it doesn't apply to the current view or account. */
  district?: FilterControl;
  leaderStatus?: FilterControl;
  level?: FilterControl;
  /** "312 users" — omitted until the first load finishes. */
  countLabel?: string;
  busy: boolean;
  /** Narrowing filters in use (search excluded) — badge on the phone Filters button. */
  activeFilterCount: number;
  onClear?: () => void;
}

const LEADERS_VIEW = "leaders";

function ToolbarSelect({ label, control, className }: { label: string; control: FilterControl; className?: string }) {
  return (
    <Select value={control.value} onValueChange={control.onChange}>
      <SelectTrigger aria-label={label} className={cn("h-11 text-xs sm:text-sm lg:h-10", className)}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {control.options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.value === LEADERS_VIEW ? (
              <span className="flex items-center gap-1"><Star className="size-3" aria-hidden /> {o.label}</span>
            ) : (
              o.label
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Search + filters for Role Management. Pinned under the page header while the list scrolls. */
export function RoleToolbar({
  search,
  onSearchChange,
  role,
  district,
  leaderStatus,
  level,
  countLabel,
  busy,
  activeFilterCount,
  onClear,
}: RoleToolbarProps) {
  // Phones: only the search row stays pinned; the selects open below it on demand.
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-2 shadow-sm lg:flex-nowrap lg:p-2.5">
      <div className="relative min-w-0 flex-1 lg:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          aria-label="Search users by name or phone"
          placeholder="Search name or phone…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-11 pl-9 lg:h-10"
        />
      </div>

      <Button
        type="button"
        variant="outline"
        className="relative h-11 shrink-0 gap-1.5 px-3 lg:hidden"
        aria-expanded={filtersOpen}
        aria-controls="role-management-filters"
        onClick={() => setFiltersOpen((open) => !open)}
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Filters
        {activeFilterCount > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">
            {activeFilterCount}
          </span>
        )}
      </Button>

      <div
        id="role-management-filters"
        className={cn(
          "basis-full grid-cols-2 gap-2 lg:flex lg:basis-auto lg:items-center",
          filtersOpen ? "grid" : "hidden",
        )}
      >
        <ToolbarSelect label="Role" control={role} className="lg:w-44" />
        {level && <ToolbarSelect label="Level" control={level} className="lg:w-40" />}
        {district && <ToolbarSelect label="District" control={district} className="lg:w-44" />}
        {leaderStatus && <ToolbarSelect label="Leader status" control={leaderStatus} className="lg:w-44" />}
        {onClear && (
          <Button type="button" variant="ghost" className="h-11 gap-1 text-muted-foreground lg:hidden" onClick={onClear}>
            <X className="size-4" aria-hidden /> Clear filters
          </Button>
        )}
      </div>

      <div className="ml-auto hidden shrink-0 items-center gap-3 pl-1 lg:flex">
        {onClear && (
          <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={onClear}>
            <X className="size-4" aria-hidden /> Clear
          </Button>
        )}
        <span className="flex items-center gap-1.5 whitespace-nowrap text-sm font-medium tabular-nums text-muted-foreground" aria-live="polite">
          {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {countLabel}
        </span>
      </div>
    </div>
  );
}
