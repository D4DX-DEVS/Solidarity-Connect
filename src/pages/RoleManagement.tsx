import { useState, useEffect, useCallback, useRef } from "react";
import { Shield, Search, ChevronLeft, ChevronRight, Users, Tag, Save, X, ListOrdered, Star, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usersAPI, leadersAPI, membersAPI, districtsAPI } from "@/utils/api";

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

interface UserWithLeader {
  _id: string;
  name: string;
  phone: string;
  role?: string;
  status?: string; // for members
  isLeader: boolean;
  roleTag?: { type?: string; name?: string; listingOrder?: number | null };
  district?: { name: string };
  group?: { name: string };
}

interface EditState {
  isLeader: boolean;
  roleTagType: string;
  roleTagName: string;
  listingOrder: string; // kept as string for a controlled input; empty means "no order"
}

const RoleManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRole } = useAuth();

  const [users, setUsers] = useState<UserWithLeader[]>([]);
  const [loading, setLoading] = useState(true);   // initial full-screen load
  const [fetching, setFetching] = useState(false); // background refetch (search/filter)
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [saving, setSaving] = useState<string | null>(null);
  const [editStates, setEditStates] = useState<Record<string, EditState>>({});
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
        result = await membersAPI.getMembers(params);
      } else {
        if (roleFilter !== "all") params.role = roleFilter;
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
      const states: Record<string, EditState> = {};
      data.forEach((u) => {
        states[u._id] = {
          isLeader: u.isLeader || false,
          roleTagType: u.roleTag?.type || "",
          roleTagName: u.roleTag?.name || "",
          listingOrder:
            typeof u.roleTag?.listingOrder === "number" ? String(u.roleTag.listingOrder) : "",
        };
      });
      setEditStates((prev) => ({ ...prev, ...states }));
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
      const states: Record<string, EditState> = {};
      data.forEach((u: UserWithLeader) => {
        states[u._id] = {
          isLeader: u.isLeader || false,
          roleTagType: u.roleTag?.type || "",
          roleTagName: u.roleTag?.name || "",
          listingOrder: typeof u.roleTag?.listingOrder === "number" ? String(u.roleTag.listingOrder) : "",
        };
      });
      setEditStates((prev) => ({ ...prev, ...states }));

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

  const handleSave = async (userId: string) => {
    const state = editStates[userId];
    if (!state) return;
    setSaving(userId);
    try {
      const payload: any = { isLeader: state.isLeader };
      const trimmedOrder = state.listingOrder.trim();
      const hasOrder = trimmedOrder !== "";
      if (state.isLeader && (state.roleTagType || state.roleTagName || hasOrder)) {
        payload.roleTag = {
          type: state.roleTagType || undefined,
          name: state.roleTagName || undefined,
          // Send null to explicitly clear, number when set, otherwise omit.
          listingOrder: hasOrder ? Number(trimmedOrder) : null,
        };
      }
      if (isMemberView) {
        await membersAPI.updateMemberLeader(userId, payload);
      } else {
        await leadersAPI.updateLeader(userId, payload);
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
      state.listingOrder.trim() !== origOrder
    );
  };

  const roleLabel = (role?: string) => {
    const map: Record<string, string> = {
      state_admin: "State Admin",
      district_admin: "District Admin",
      group_admin: "Group Admin",
    };
    return role ? (map[role] || role) : "Member";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="bg-primary p-2 rounded-lg">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Role Management</h1>
            <p className="text-sm text-muted-foreground">Assign leader roles to admin users</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Filters */}
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="state_admin">State Admins</SelectItem>
                <SelectItem value="district_admin">District Admins</SelectItem>
                <SelectItem value="group_admin">Group Admins</SelectItem>
                <SelectItem value="member">Members</SelectItem>
                <SelectItem value="leaders">
                  <span className="flex items-center gap-1"><Star className="h-3 w-3" /> Leaders Only</span>
                </SelectItem>
              </SelectContent>
            </Select>

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
          </CardContent>
        </Card>

        {/* Background fetch indicator */}
        {(fetching || leadersLoading) && !isInitialLoad && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary" />
            <span>Updating…</span>
          </div>
        )}

        {/* ══════════ LEADERS GROUPED VIEW ══════════ */}
        {isLeadersView ? (
          leadersLoading && leaderGroups.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : leaderGroups.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="p-8 text-center">
                <Star className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No leaders found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {leaderGroups.map((group) => (
                <div key={group.key}>
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <h3 className="font-semibold text-sm">{group.label}</h3>
                    <Badge variant="outline" className="text-xs ml-auto">{group.leaders.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {group.leaders.map((leader) => {
                      const state = editStates[leader._id];
                      if (!state) return null;
                      const changed = hasChanges(leader, state);
                      return (
                        <Card key={leader._id} className={`shadow-sm ${leadersLoading ? "opacity-60" : ""}`}>
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{leader.name}</p>
                                <p className="text-xs text-muted-foreground">{leader.phone}</p>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {leader.roleTag?.type && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_TYPE_COLORS[leader.roleTag.type] || "bg-gray-100 text-gray-700"}`}>
                                      {ROLE_TYPE_LABELS[leader.roleTag.type] || leader.roleTag.type}
                                    </span>
                                  )}
                                  {leader.roleTag?.name && (
                                    <Badge variant="secondary" className="text-[10px] h-5">{leader.roleTag.name}</Badge>
                                  )}
                                  {leader.district && (
                                    <Badge variant="outline" className="text-[10px] h-5">{leader.district.name}</Badge>
                                  )}
                                  {leader.group && (
                                    <Badge variant="outline" className="text-[10px] h-5">{leader.group.name}</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {state.listingOrder ? (
                                  <span className="text-lg font-bold text-primary">#{state.listingOrder}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No order</span>
                                )}
                              </div>
                            </div>

                            {/* Editable fields */}
                            <div className="flex items-center gap-2">
                              <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <Input
                                placeholder="Role name"
                                value={state.roleTagName}
                                onChange={(e) => updateEditState(leader._id, { roleTagName: e.target.value })}
                                className="h-7 text-xs flex-1"
                              />
                              <ListOrdered className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <Input
                                type="number"
                                min={0}
                                inputMode="numeric"
                                placeholder="Order"
                                value={state.listingOrder}
                                onChange={(e) =>
                                  updateEditState(leader._id, {
                                    listingOrder: e.target.value.replace(/[^\d]/g, ""),
                                  })
                                }
                                className="h-7 text-xs w-20"
                              />
                            </div>

                            {changed && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="flex-1 h-7 text-xs"
                                  onClick={() => handleSave(leader._id)}
                                  disabled={saving === leader._id}
                                >
                                  {saving === leader._id ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                                  ) : (
                                    <Save className="h-3 w-3 mr-1" />
                                  )}
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7"
                                  onClick={() =>
                                    updateEditState(leader._id, {
                                      isLeader: leader.isLeader || false,
                                      roleTagType: leader.roleTag?.type || "",
                                      roleTagName: leader.roleTag?.name || "",
                                      listingOrder:
                                        typeof leader.roleTag?.listingOrder === "number"
                                          ? String(leader.roleTag.listingOrder)
                                          : "",
                                    })
                                  }
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
              <p className="text-xs text-muted-foreground text-center py-2">
                Same listing order number can be used across different districts/areas — ordering is per scope.
              </p>
            </div>
          )
        ) : (
        /* ══════════ REGULAR USERS LIST ══════════ */
        <>
        {/* Users list */}
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : users.length === 0 && !fetching ? (
          <Card className="shadow-sm">
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No users found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const state = editStates[user._id];
              if (!state) return null;
              const changed = hasChanges(user, state);
              return (
                <Card key={user._id} className={`shadow-sm transition-opacity duration-200 ${fetching ? "opacity-60" : "opacity-100"}`}>
                  <CardContent className="p-4 space-y-3">
                    {/* User info row */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.phone}</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {isMemberView ? (
                            <Badge variant="outline" className="text-xs">
                              {user.status || "Member"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {roleLabel(user.role)}
                            </Badge>
                          )}
                          {user.district && (
                            <Badge variant="secondary" className="text-xs">
                              {user.district.name}
                            </Badge>
                          )}
                          {user.group && (
                            <Badge variant="secondary" className="text-xs">
                              {user.group.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {user.isLeader && user.roleTag?.type && (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_TYPE_COLORS[user.roleTag.type]}`}>
                          {ROLE_TYPE_LABELS[user.roleTag.type]}
                          {user.roleTag.name ? ` · ${user.roleTag.name}` : ""}
                        </span>
                      )}
                    </div>

                    {/* Is Leader toggle */}
                    <div className="flex items-center gap-3">
                      <Switch
                        id={`leader-${user._id}`}
                        checked={state.isLeader}
                        onCheckedChange={(checked) =>
                          updateEditState(user._id, {
                            isLeader: checked,
                            roleTagType: checked ? state.roleTagType : "",
                            roleTagName: checked ? state.roleTagName : "",
                            listingOrder: checked ? state.listingOrder : "",
                          })
                        }
                      />
                      <Label htmlFor={`leader-${user._id}`} className="text-sm font-medium">
                        Is Leader
                      </Label>
                    </div>

                    {/* Role tag fields (only when isLeader=true) */}
                    {state.isLeader && (
                      <div className="space-y-2 pl-1 border-l-2 border-primary/20 ml-1">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Select
                            value={state.roleTagType}
                            onValueChange={(val) => updateEditState(user._id, { roleTagType: val })}
                          >
                            <SelectTrigger className="h-8 text-sm">
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
                          placeholder="Role name (e.g. Secretary, President…)"
                          value={state.roleTagName}
                          onChange={(e) => updateEditState(user._id, { roleTagName: e.target.value })}
                          className="h-8 text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <ListOrdered className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            placeholder="Listing order (e.g. 1, 2, 3…)"
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
                      </div>
                    )}

                    {/* Save / discard */}
                    {changed && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handleSave(user._id)}
                          disabled={saving === user._id}
                        >
                          {saving === user._id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1" />
                          ) : (
                            <Save className="h-4 w-4 mr-1" />
                          )}
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateEditState(user._id, {
                              isLeader: user.isLeader || false,
                              roleTagType: user.roleTag?.type || "",
                              roleTagName: user.roleTag?.name || "",
                              listingOrder:
                                typeof user.roleTag?.listingOrder === "number"
                                  ? String(user.roleTag.listingOrder)
                                  : "",
                            })
                          }
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

        {/* Pagination */}
        {totalPages > 1 && !isLeadersView && (
          <div className="flex items-center justify-between py-2">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} ({totalDocs} users)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={!hasPrevPage || loading || fetching}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!hasNextPage || loading || fetching}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
        </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default RoleManagement;
