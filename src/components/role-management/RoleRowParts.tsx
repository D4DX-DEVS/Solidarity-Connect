import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROLE_TYPE_COLORS, roleTagLabel, type RoleTagLike, type UserWithLeader } from "./roleUtils";

/** Name + phone with a brand-tinted initial; flags rows that have edits not yet saved. */
export function PersonCell({ person, unsaved, className }: { person: UserWithLeader; unsaved: boolean; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <span
        aria-hidden
        className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary sm:flex"
      >
        {person.name.trim().charAt(0).toUpperCase() || "?"}
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-semibold leading-tight" title={person.name}>{person.name}</p>
          {unsaved && (
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-800">
              Unsaved
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground tabular-nums sm:text-sm">{person.phone}</p>
      </div>
    </div>
  );
}

const CHIP = "px-2 py-0.5 text-[11px] font-medium sm:text-xs";

type Places = { district?: { name: string } | null; group?: { name: string } | null };
const unique = (names: (string | undefined)[]) => [...new Set(names.filter((n): n is string => !!n))];

/** Leading chips (account badge, role chip…) followed by district and area — every place, for a person with several accounts. */
export function AccountChips({ person, children }: { person: UserWithLeader; children?: ReactNode }) {
  const sources: Places[] = person.accounts?.length ? person.accounts : [person];
  const districts = unique(sources.map((s) => s.district?.name));
  const groups = unique(sources.map((s) => s.group?.name));
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {children}
      {districts.map((name) => (
        <Badge key={name} variant="secondary" className={cn("gap-1", CHIP)}>
          <MapPin className="size-3 shrink-0" aria-hidden />
          {name}
        </Badge>
      ))}
      {groups.map((name) => (
        <Badge key={name} variant="secondary" className={CHIP}>{name}</Badge>
      ))}
    </div>
  );
}

/** Neutral outline badge — admin role, member status, "Role 2". */
export function OutlineChip({ children }: { children: ReactNode }) {
  return <Badge variant="outline" className={CHIP}>{children}</Badge>;
}

/** Scope-coloured chip, e.g. "District · Organisation Secretary". */
export function RoleTagChip({ tag }: { tag: RoleTagLike }) {
  return (
    <span
      className={cn(
        "inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium sm:text-xs",
        ROLE_TYPE_COLORS[tag.type || ""] || "bg-gray-100 text-gray-700",
      )}
    >
      {roleTagLabel(tag)}
    </span>
  );
}
