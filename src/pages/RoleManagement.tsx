import { useState, useEffect, useCallback, useRef } from "react";
import { Shield, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHero, PageShell } from "@/components/app/AppShell";
import DataPagination from "@/components/app/DataPagination";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import { EmptyState, ErrorState } from "@/components/shared/StateMessage";
import { LeaderDirectoryRow } from "@/components/role-management/LeaderDirectoryRow";
import { RoleToolbar, type ToolbarOption } from "@/components/role-management/RoleToolbar";
import { UserRoleRow, UserRowHeader } from "@/components/role-management/UserRoleRow";
import {
  ROLE_TYPE_LABELS,
  buildEditState,
  buildSavePayload,
  groupLeaders,
  mergeEditStates,
  phoneSearchKey,
  roleTagLabel,
  rowKey,
  type EditState,
  type LeaderGroup,
  type UserWithLeader,
} from "@/components/role-management/roleUtils";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedParam, useListParams } from "@/hooks/useListParams";
import { useAuth } from "@/contexts/AuthContext";
import { usersAPI, leadersAPI, membersAPI, districtsAPI } from "@/utils/api";
import { getRoleLabel } from "@/lib/adminKinds";
import { LEADER_ROLE_TYPES, canManageLeaderTarget, canManageRoleType } from "@/lib/roleHierarchy";
import { confirmAction } from "@/lib/confirm";
import { undoableDelete } from "@/lib/undoDelete";

const ALL = "all";
const LEADERS_VIEW = "leaders";
const MULTI_VIEW = "multi"; // people holding more than one admin account

const LEADER_STATUS_OPTIONS: ToolbarOption[] = [
  { value: ALL, label: "Any leader status" },
  { value: "yes", label: "Leaders" },
  { value: "no", label: "Not leaders" },
];

const LEVEL_OPTIONS: ToolbarOption[] = [
  { value: ALL, label: "All Levels" },
  ...["state", "district", "area", "unit", "murabi", "coordinator"].map((t) => ({ value: t, label: ROLE_TYPE_LABELS[t] })),
];

/** Views this account may switch between — district admins see no State Admins, area admins only members. */
function roleOptionsFor(userRole?: string | null): ToolbarOption[] {
  const isState = userRole === "state_admin";
  const seesAdmins = isState || userRole === "district_admin";
  return [
    ...(isState
      ? [
          { value: ALL, label: "All Roles" },
          { value: MULTI_VIEW, label: "Multi-role Admins" },
          { value: "state_admin", label: "State Admins" },
        ]
      : []),
    ...(seesAdmins ? [{ value: "district_admin", label: "District Admins" }, { value: "group_admin", label: "Area Admins" }] : []),
    { value: "member", label: "Members" },
    { value: LEADERS_VIEW, label: "Leaders Only" },
  ];
}

/** URL value when it is one of the options, otherwise the fallback (old links, hand edits). */
const pick = (raw: string, options: ToolbarOption[], fallback = "") => (options.some((o) => o.value === raw) ? raw : fallback);

const RoleManagement = () => {
  const { toast } = useToast();
  const { userRole, user: authUser } = useAuth();
  const isStateAdmin = userRole === "state_admin";

  // View, filters, page and size live in the URL so refresh and back/forward keep the view.
  const list = useListParams();
  const { setParam, setParams } = list;
  const [searchDraft, setSearchDraft] = useDebouncedParam(list, "q");
  const search = list.getParam("q").trim();
  const roleOptions = roleOptionsFor(userRole);
  const defaultRole = isStateAdmin ? ALL : "member";
  const roleFilter = pick(list.getParam("role"), roleOptions, defaultRole);
  const leaderStatus = pick(list.getParam("leader"), LEADER_STATUS_OPTIONS);
  const levelFilter = pick(list.getParam("level"), LEVEL_OPTIONS);
  const isMemberView = roleFilter === "member";
  // All Roles lists people (their admin accounts grouped); a role filter lists single accounts.
  const byPerson = roleFilter === ALL || roleFilter === MULTI_VIEW;
  const isLeadersView = roleFilter === LEADERS_VIEW;
  // The leader directory is org-wide for every role; the user/member lists only narrow by district for state admins.
  const showDistrict = isLeadersView || isStateAdmin;
  const district = showDistrict ? list.getParam("district") : "";

  const [users, setUsers] = useState<UserWithLeader[]>([]);
  const [loading, setLoading] = useState(true);   // initial full-screen load
  const [fetching, setFetching] = useState(false); // background refetch (search/filter)
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [editStates, setEditStates] = useState<Record<string, EditState>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  const isInitialLoad = loading && users.length === 0;

  const [leaderGroups, setLeaderGroups] = useState<LeaderGroup[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [leaderTotal, setLeaderTotal] = useState(0);
  const [districts, setDistricts] = useState<{ _id: string; name: string }[]>([]);

  // Hierarchy: district admins manage area-level roles, area admins area-level + unit (state admin: all).
  const allowedRoleTypes = LEADER_ROLE_TYPES.filter((t) => canManageRoleType(authUser, t));

  // Tracks whether the first successful fetch has completed
  const hasLoadedRef = useRef(false);
  // Only the newest request of each list may write results — filters can change faster than
  // responses arrive. Separate counters so switching views never strands the other list's spinner.
  const usersRequestRef = useRef(0);
  const leadersRequestRef = useRef(0);
  const districtsRequestedRef = useRef(false);

  const fetchUsers = useCallback(async (isBackground = false) => {
    const requestId = ++usersRequestRef.current;
    if (isBackground) {
      setFetching(true);
    } else {
      setLoading(true);
    }
    try {
      // withLinks: the person's other logins, and where their roles are edited
      const params: Record<string, string | number> = { page: list.page, limit: list.pageSize, withLinks: "true" };
      if (search) params.search = search;
      if (leaderStatus) params.isLeader = leaderStatus === "yes" ? "true" : "false";
      if (district) params.district = district;

      let result;
      if (isMemberView) {
        params.forLeaderAssignment = "true";
        params.includeStats = "false"; // the member totals block isn't shown here
        result = await membersAPI.getMembers(params);
      } else {
        // Area-level filters arrive as "group_admin:<kind>" — Murabi and Coordinator
        // admins share the group_admin role and differ only by adminKind.
        if (byPerson) {
          params.groupBy = "person";
          if (roleFilter === MULTI_VIEW) params.severalAccounts = "true";
        } else {
          const [filterRole, filterKind] = roleFilter.split(":");
          params.role = filterRole;
          if (filterKind) params.adminKind = filterKind;
        }
        result = await usersAPI.getUsers(params);
      }
      if (requestId !== usersRequestRef.current) return;

      const data: UserWithLeader[] = result.data || [];
      setUsers(data);
      if (result.pagination) {
        setTotalPages(result.pagination.totalPages || 1);
        setTotalDocs(result.pagination.totalDocs || 0);
      }
      setEditStates((prev) => mergeEditStates(prev, data));
      setLoadError(false);
      hasLoadedRef.current = true;
    } catch (error) {
      if (requestId !== usersRequestRef.current) return;
      setLoadError(true);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      if (requestId === usersRequestRef.current) {
        setLoading(false);
        setFetching(false);
      }
    }
  }, [list.page, list.pageSize, search, leaderStatus, district, roleFilter, isMemberView, byPerson, toast]);

  useEffect(() => {
    if (!isLeadersView) {
      fetchUsers(hasLoadedRef.current);
    }
  }, [fetchUsers, isLeadersView]);

  // District options, loaded the first time the filter is shown
  useEffect(() => {
    if (!showDistrict || districtsRequestedRef.current) return;
    districtsRequestedRef.current = true;
    districtsAPI.getDistricts({ limit: 100 }).then((res: { data?: { _id: string; name: string }[] }) => {
      setDistricts(res.data || []);
    }).catch(() => {
      districtsRequestedRef.current = false;
    });
  }, [showDistrict]);

  const fetchLeaders = useCallback(async () => {
    const requestId = ++leadersRequestRef.current;
    setLeadersLoading(true);
    try {
      // One row per role — already ~500 rows org-wide, so leave headroom.
      const params: Record<string, string> = { limit: "1000" };
      if (levelFilter) params.roleType = levelFilter;
      if (district) params.districtId = district;
      if (search) params.search = search;

      const result = await leadersAPI.getLeaders(params);
      if (requestId !== leadersRequestRef.current) return;
      const data: UserWithLeader[] = result.data || [];
      setEditStates((prev) => mergeEditStates(prev, data));
      setLeaderGroups(groupLeaders(data));
      setLeaderTotal(result.pagination?.totalDocs ?? data.length);
      setLoadError(false);
    } catch {
      if (requestId !== leadersRequestRef.current) return;
      setLoadError(true);
      toast({ title: "Error", description: "Failed to load leaders", variant: "destructive" });
    } finally {
      if (requestId === leadersRequestRef.current) setLeadersLoading(false);
    }
  }, [levelFilter, district, search, toast]);

  useEffect(() => {
    if (isLeadersView) {
      fetchLeaders();
    }
  }, [isLeadersView, fetchLeaders]);

  // Reload whatever is on screen now — a save can finish after the view or filters changed.
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    refreshRef.current = isLeadersView ? fetchLeaders : () => fetchUsers(true);
  }, [isLeadersView, fetchLeaders, fetchUsers]);

  const handleSave = async (user: UserWithLeader) => {
    const key = rowKey(user);
    const state = editStates[key];
    if (!state) return;
    setSaving(key);
    try {
      const payload = buildSavePayload(user, state);
      // From the row itself: member records have no role (or 'member' in the leaders view).
      const isMemberRecord = !user.role || user.role === "member";
      if (isMemberRecord) {
        await membersAPI.updateMemberLeader(user._id, payload);
      } else {
        await leadersAPI.updateLeader(user._id, payload);
      }
      toast({ title: "Saved", description: "Leader status updated successfully" });
      // Wait for fresh rows so the row never shows its old values as "unsaved" in between.
      await refreshRef.current();
      setExpandedCards((prev) => ({ ...prev, [key]: false }));
    } catch (error: unknown) {
      const message = error instanceof Error && error.message ? error.message : "Failed to update";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const updateEditState = (userId: string, patch: Partial<EditState>) => {
    setEditStates((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], ...patch },
    }));
  };

  // Asks first (unless the row is still blank); Undo puts the row back for 10 seconds.
  const removeExtraRole = async (user: UserWithLeader, index: number) => {
    const removed = editStates[user._id]?.extraRoles[index];
    if (!removed) return;
    const blank = !removed.type && !removed.name.trim();
    const roleLabel = roleTagLabel(removed);
    if (!blank) {
      const confirmed = await confirmAction({
        title: "Remove this role?",
        description: `It comes off ${user.name} when you save.`,
        itemName: roleLabel,
        confirmLabel: "Remove",
        undoable: true,
      });
      if (!confirmed) return;
    }
    const updateRoles = (change: (roles: EditState["extraRoles"]) => EditState["extraRoles"]) =>
      setEditStates((prev) => {
        const current = prev[user._id];
        return current ? { ...prev, [user._id]: { ...current, extraRoles: change(current.extraRoles) } } : prev;
      });
    updateRoles((roles) => roles.filter((_, i) => i !== index));
    if (blank) return;
    undoableDelete({
      title: "Role removed",
      description: roleLabel,
      onRestore: () => updateRoles((roles) => [...roles.slice(0, index), removed, ...roles.slice(index)]),
    });
  };

  // A person's roles are edited on one record; jump there when this viewer can open that list.
  const openLeaderRecord = (user: UserWithLeader) => {
    const view = user.leaderRecord?.role;
    if (!view || !roleOptions.some((o) => o.value === view)) return undefined;
    return () => {
      const q = phoneSearchKey(user.phone);
      setSearchDraft(q);
      setParams({ role: view === defaultRole ? "" : view, q, leader: "", district: "" });
    };
  };

  // Area-level admins share role 'group_admin', so the badge needs adminKind to
  // tell an Area Admin from a Murabi or Coordinator Admin.
  const accountLabel = (user: UserWithLeader) =>
    isMemberView ? user.status || "Member" : user.role ? getRoleLabel(user.role, user.adminKind) : "Member";

  const leaderDirectoryCount = leaderGroups.reduce((sum, group) => sum + group.leaders.length, 0);
  const activeFilterCount = [district, !isLeadersView && leaderStatus, isLeadersView && levelFilter].filter(Boolean).length;
  const filtersActive = activeFilterCount > 0 || !!search;
  const clearFilters = () => {
    setSearchDraft("");
    setParams({ q: "", district: "", leader: "", level: "" });
  };
  const countLabel = isLeadersView
    ? leadersLoading && leaderGroups.length === 0 ? undefined : `${leaderTotal} ${leaderTotal === 1 ? "leader" : "leaders"}`
    : isInitialLoad
      ? undefined
      : byPerson
        ? `${totalDocs} ${totalDocs === 1 ? "person" : "people"}`
        : `${totalDocs} ${isMemberView ? "member" : "user"}${totalDocs === 1 ? "" : "s"}`;
  const clearButton = filtersActive ? (
    <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
  ) : undefined;

  const renderLeaders = () => {
    if (leadersLoading && leaderGroups.length === 0) return <ListSkeleton rows={5} />;
    if (loadError && leaderGroups.length === 0) return <ErrorState message="Couldn't load leaders." onRetry={fetchLeaders} />;
    if (leaderGroups.length === 0) {
      return <EmptyState icon={Star} title="No leaders found" description={filtersActive ? "Nothing matches these filters." : undefined} action={clearButton} />;
    }
    return (
      <div className="space-y-5">
        {leaderGroups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <div className="mb-2 flex items-center gap-2 px-1">
              <Star className="size-4 text-yellow-500" aria-hidden />
              <h3 className="text-sm font-semibold">{group.label}</h3>
              <Badge variant="outline" className="ml-auto text-xs">{group.leaders.length}</Badge>
            </div>
            <div className="space-y-2">
              {group.leaders.map((leader) => {
                const key = rowKey(leader);
                const state = editStates[key];
                if (!state) return null;
                return (
                  <LeaderDirectoryRow
                    key={key}
                    leader={leader}
                    state={state}
                    // Rows here are fanned out per role and span every district, so
                    // the server decides (scope + hierarchy) for the whole person.
                    editable={leader.canEdit ?? canManageLeaderTarget(authUser, leader)}
                    saving={saving === key}
                    dimmed={leadersLoading}
                    onChange={(patch) => updateEditState(key, patch)}
                    onSave={() => handleSave(leader)}
                    onDiscard={() => updateEditState(key, buildEditState(leader))}
                  />
                );
              })}
            </div>
          </section>
        ))}
        {leaderDirectoryCount < leaderTotal && (
          <p className="text-center text-xs font-medium text-amber-800">
            Showing the first {leaderDirectoryCount} of {leaderTotal} — narrow with Level, District or search.
          </p>
        )}
        <p className="py-2 text-center text-xs text-muted-foreground">
          Same listing order number can be used across different districts or areas because ordering is per scope.
        </p>
      </div>
    );
  };

  const renderUsers = () => {
    if (isInitialLoad) return <ListSkeleton rows={8} />;
    if (loadError && users.length === 0) {
      return <ErrorState message={`Couldn't load ${isMemberView ? "members" : "users"}.`} onRetry={() => fetchUsers()} />;
    }
    if (users.length === 0 && !fetching) {
      return (
        <EmptyState
          icon={Users}
          title={isMemberView ? "No members found" : byPerson ? "No people found" : "No users found"}
          description={filtersActive ? "Nothing matches these filters." : undefined}
          action={clearButton}
        />
      );
    }
    return (
      <div className="space-y-2">
        <UserRowHeader accessLabel={isMemberView ? "Status & location" : "Admin access"} />
        {users.map((user) => {
          const state = editStates[user._id];
          if (!state) return null;
          return (
            <UserRoleRow
              key={user._id}
              user={user}
              state={state}
              accountLabel={accountLabel(user)}
              editable={canManageLeaderTarget(authUser, user)}
              expanded={!!expandedCards[user._id]}
              saving={saving === user._id}
              dimmed={fetching}
              // An admin account's primary role is locked for non-state admins; an Area Admin's
              // is their access, set on the Admins page — locked for everyone.
              lockPrimaryType={user.role === "group_admin" || (!isStateAdmin && !!user.role && user.role !== "member")}
              allowedRoleTypes={allowedRoleTypes}
              onExpandedChange={(open) => setExpandedCards((prev) => ({ ...prev, [user._id]: open }))}
              onChange={(patch) => updateEditState(user._id, patch)}
              onRemoveExtra={(index) => removeExtraRole(user, index)}
              onSave={() => handleSave(user)}
              onDiscard={() => updateEditState(user._id, buildEditState(user))}
              onOpenLeaderRecord={openLeaderRecord(user)}
            />
          );
        })}
      </div>
    );
  };

  return (
    <PageShell contentClassName="pb-28">
      {/* Header + toolbar pinned together; on phones the header is hidden so the toolbar sits at the top. */}
      <div className="sticky top-0 z-30 flex flex-col gap-3 bg-background pb-1 sm:gap-4 lg:-mt-4">
        <PageHero
          title="Role Management"
          subtitle="Assign leader roles, set listing order, and manage leader visibility."
          eyebrow="Administration"
          icon={<Shield className="h-6 w-6" />}
          className="!mt-0"
        />
        <RoleToolbar
          search={searchDraft}
          onSearchChange={setSearchDraft}
          role={{ value: roleFilter, options: roleOptions, onChange: (v) => setParam("role", v === defaultRole ? "" : v) }}
          level={isLeadersView ? { value: levelFilter || ALL, options: LEVEL_OPTIONS, onChange: (v) => setParam("level", v === ALL ? "" : v) } : undefined}
          district={showDistrict ? {
            value: district || ALL,
            options: [{ value: ALL, label: "All Districts" }, ...districts.map((d) => ({ value: d._id, label: d.name }))],
            onChange: (v) => setParam("district", v === ALL ? "" : v),
          } : undefined}
          leaderStatus={isLeadersView ? undefined : { value: leaderStatus || ALL, options: LEADER_STATUS_OPTIONS, onChange: (v) => setParam("leader", v === ALL ? "" : v) }}
          countLabel={countLabel}
          busy={isLeadersView ? leadersLoading && leaderGroups.length > 0 : fetching && !isInitialLoad}
          activeFilterCount={activeFilterCount}
          onClear={filtersActive ? clearFilters : undefined}
        />
      </div>

      {isLeadersView ? renderLeaders() : renderUsers()}

      {!isLeadersView && !isInitialLoad && (
        <DataPagination
          page={list.page}
          pageSize={list.pageSize}
          totalPages={totalPages}
          totalDocs={totalDocs}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          itemLabel={byPerson ? "people" : isMemberView ? "members" : "users"}
          disabled={fetching}
        />
      )}
    </PageShell>
  );
};

export default RoleManagement;
