import { useState, useEffect, useCallback, useRef } from "react";
import { Shield, Search, ChevronLeft, ChevronRight, Users, Tag, Save, X } from "lucide-react";
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
import { usersAPI, leadersAPI } from "@/utils/api";

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
  role: string;
  isLeader: boolean;
  roleTag?: { type?: string; name?: string };
  district?: { name: string };
  group?: { name: string };
}

interface EditState {
  isLeader: boolean;
  roleTagType: string;
  roleTagName: string;
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
    // On first ever load show the full spinner; for search/filter/page changes keep the
    // existing list visible and only show a subtle indicator.
    if (isBackground) {
      setFetching(true);
    } else {
      setLoading(true);
    }
    try {
      const params: Record<string, any> = { page: currentPage, limit: 20 };
      if (roleFilter !== "all") params.role = roleFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const result = await usersAPI.getUsers(params);
      const data: UserWithLeader[] = result.data || [];
      setUsers(data);
      if (result.pagination) {
        setTotalPages(result.pagination.totalPages || 1);
        setTotalDocs(result.pagination.totalDocs || 0);
        setHasNextPage(result.pagination.hasNextPage || false);
        setHasPrevPage(result.pagination.hasPrevPage || false);
      }
      // Initialize edit states (merge so unsaved edits on other pages aren't lost)
      const states: Record<string, EditState> = {};
      data.forEach((u) => {
        states[u._id] = {
          isLeader: u.isLeader || false,
          roleTagType: u.roleTag?.type || "",
          roleTagName: u.roleTag?.name || "",
        };
      });
      setEditStates((prev) => ({ ...prev, ...states }));
      hasLoadedRef.current = true;
    } catch (error) {
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [currentPage, debouncedSearch, roleFilter, toast]);

  useEffect(() => {
    fetchUsers(hasLoadedRef.current);
  }, [fetchUsers]);

  const handleSave = async (userId: string) => {
    const state = editStates[userId];
    if (!state) return;
    setSaving(userId);
    try {
      const payload: any = { isLeader: state.isLeader };
      if (state.isLeader && (state.roleTagType || state.roleTagName)) {
        payload.roleTag = {
          type: state.roleTagType || undefined,
          name: state.roleTagName || undefined,
        };
      }
      await leadersAPI.updateLeader(userId, payload);
      toast({ title: "Saved", description: "Leader status updated successfully" });
      fetchUsers(true);
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
    return (
      state.isLeader !== origIsLeader ||
      state.roleTagType !== origType ||
      state.roleTagName !== origName
    );
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      state_admin: "State Admin",
      district_admin: "District Admin",
      group_admin: "Group Admin",
    };
    return map[role] || role;
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
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Background fetch indicator */}
        {fetching && !isInitialLoad && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary" />
            <span>Updating…</span>
          </div>
        )}

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
                          <Badge variant="outline" className="text-xs">
                            {roleLabel(user.role)}
                          </Badge>
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
        {totalPages > 1 && (
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
      </main>

      <BottomNav />
    </div>
  );
};

export default RoleManagement;
