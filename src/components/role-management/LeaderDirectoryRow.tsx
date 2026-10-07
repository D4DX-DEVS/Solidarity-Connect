import { Link2, Loader2, Lock, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AccountChips, OutlineChip, PersonCell, RoleTagChip } from "./RoleRowParts";
import { digitsOnly, hasPendingEditState, recordName, type EditState, type UserWithLeader } from "./roleUtils";

interface LeaderDirectoryRowProps {
  /** One role of a leader — multi-role leaders appear once per role (roleSlot). */
  leader: UserWithLeader;
  state: EditState;
  editable: boolean;
  saving: boolean;
  dimmed: boolean;
  onChange: (patch: Partial<EditState>) => void;
  onSave: () => void;
  onDiscard: () => void;
}

/** Leaders-only view: same row as the user list, with the role name and order edited in place. */
export function LeaderDirectoryRow({ leader, state, editable, saving, dimmed, onChange, onSave, onDiscard }: LeaderDirectoryRowProps) {
  const changed = editable && hasPendingEditState(state, leader);
  const slot = leader.roleSlot || 0;

  return (
    <div className={cn("rounded-xl border bg-card shadow-sm transition-opacity duration-200", dimmed && "opacity-60")}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 p-3 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,24rem)_3.5rem] lg:gap-x-4 lg:px-4 lg:py-2.5">
        <PersonCell person={leader} unsaved={changed} className="order-1" />

        <div className="order-3 col-span-2 lg:order-2 lg:col-span-1">
          <AccountChips person={leader}>
            {leader.roleTag?.type && <RoleTagChip tag={{ type: leader.roleTag.type, name: leader.roleTag.name }} />}
            {slot > 0 && <OutlineChip>Role {slot + 1}</OutlineChip>}
          </AccountChips>
        </div>

        <div className="order-4 col-span-2 min-w-0 lg:order-3 lg:col-span-1">
          {editable ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Role name"
                aria-label={`Role name for ${leader.name}${slot > 0 ? ` (role ${slot + 1})` : ""}`}
                value={state.roleTagName}
                onChange={(e) => onChange({ roleTagName: e.target.value })}
                className="h-11 min-w-0 flex-1 text-sm sm:h-9"
              />
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Order"
                aria-label={`Listing order for ${leader.name}${slot > 0 ? ` (role ${slot + 1})` : ""}`}
                value={state.listingOrder}
                onChange={(e) => onChange({ listingOrder: digitsOnly(e.target.value) })}
                className="h-11 w-20 text-sm sm:h-9"
              />
              {changed && (
                <div className="flex gap-2 max-lg:basis-full max-lg:justify-end">
                  <Button type="button" size="sm" className="min-h-11 gap-1.5 sm:min-h-9" onClick={onSave} disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 sm:h-9 sm:w-9"
                    aria-label={`Discard changes for ${leader.name}${slot > 0 ? ` (role ${slot + 1})` : ""}`}
                    onClick={onDiscard}
                    disabled={saving}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : leader.leaderRecord ? (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Link2 className="size-3" aria-hidden /> Edited on their {recordName(leader.leaderRecord)}
            </p>
          ) : (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Lock className="size-3" aria-hidden /> View only — outside what you manage
            </p>
          )}
        </div>

        <div className="order-2 text-right lg:order-4">
          {state.listingOrder ? (
            <span className="text-lg font-bold tabular-nums text-primary">#{state.listingOrder}</span>
          ) : (
            <span className="text-xs text-muted-foreground">No order</span>
          )}
        </div>
      </div>
    </div>
  );
}
