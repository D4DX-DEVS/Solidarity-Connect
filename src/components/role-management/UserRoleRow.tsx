import { ArrowRight, ChevronDown, Link2, Loader2, Lock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getRoleLabel } from "@/lib/adminKinds";
import { cn } from "@/lib/utils";
import { AdminAccountsPanel } from "./AdminAccountsPanel";
import { RoleEditor } from "./RoleEditor";
import { AccountChips, OutlineChip, PersonCell, RoleTagChip } from "./RoleRowParts";
import {
  buildEditState,
  hasPendingEditState,
  recordName,
  recordTitle,
  type EditState,
  type RoleTagLike,
  type UserWithLeader,
} from "./roleUtils";

/** Desktop columns — shared with the list's column header so the two line up. */
export const USER_ROW_COLUMNS = "lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,1.2fr)_9rem]";

/** Desktop-only labels over the user list: admin access and leader roles are different things. */
export function UserRowHeader({ accessLabel }: { accessLabel: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "hidden gap-x-4 border border-transparent px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid",
        USER_ROW_COLUMNS,
      )}
    >
      <span className="pl-12">Name</span>
      <span>{accessLabel}</span>
      <span>Leader roles</span>
      <span className="pr-10 text-right">Leader</span>
    </div>
  );
}

interface UserRoleRowProps {
  user: UserWithLeader;
  state: EditState;
  /** Admin role ("District Admin") or member status. */
  accountLabel: string;
  /** The viewer may change this person's leader roles (hierarchy + scope). */
  editable: boolean;
  expanded: boolean;
  saving: boolean;
  dimmed: boolean;
  lockPrimaryType: boolean;
  allowedRoleTypes: readonly string[];
  onExpandedChange: (expanded: boolean) => void;
  onChange: (patch: Partial<EditState>) => void;
  onRemoveExtra: (index: number) => void;
  onSave: () => void;
  onDiscard: () => void;
  /** Jumps to the record this person's roles are edited on; omitted when the viewer can't open it. */
  onOpenLeaderRecord?: () => void;
}

/** One person: identity, account, saved roles, Leader switch; expands into the role editor. */
export function UserRoleRow({
  user,
  state,
  accountLabel,
  editable,
  expanded,
  saving,
  dimmed,
  lockPrimaryType,
  allowedRoleTypes,
  onExpandedChange,
  onChange,
  onRemoveExtra,
  onSave,
  onDiscard,
  onOpenLeaderRecord,
}: UserRoleRowProps) {
  // Roles of a person with several records are edited on one of them and copied to the rest.
  const managedOn = user.leaderRecord ? recordName(user.leaderRecord) : null;
  const canEdit = editable && !managedOn;
  const changed = canEdit && hasPendingEditState(state, user);
  const canExpand = canEdit && state.isLeader;
  const showEditor = canExpand && expanded;
  // Saved roles, not the draft — the chips change once the edit is saved.
  // This account can't hold the roles (they live on the member record): a person card still shows them.
  const notListed = !user.isLeader && !!user.leaderRecord?.isLeader;
  const shown = user.accounts && notListed && user.leaderRecord ? user.leaderRecord : user;
  const savedRoles = shown.isLeader ? [shown.roleTag, ...(shown.extraRoleTags || [])].filter((tag): tag is RoleTagLike => !!tag?.type) : [];
  const leaderTurnedOff = user.isLeader && !state.isLeader;
  // All Roles lists a person once: every admin account they hold, instead of "Also …".
  const accounts = user.accounts && user.accounts.length > 1 ? user.accounts : null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm transition-[opacity,border-color] duration-200",
        showEditor && "border-primary/50 ring-1 ring-primary/15",
        dimmed && "opacity-60",
      )}
    >
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 p-3 lg:gap-x-4 lg:px-4 lg:py-2.5",
          USER_ROW_COLUMNS,
        )}
      >
        <div
          className={cn("order-1 min-w-0", canExpand && "cursor-pointer")}
          onClick={canExpand ? () => onExpandedChange(!expanded) : undefined}
        >
          <PersonCell person={user} unsaved={changed} />
        </div>

        <div className="order-3 col-span-2 lg:order-2 lg:col-span-1">
          <AccountChips person={user}>
            {accounts ? (
              accounts.map((account) => <OutlineChip key={account._id}>{recordTitle(account)}</OutlineChip>)
            ) : (
              <>
                <OutlineChip>{accountLabel}</OutlineChip>
                {(user.linkedAccounts || []).map((account) => (
                  <OutlineChip key={account._id}>
                    <span className="font-normal text-muted-foreground">Also</span>&nbsp;{getRoleLabel(account.role, account.adminKind)}
                  </OutlineChip>
                ))}
              </>
            )}
          </AccountChips>
        </div>

        <div
          className={cn(
            "order-4 col-span-2 flex min-w-0 flex-wrap items-center gap-1.5 lg:order-3 lg:col-span-1",
            savedRoles.length === 0 && !shown.isLeader && "max-lg:hidden",
          )}
        >
          {savedRoles.length > 0 ? (
            savedRoles.map((tag, i) => <RoleTagChip key={i} tag={tag} />)
          ) : shown.isLeader ? (
            <span className="text-xs text-muted-foreground">No role set</span>
          ) : (
            <span className="text-sm text-muted-foreground">
              <span aria-hidden>—</span>
              <span className="sr-only">Not a leader</span>
            </span>
          )}
        </div>

        <div className="order-2 flex flex-col items-end gap-1 lg:order-4">
          {user.leaderRecord ? (
            // Not switchable here: a badge says where it is, instead of a faded switch.
            <span className="inline-flex max-w-36 items-start gap-1 rounded-md border bg-muted/60 px-2 py-1 text-[11px] leading-tight text-muted-foreground">
              <Link2 className="mt-px size-3 shrink-0" aria-hidden />
              <span>
                Managed by <span className="whitespace-nowrap font-medium text-foreground">{recordTitle(user.leaderRecord)}</span>
              </span>
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              <Label htmlFor={`leader-${user._id}`} className="text-xs font-medium text-muted-foreground">
                Leader
              </Label>
              <Switch
                id={`leader-${user._id}`}
                aria-label={`Leader status for ${user.name}`}
                checked={state.isLeader}
                disabled={!canEdit}
                onCheckedChange={(checked) => {
                  onChange({
                    isLeader: checked,
                    roleTagType: checked ? state.roleTagType : "",
                    roleTagName: checked ? state.roleTagName : "",
                    listingOrder: checked ? state.listingOrder : "",
                    extraRoles: checked ? state.extraRoles : [],
                  });
                  // Turning Leader on goes straight to the roles to fill in.
                  if (checked) onExpandedChange(true);
                }}
              />
              {canExpand ? (
                <button
                  type="button"
                  aria-expanded={showEditor}
                  aria-label={showEditor ? `Collapse leader role details for ${user.name}` : `Expand leader role details for ${user.name}`}
                  onClick={() => onExpandedChange(!expanded)}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronDown className={cn("size-4 transition-transform", showEditor && "rotate-180")} />
                </button>
              ) : (
                <span className="size-8" aria-hidden />
              )}
            </div>
          )}
          {!editable && !managedOn && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Lock className="size-3" aria-hidden /> View only
            </span>
          )}
        </div>
      </div>

      {showEditor && (
        <RoleEditor
          userName={user.name}
          state={state}
          changed={changed}
          dirty={canEdit && JSON.stringify(state) !== JSON.stringify(buildEditState(user))}
          saving={saving}
          lockPrimaryType={lockPrimaryType}
          allowedRoleTypes={allowedRoleTypes}
          onChange={onChange}
          onRemoveExtra={onRemoveExtra}
          onSave={onSave}
          onDiscard={onDiscard}
          intro={accounts ? <AdminAccountsPanel accounts={accounts} /> : undefined}
          lockHint={user.role === "group_admin" ? "An Area Admin's main role is their admin access — change it on the Admins page" : undefined}
        />
      )}

      {managedOn && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t bg-muted/40 px-3 py-1.5 lg:px-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link2 className="size-3.5 shrink-0" aria-hidden />
            {!notListed
              ? `Leader roles are edited on their ${managedOn} and synced here.`
              : user.accounts
                ? `Leader roles are edited on their ${managedOn}.`
                : `Leader roles are edited on their ${managedOn}. This account isn't listed as a leader.`}
          </p>
          {onOpenLeaderRecord && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 gap-1 px-2 text-xs text-primary hover:text-primary sm:min-h-8"
              aria-label={`Open ${user.name}'s ${managedOn}`}
              onClick={onOpenLeaderRecord}
            >
              Open {managedOn} <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          )}
        </div>
      )}

      {changed && !showEditor && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-amber-50 px-3 py-2 lg:px-4">
          <p className="text-xs text-amber-900">
            {leaderTurnedOff ? "Leader turned off — saving removes them from leader listings." : "You have unsaved changes."}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-9"
              aria-label={`Discard changes for ${user.name}`}
              onClick={onDiscard}
              disabled={saving}
            >
              Discard
            </Button>
            <Button type="button" size="sm" className="min-h-11 gap-1.5 sm:min-h-9" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
