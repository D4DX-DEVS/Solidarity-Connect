import { useState, useEffect, useCallback, useRef } from "react";
import { Shield, Search, ChevronLeft, ChevronRight, ChevronDown, Users, Tag, Save, X, ListOrdered, Star, Filter, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usersAPI, leadersAPI, membersAPI, districtsAPI } from "@/utils/api";
import { getRoleLabel } from "@/lib/adminKinds";

const ROLE_TYPE_LABELS: Record<string, string> = {
  state: "State",
  district: "District",
  area: "Area",
  unit: "Unit",
  murabi: "Murabi",
  coordinator: "Coordinator",
};

const ROLE_TYPE_COLORS: Record<string, string> = {
  state: "bg-purple-100 text-purple-800",
  district: "bg-blue-100 text-blue-800",
  area: "bg-green-100 text-green-800",
  unit: "bg-orange-100 text-orange-800",
  murabi: "bg-teal-100 text-teal-800",
  coordinator: "bg-indigo-100 text-indigo-800",
};

const ALLOWED_ROLE_TYPES: Record<string, string[]> = {
  state_admin: ["state", "district", "area", "unit", "murabi", "coordinator"],
  district_admin: ["district", "area", "unit", "murabi", "coordinator"],
  group_admin: ["area", "unit", "murabi", "coordinator"],
};

interface RoleTagLike {
  type?: string;
  name?: string;
  listingOrder?: number | null;
}

interface UserWithLeader {
  _id: string;
  name: string;
  phone: string;
  role?: string;
  // Distinguishes Area / Murabi / Coordinator admins, which all share role 'group_admin'.
  adminKind?: string | null;
  status?: string; // for members
  isLeader: boolean;
  roleTag?: RoleTagLike;
  extraRoleTags?: RoleTagLike[];
  roleSlot?: number; // leaders view fan-out: 0 = primary role, N = extraRoleTags[N-1]
  district?: { name: string };
  group?: { name: string };
}

interface ExtraRoleEdit {
  type: string;
  name: string;
  listingOrder: string;
}

interface EditState {
  isLeader: boolean;
  roleTagType: string;
  roleTagName: string;
  listingOrder: string; // kept as string for a controlled input; empty means "no order"
  extraRoles: ExtraRoleEdit[];
}

// Leaders view fans a multi-role leader into one row per role sharing the same
// _id, so edit states are keyed by _id + roleSlot.
const rowKey = (user: UserWithLeader) => (user.roleSlot ? `${user._id}#${user.roleSlot}` : user._id);

const buildExtraRoleEdits = (user: UserWithLeader): ExtraRoleEdit[] =>
  (user.extraRoleTags || []).map((r) => ({
    type: r.type || "",
    name: r.name || "",
    listingOrder: typeof r.listingOrder === "number" ? String(r.listingOrder) : "",
  }));

const buildEditState = (user: UserWithLeader): EditState => ({
  isLeader: user.isLeader || false,
  roleTagType: user.roleTag?.type || "",
  roleTagName: user.roleTag?.name || "",
  listingOrder: typeof user.roleTag?.listingOrder === "number" ? String(user.roleTag.listingOrder) : "",
  extraRoles: buildExtraRoleEdits(user),
});

const hasPendingEditState = (state: EditState | undefined, user: UserWithLeader) => {
  if (!state) return false;

  return (
    state.isLeader !== (user.isLeader || false) ||
    state.roleTagType !== (user.roleTag?.type || "") ||
    state.roleTagName !== (user.roleTag?.name || "") ||
    state.listingOrder.trim() !== (typeof user.roleTag?.listingOrder === "number" ? String(user.roleTag.listingOrder) : "") ||
    JSON.stringify(state.extraRoles) !== JSON.stringify(buildExtraRoleEdits(user))
  );
};

const RoleManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRole } = useAuth();

  const [users, setUsers] = useState<UserWithLeader[]>([]);
  const [loading, setLoading] = useState(true);   // initial full-screen load
  const [fetching, setFetching] = useState(false); // background refetch (search/filter)
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(userRole === 'state_admin' ? "all" : "member");
  const [saving, setSaving] = useState<string | null>(null);
  const [editStates, setEditStates] = useState<Record<string, EditState>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const isInitialLoad = loading && users.length === 0;

  const allowedRoleTypes = ALLOWED_ROLE_TYPES[userRole || "group_admin"] || ["area", "unit"];
  const isMemberView = roleFilter === "member";
  const isLeadersView = roleFilter === "leaders";

  // Leaders view state
  interface LeaderGroup {
    key: string;
    label: string;
    leaders: UserWithLeader[];
  }
  const [leaderGroups, setLeaderGroups] = useState<LeaderGroup[]>([]);
  const [leaderLevelFilter, setLeaderLevelFilter] = useState("all");
  const [leaderDistrictFilter, setLeaderDistrictFilter] = useState("all");
  const [districts, setDistricts] = useState<{ _id: string; name: string }[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);

  // Tracks whether the first successful fetch has completed
  const hasLoadedRef = useRef(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, roleFilter]);

  const fetchUsers = useCallback(async (isBackground = false) => {
    if (isBackground) {
      setFetching(true);
    } else {
      setLoading(true);
    }
    try {
      const params: Record<string, any> = { page: currentPage, limit: 20 };
      if (debouncedSearch) params.search = debouncedSearch;

      let result;
      if (isMemberView) {
        params.forLeaderAssignment = 'true';
        result = await membersAPI.getMembers(params);
      } else {
        // Area-level filters arrive as "group_admin:<kind>" — Murabi and Coordinator
        // admins share the group_admin role and differ only by adminKind.
        if (roleFilter !== "all") {
          const [filterRole, filterKind] = roleFilter.split(":");
          params.role = filterRole;
          if (filterKind) params.adminKind = filterKind;
        }
        result = await usersAPI.getUsers(params);
      }

      const data: UserWithLeader[] = result.data || [];
      setUsers(data);
      if (result.pagination) {
        setTotalPages(result.pagination.totalPages || 1);
        setTotalDocs(result.pagination.totalDocs || 0);
        setHasNextPage(result.pagination.hasNextPage || false);
        setHasPrevPage(result.pagination.hasPrevPage || false);
      }
      setEditStates((prev) => {
        const next = { ...prev };

        data.forEach((user) => {
          const key = rowKey(user);
          if (!hasPendingEditState(prev[key], user)) {
            next[key] = buildEditState(user);
          }
        });

        return next;
      });
      hasLoadedRef.current = true;
    } catch (error) {
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [currentPage, debouncedSearch, roleFilter, isMemberView, toast]);

  useEffect(() => {
    if (!isLeadersView) {
      fetchUsers(hasLoadedRef.current);
    }
  }, [fetchUsers, isLeadersView]);

  // Fetch districts for leaders view filter
  useEffect(() => {
    if (isLeadersView && districts.length === 0) {
      districtsAPI.getDistricts({ limit: 100 }).then((res: any) => {
        setDistricts(res.data || []);
      }).catch(() => {});
    }
  }, [isLeadersView]);

  // Fetch leaders when leaders view is active
  const fetchLeaders = useCallback(async () => {
    setLeadersLoading(true);
    try {
      const params: Record<string, string> = { limit: "500" };
      if (leaderLevelFilter !== "all") params.roleType = leaderLevelFilter;
      if (leaderDistrictFilter !== "all") params.districtId = leaderDistrictFilter;
      if (debouncedSearch) params.search = debouncedSearch;

      const result = await leadersAPI.getLeaders(params);
      const data: UserWithLeader[] = result.data || [];

      // Build edit states
      setEditStates((prev) => {
        const next = { ...prev };

        data.forEach((user) => {
          const key = rowKey(user);
          if (!hasPendingEditState(prev[key], user)) {
            next[key] = buildEditState(user);
          }
        });

        return next;
      });

      // Group leaders by scope
      const groups: Record<string, UserWithLeader[]> = {};
      data.forEach((leader: UserWithLeader) => {
        const type = leader.roleTag?.type || "other";
        let groupKey: string;
        let groupLabel: string;

        if (type === "state") {
          groupKey = "state";
          groupLabel = "State Leaders";
        } else if (type === "district") {
          const distName = leader.district?.name || "Unknown";
          groupKey = `district-${distName}`;
          groupLabel = `District Leaders — ${distName}`;
        } else if (type === "area") {
          const distName = leader.district?.name || "Unknown";
          groupKey = `area-${distName}`;
          groupLabel = `Area Leaders — ${distName}`;
        } else if (type === "unit") {
          const distName = leader.district?.name || "Unknown";
          groupKey = `unit-${distName}`;
          groupLabel = `Unit Leaders — ${distName}`;
        } else {
          groupKey = `${type}`;
          groupLabel = `${ROLE_TYPE_LABELS[type] || type} Leaders`;
        }

        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(leader);
      });

      // Sort groups: state first, then district, area, unit, others
      const typeOrder = ["state", "district", "area", "unit", "murabi", "coordinator", "other"];
      const sortedGroups: LeaderGroup[] = Object.entries(groups)
        .map(([key, leaders]) => ({
          key,
          label: key === "state" ? "State Leaders"
            : key.startsWith("district-") ? `District Leaders — ${key.replace("district-", "")}`
            : key.startsWith("area-") ? `Area Leaders — ${key.replace("area-", "")}`
            : key.startsWith("unit-") ? `Unit Leaders — ${key.replace("unit-", "")}`
            : `${key} Leaders`,
          leaders,
        }))
        .sort((a, b) => {
          const typeA = a.key.split("-")[0];
          const typeB = b.key.split("-")[0];
          const idxA = typeOrder.indexOf(typeA);
          const idxB = typeOrder.indexOf(typeB);
          if (idxA !== idxB) return idxA - idxB;
          return a.label.localeCompare(b.label);
        });

      setLeaderGroups(sortedGroups);
    } catch {
      toast({ title: "Error", description: "Failed to load leaders", variant: "destructive" });
    } finally {
      setLeadersLoading(false);
    }
  }, [leaderLevelFilter, leaderDistrictFilter, debouncedSearch, toast]);

  useEffect(() => {
    if (isLeadersView) {
      fetchLeaders();
    }
  }, [isLeadersView, fetchLeaders]);

  const toOrderValue = (raw: string): number | null => {
    const trimmed = raw.trim();
    return trimmed === "" ? null : Number(trimmed);
  };

  const handleSave = async (user: UserWithLeader) => {
    const key = rowKey(user);
    const state = editStates[key];
    if (!state) return;
    setSaving(key);
    try {
      const payload: any = { isLeader: state.isLeader };
      const slot = user.roleSlot || 0;
      if (slot > 0) {
        // Editing an extra-role row in the leaders directory: replace that slot,
        // keep the rest of the extras untouched.
        const extras = (user.extraRoleTags || []).map((r) => ({
          type: r.type,
          name: r.name,
          listingOrder: typeof r.listingOrder === "number" ? r.listingOrder : null,
        }));
        extras[slot - 1] = {
          type: state.roleTagType || undefined,
          name: state.roleTagName || undefined,
          listingOrder: toOrderValue(state.listingOrder),
        };
        payload.extraRoles = extras;
      } else if (state.isLeader) {
        if (state.roleTagType || state.roleTagName || state.listingOrder.trim() !== "") {
          payload.roleTag = {
            type: state.roleTagType || undefined,
            name: state.roleTagName || undefined,
            // Send null to explicitly clear, number when set, otherwise omit.
            listingOrder: toOrderValue(state.listingOrder),
          };
        }
        payload.extraRoles = state.extraRoles.map((r) => ({
          type: r.type || undefined,
          name: r.name || undefined,
          listingOrder: toOrderValue(r.listingOrder),
        }));
      }
      const isMemberRecord = isMemberView || user.role === "member";
      if (isMemberRecord) {
        await membersAPI.updateMemberLeader(user._id, payload);
      } else {
        await leadersAPI.updateLeader(user._id, payload);
      }
      toast({ title: "Saved", description: "Leader status updated successfully" });
      if (isLeadersView) {
        fetchLeaders();
      } else {
        fetchUsers(true);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" });
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

  const hasChanges = (user: UserWithLeader, state: EditState) => {
    const origIsLeader = user.isLeader || false;
    const origType = user.roleTag?.type || "";
    const origName = user.roleTag?.name || "";
    const origOrder =
      typeof user.roleTag?.listingOrder === "number" ? String(user.roleTag.listingOrder) : "";
    return (
      state.isLeader !== origIsLeader ||
      state.roleTagType !== origType ||
      state.roleTagName !== origName ||
      state.listingOrder.trim() !== origOrder ||
      JSON.stringify(state.extraRoles) !== JSON.stringify(buildExtraRoleEdits(user))
    );
  };

  // Area-level admins share role 'group_admin', so the badge needs adminKind to
  // tell an Area Admin from a Murabi or Coordinator Admin.
  const roleLabel = (role?: string, adminKind?: string | null) =>
    role ? getRoleLabel(role, adminKind) : "Member";

  const leaderDirectoryCount = leaderGroups.reduce((sum, group) => sum + group.leaders.length, 0);
  const currentViewLabel = isLeadersView
    ? "Leaders"
    : isMemberView
      ? "Members"
      : roleFilter === "all"
        ? "All Roles"
        : getRoleLabel(roleFilter.split(":")[0], roleFilter.split(":")[1]);
  const currentRecordCount = isLeadersView ? leaderDirectoryCount : (totalDocs || users.length);
  const leaderSummaryCount = isLeadersView ? leaderGroups.length : users.filter((user) => user.isLeader).length;

  return (
    <PageShell contentClassName="pb-28">
      <PageHero
        title="Role Management"
        subtitle="Assign leader roles, tune listing order, and manage leader visibility without changing the existing permissions flow."
        eyebrow="Administration"
        icon={<Shield className="h-6 w-6" />}
      />

      <div className="grid grid-cols-3 gap-1.5 sm:gap-3 [&_.metric-icon]:hidden [&_.metric-card>div]:!p-2.5 [&_.metric-card_.text-\[13px\]]:!text-[11px] [&_.metric-card_.text-\[13px\]]:!leading-tight [&_.metric-card_.font-bold]:!text-base sm:[&_.metric-icon]:flex sm:[&_.metric-card>div]:!p-5 sm:[&_.metric-card_.font-bold]:!text-[1.7rem]">
        <MetricCard title="Current View" value={currentViewLabel} icon={Filter} tone="primary" />
        <MetricCard title="Records" value={String(currentRecordCount)} icon={Users} tone="warning" />
        <MetricCard
          title={isLeadersView ? "Leader Groups" : "Visible Leaders"}
          value={String(leaderSummaryCount)}
          icon={Star}
          tone="success"
        />
      </div>

      <SectionCard
        title="Directory Filters"
        description="Search users, switch role scopes, and narrow the current management view."
      >
        <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label htmlFor="role-management-search" className="hidden shrink-0 text-sm font-medium text-foreground sm:block">
                Search Users
              </label>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="role-management-search"
                  placeholder="Search by name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[104px] shrink-0 sm:w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                {userRole === 'state_admin' && <SelectItem value="all">All Roles</SelectItem>}
                {userRole === 'state_admin' && <SelectItem value="state_admin">State Admins</SelectItem>}
                {['state_admin', 'district_admin'].includes(userRole || '') && <SelectItem value="district_admin">District Admins</SelectItem>}
                {['state_admin', 'district_admin'].includes(userRole || '') && <SelectItem value="group_admin:area">Area Admins</SelectItem>}
                {['state_admin', 'district_admin'].includes(userRole || '') && <SelectItem value="group_admin:murabi">Murabi Admins</SelectItem>}
                {['state_admin', 'district_admin'].includes(userRole || '') && <SelectItem value="group_admin:coordinator">Coordinator Admins</SelectItem>}
                <SelectItem value="member">Members</SelectItem>
                <SelectItem value="leaders">
                  <span className="flex items-center gap-1"><Star className="h-3 w-3" /> Leaders Only</span>
                </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Leaders sub-filters */}
            {isLeadersView && (
              <div className="grid grid-cols-2 gap-2">
                <Select value={leaderLevelFilter} onValueChange={setLeaderLevelFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                    <SelectItem value="district">District</SelectItem>
                    <SelectItem value="area">Area</SelectItem>
                    <SelectItem value="unit">Unit</SelectItem>
                    <SelectItem value="murabi">Murabi</SelectItem>
                    <SelectItem value="coordinator">Coordinator</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={leaderDistrictFilter} onValueChange={setLeaderDistrictFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="District" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Districts</SelectItem>
                    {districts.map((d) => (
                      <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
      </SectionCard>

      <SectionCard
        title={isLeadersView ? "Leader Directory" : "Role Assignments"}
        description={
          isLeadersView
            ? "Review grouped leaders by scope and update listing names or order without leaving the directory."
            : "Toggle leader access, set role tags, and save assignment changes for each record."
        }
        action={
          (fetching || leadersLoading) && !isInitialLoad ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-primary" />
              <span>Updating…</span>
            </div>
          ) : undefined
        }
      >
        {isLeadersView ? (
          leadersLoading && leaderGroups.length === 0 ? (
            <ListSkeleton rows={5} />
          ) : leaderGroups.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="p-8 text-center">
                <Star className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">No leaders found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {leaderGroups.map((group) => (
                <div key={group.key}>
                  <div className="mb-2 flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <h3 className="text-sm font-semibold">{group.label}</h3>
                    <Badge variant="outline" className="ml-auto text-xs">{group.leaders.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {group.leaders.map((leader) => {
                      const key = rowKey(leader);
                      const state = editStates[key];
                      if (!state) return null;
                      const changed = hasChanges(leader, state);
                      return (
                        <Card key={key} className={`shadow-sm ${leadersLoading ? "opacity-60" : ""}`}>
                          <CardContent className="space-y-2 p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium">{leader.name}</p>
                                <p className="text-xs text-muted-foreground">{leader.phone}</p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {leader.roleTag?.type && (
                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ROLE_TYPE_COLORS[leader.roleTag.type] || "bg-gray-100 text-gray-700"}`}>
                                      {ROLE_TYPE_LABELS[leader.roleTag.type] || leader.roleTag.type}
                                    </span>
                                  )}
                                  {leader.roleTag?.name && (
                                    <Badge variant="secondary" className="h-5 text-[10px]">{leader.roleTag.name}</Badge>
                                  )}
                                  {(leader.roleSlot || 0) > 0 && (
                                    <Badge variant="outline" className="h-5 text-[10px]">Role {(leader.roleSlot || 0) + 1}</Badge>
                                  )}
                                  {leader.district && (
                                    <Badge variant="outline" className="h-5 text-[10px]">{leader.district.name}</Badge>
                                  )}
                                  {leader.group && (
                                    <Badge variant="outline" className="h-5 text-[10px]">{leader.group.name}</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                {state.listingOrder ? (
                                  <span className="text-lg font-bold text-primary">#{state.listingOrder}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No order</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <Input
                                placeholder="Role name"
                                value={state.roleTagName}
                                onChange={(e) => updateEditState(key, { roleTagName: e.target.value })}
                                className="h-7 flex-1 text-xs"
                              />
                              <ListOrdered className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="Order"
                                value={state.listingOrder}
                                onChange={(e) =>
                                  updateEditState(key, {
                                    listingOrder: e.target.value.replace(/[^\d]/g, ""),
                                  })
                                }
                                className="h-7 w-20 text-xs"
                              />
                            </div>

                            {changed && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="h-7 flex-1 text-xs"
                                  onClick={() => handleSave(leader)}
                                  disabled={saving === key}
                                >
                                  {saving === key ? (
                                    <div className="mr-1 h-3 w-3 animate-spin rounded-full border-b-2 border-white" />
                                  ) : (
                                    <Save className="mr-1 h-3 w-3" />
                                  )}
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7"
                                  aria-label={`Discard changes for ${leader.name}`}
                                  onClick={() => updateEditState(key, buildEditState(leader))}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="py-2 text-center text-xs text-muted-foreground">
                Same listing order number can be used across different districts or areas because ordering is per scope.
              </p>
            </div>
          )
        ) : (
          <>
            {isInitialLoad ? (
              <ListSkeleton rows={5} />
            ) : users.length === 0 && !fetching ? (
              <Card className="shadow-sm">
                <CardContent className="p-8 text-center">
                  <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">No users found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {users.map((user) => {
                  const state = editStates[user._id];
                  if (!state) return null;
                  const changed = hasChanges(user, state);
                  const isExpanded = !!expandedCards[user._id];
                  const toggleExpanded = () =>
                    setExpandedCards((prev) => ({ ...prev, [user._id]: !prev[user._id] }));
                  return (
                    <Card key={user._id} className={`shadow-sm transition-opacity duration-200 ${fetching ? "opacity-60" : "opacity-100"}`}>
                      <CardContent className="space-y-2 p-3 sm:space-y-3 sm:p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className={`min-w-0 flex-1 ${state.isLeader ? "cursor-pointer" : ""}`}
                            onClick={state.isLeader ? toggleExpanded : undefined}
                          >
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <p className="truncate font-semibold">{user.name}</p>
                              <p className="text-sm text-muted-foreground">{user.phone}</p>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1 sm:gap-2">
                              {isMemberView ? (
                                <Badge variant="outline" className="px-1.5 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-xs">
                                  {user.status || "Member"}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="px-1.5 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-xs">
                                  {roleLabel(user.role, user.adminKind)}
                                </Badge>
                              )}
                              {user.district && (
                                <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-xs">
                                  {user.district.name}
                                </Badge>
                              )}
                              {user.group && (
                                <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-xs">
                                  {user.group.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <Label htmlFor={`leader-${user._id}`} className="text-xs font-medium text-muted-foreground">
                                Leader
                              </Label>
                              <Switch
                                id={`leader-${user._id}`}
                                checked={state.isLeader}
                                onCheckedChange={(checked) =>
                                  updateEditState(user._id, {
                                    isLeader: checked,
                                    roleTagType: checked ? state.roleTagType : "",
                                    roleTagName: checked ? state.roleTagName : "",
                                    listingOrder: checked ? state.listingOrder : "",
                                    extraRoles: checked ? state.extraRoles : [],
                                  })
                                }
                              />
                              {state.isLeader && (
                                <button
                                  type="button"
                                  aria-label={isExpanded ? `Collapse leader role details for ${user.name}` : `Expand leader role details for ${user.name}`}
                                  onClick={toggleExpanded}
                                  className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                                >
                                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                </button>
                              )}
                            </div>
                            {user.isLeader && user.roleTag?.type && (
                              <>
                                <span className={`rounded-full px-2 py-1 text-xs font-medium ${ROLE_TYPE_COLORS[user.roleTag.type]}`}>
                                  {ROLE_TYPE_LABELS[user.roleTag.type]}
                                  {user.roleTag.name ? ` · ${user.roleTag.name}` : ""}
                                </span>
                                {(user.extraRoleTags || []).map((extra, i) =>
                                  extra?.type ? (
                                    <span key={i} className={`rounded-full px-2 py-1 text-xs font-medium ${ROLE_TYPE_COLORS[extra.type] || "bg-gray-100 text-gray-700"}`}>
                                      {ROLE_TYPE_LABELS[extra.type] || extra.type}
                                      {extra.name ? ` · ${extra.name}` : ""}
                                    </span>
                                  ) : null
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {state.isLeader && isExpanded && (
                          <div className="ml-1 space-y-2 border-l-2 border-primary/20 pl-1">
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              <Select
                                value={state.roleTagType}
                                onValueChange={(val) => updateEditState(user._id, { roleTagType: val })}
                              >
                                <SelectTrigger className="h-8 text-sm" aria-label={`Leader role type for ${user.name}`}>
                                  <SelectValue placeholder="Role type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allowedRoleTypes.map((rt) => (
                                    <SelectItem key={rt} value={rt}>
                                      {ROLE_TYPE_LABELS[rt]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Input
                              placeholder="Role name (e.g. Secretary, President...)"
                              value={state.roleTagName}
                              onChange={(e) => updateEditState(user._id, { roleTagName: e.target.value })}
                              className="h-8 text-sm"
                            />
                            <div className="flex items-center gap-2">
                              <ListOrdered className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="Listing order (e.g. 1, 2, 3...)"
                                aria-label={`Leader listing order for ${user.name}`}
                                value={state.listingOrder}
                                onChange={(e) =>
                                  updateEditState(user._id, {
                                    listingOrder: e.target.value.replace(/[^\d]/g, ""),
                                  })
                                }
                                className="h-8 text-sm"
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Leaders are shown in ascending listing order across every dashboard. Leave blank to appear last.
                            </p>

                            {state.extraRoles.map((extra, i) => (
                              <div key={i} className="space-y-2 rounded-md border border-dashed border-primary/30 p-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-medium text-muted-foreground">Additional role {i + 1}</p>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-destructive"
                                    aria-label={`Remove additional role ${i + 1} for ${user.name}`}
                                    onClick={() =>
                                      updateEditState(user._id, {
                                        extraRoles: state.extraRoles.filter((_, idx) => idx !== i),
                                      })
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                <Select
                                  value={extra.type}
                                  onValueChange={(val) =>
                                    updateEditState(user._id, {
                                      extraRoles: state.extraRoles.map((r, idx) => (idx === i ? { ...r, type: val } : r)),
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-8 text-sm" aria-label={`Additional role type ${i + 1} for ${user.name}`}>
                                    <SelectValue placeholder="Role type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allowedRoleTypes.map((rt) => (
                                      <SelectItem key={rt} value={rt}>
                                        {ROLE_TYPE_LABELS[rt]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  placeholder="Role name (e.g. Secretary, President...)"
                                  value={extra.name}
                                  onChange={(e) =>
                                    updateEditState(user._id, {
                                      extraRoles: state.extraRoles.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)),
                                    })
                                  }
                                  className="h-8 text-sm"
                                />
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="Listing order"
                                  value={extra.listingOrder}
                                  onChange={(e) =>
                                    updateEditState(user._id, {
                                      extraRoles: state.extraRoles.map((r, idx) =>
                                        idx === i ? { ...r, listingOrder: e.target.value.replace(/[^\d]/g, "") } : r
                                      ),
                                    })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                            ))}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-full text-xs"
                              onClick={() =>
                                updateEditState(user._id, {
                                  extraRoles: [...state.extraRoles, { type: "", name: "", listingOrder: "" }],
                                })
                              }
                            >
                              <Plus className="mr-1 h-3.5 w-3.5" /> Add another role
                            </Button>
                          </div>
                        )}

                        {changed && (
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => handleSave(user)}
                              disabled={saving === user._id}
                            >
                              {saving === user._id ? (
                                <div className="mr-1 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                              ) : (
                                <Save className="mr-1 h-4 w-4" />
                              )}
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Discard changes for ${user.name}`}
                              onClick={() => updateEditState(user._id, buildEditState(user))}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && !isLeadersView && (
              <div className="flex items-center justify-between gap-2 py-2">
                <p className="truncate text-xs text-muted-foreground sm:text-sm">
                  Page {currentPage}/{totalPages} · {totalDocs} users
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs sm:px-3 sm:text-sm"
                    onClick={() => setCurrentPage((p) => p - 1)}
                    disabled={!hasPrevPage || loading || fetching}
                  >
                    <ChevronLeft className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs sm:px-3 sm:text-sm"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={!hasNextPage || loading || fetching}
                  >
                    <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4 sm:ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>    </PageShell>
  );
};

export default RoleManagement;
