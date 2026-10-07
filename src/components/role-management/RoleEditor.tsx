import type { ReactNode } from "react";
import { Loader2, Lock, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ROLE_TYPE_LABELS, digitsOnly, type EditState, type ExtraRoleEdit } from "./roleUtils";

interface RoleEditorProps {
  userName: string;
  state: EditState;
  /** Something to save. */
  changed: boolean;
  /** Differs from the saved roles at all — e.g. a blank row just added — so Discard has work to do. */
  dirty: boolean;
  saving: boolean;
  /** Admin account's primary scope also sets its access — only a state admin changes it. */
  lockPrimaryType: boolean;
  /** Why the primary scope is locked, when it isn't the default reason. */
  lockHint?: string;
  allowedRoleTypes: readonly string[];
  onChange: (patch: Partial<EditState>) => void;
  onRemoveExtra: (index: number) => void;
  onSave: () => void;
  onDiscard: () => void;
  /** Shown above the roles — e.g. the person's admin accounts. */
  intro?: ReactNode;
}

// Phone: Scope + Position on one line, Order + action below. sm+: one table row.
const ROW_GRID =
  "grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-2 sm:grid-cols-[1.25rem_minmax(8rem,11rem)_minmax(0,1fr)_6rem_6rem] sm:gap-3";
const FIELD = "h-11 text-sm sm:h-9";

function ScopeSelect({ value, allowed, disabled, label, onChange }: {
  value: string;
  allowed: readonly string[];
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
}) {
  // A scope outside what this admin may assign still has to show its name.
  const options = value && !allowed.includes(value) ? [value, ...allowed] : allowed;
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={FIELD} aria-label={label}>
        <SelectValue placeholder="Scope" />
      </SelectTrigger>
      <SelectContent>
        {options.map((rt) => (
          <SelectItem key={rt} value={rt} disabled={!allowed.includes(rt)}>
            {ROLE_TYPE_LABELS[rt] || rt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Every role a leader holds as one row each: scope, position, listing order. Row 1 is the primary role. */
export function RoleEditor({
  userName,
  state,
  changed,
  dirty,
  saving,
  lockPrimaryType,
  lockHint = "Only a state admin can change an admin account's main scope",
  allowedRoleTypes,
  onChange,
  onRemoveExtra,
  onSave,
  onDiscard,
  intro,
}: RoleEditorProps) {
  const lines: ExtraRoleEdit[] = [
    { type: state.roleTagType, name: state.roleTagName, listingOrder: state.listingOrder },
    ...state.extraRoles,
  ];

  const updateLine = (index: number, patch: Partial<ExtraRoleEdit>) => {
    if (index > 0) {
      onChange({ extraRoles: state.extraRoles.map((r, i) => (i === index - 1 ? { ...r, ...patch } : r)) });
      return;
    }
    const primary: Partial<EditState> = {};
    if (patch.type !== undefined) primary.roleTagType = patch.type;
    if (patch.name !== undefined) primary.roleTagName = patch.name;
    if (patch.listingOrder !== undefined) primary.listingOrder = patch.listingOrder;
    onChange(primary);
  };

  return (
    <div className="border-t border-primary/15 bg-primary/5 px-3 py-3 lg:px-4">
      {intro}
      <div className="pb-2">
        <p className="text-sm font-semibold">Leader role assignments</p>
        <p className="text-xs text-muted-foreground">
          Leader positions shown on dashboards and the Leaders page. They don't change admin access.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div
          aria-hidden
          className={cn(ROW_GRID, "hidden border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid")}
        >
          <span>#</span>
          <span>Scope</span>
          <span>Position / Role</span>
          <span>Listing order</span>
          <span className="text-right">Actions</span>
        </div>

        {lines.map((line, index) => {
          const n = index + 1;
          const locked = index === 0 && lockPrimaryType;
          return (
            <div key={index} role="group" aria-label={`Role ${n}`} className={cn(ROW_GRID, "border-b px-3 py-2.5 last:border-b-0")}>
              <span className="hidden text-sm tabular-nums text-muted-foreground sm:block">{n}</span>
              <div
                className="flex min-w-0 items-center gap-1.5"
                title={locked ? lockHint : undefined}
              >
                <div className="min-w-0 flex-1">
                  <ScopeSelect
                    value={line.type}
                    allowed={allowedRoleTypes}
                    disabled={locked}
                    label={`Scope for role ${n} of ${userName}`}
                    onChange={(val) => updateLine(index, { type: val })}
                  />
                </div>
                {locked && (
                  <>
                    <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="sr-only">Scope locked</span>
                  </>
                )}
              </div>
              <Input
                placeholder="Position (e.g. Secretary)"
                aria-label={`Position for role ${n} of ${userName}`}
                value={line.name}
                onChange={(e) => updateLine(index, { name: e.target.value })}
                className={FIELD}
              />
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Order"
                aria-label={`Listing order for role ${n} of ${userName}`}
                value={line.listingOrder}
                onChange={(e) => updateLine(index, { listingOrder: digitsOnly(e.target.value) })}
                className={FIELD}
              />
              <div className="flex justify-end">
                {index === 0 ? (
                  <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">Primary</span>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-9 sm:w-9"
                    aria-label={`Remove role ${n} for ${userName}`}
                    onClick={() => onRemoveExtra(index - 1)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-2 h-11 w-full gap-1.5 border-dashed text-primary hover:text-primary sm:h-9"
        onClick={() => onChange({ extraRoles: [...state.extraRoles, { type: "", name: "", listingOrder: "" }] })}
      >
        <Plus className="size-4" /> Add another role
      </Button>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Lower listing order shows first on every dashboard; leave it blank to appear last. Each district and area keeps its own order.
        </p>
        <div className="flex shrink-0 justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" onClick={onDiscard} disabled={!(changed || dirty) || saving}>
            Discard
          </Button>
          <Button type="button" className="min-h-11 gap-1.5 sm:min-h-9" onClick={onSave} disabled={!changed || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
