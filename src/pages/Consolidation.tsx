import { useState, useEffect } from "react";
import {
  BarChart3, ArrowLeft, Filter, Users, Download, CheckCircle, Clock, AlertCircle, Target
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { apiCall } from "@/utils/api";

interface District { _id: string; name: string; code: string; }
interface Group { _id: string; name: string; code: string; }
interface PersonalTarget { _id: string; title: string; category: string; targetAudience: string; }

interface UserResult {
  _id: string;
  name: string;
  role: string;
  roleTag?: { type: string; name?: string };
  district?: { _id: string; name: string };
  group?: { _id: string; name: string };
  phone?: string;
  progress: {
    status: "not_started" | "in_progress" | "completed";
    completedAt?: string;
    feedback?: string;
  } | null;
}

const ROLE_LABELS: Record<string, string> = {
  district_admin: "District Admin",
  area_admin: "Area Admin",
  unit_admin: "Unit Admin",
  group_admin: "Group Admin",
  all: "All Roles",
};

const STATUS_CONFIG = {
  not_started: { label: "Not Started", icon: AlertCircle, cls: "bg-gray-100 text-gray-700" },
  in_progress: { label: "In Progress", icon: Clock, cls: "bg-blue-100 text-blue-700" },
  completed: { label: "Completed", icon: CheckCircle, cls: "bg-green-100 text-green-700" },
};

const getRoleLabel = (role: string, roleTagType?: string) => {
  if (role === "district_admin") return "District Admin";
  if (role === "group_admin" && roleTagType === "area") return "Area Admin";
  if (role === "group_admin" && roleTagType === "unit") return "Unit Admin";
  if (role === "group_admin") return "Group Admin";
  return role;
};

const Consolidation = () => {
  const navigate = useNavigate();

  // Dropdown data
  const [districts, setDistricts] = useState<District[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [personalTargets, setPersonalTargets] = useState<PersonalTarget[]>([]);

  // Filters
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [consolidationType, setConsolidationType] = useState("general");
  const [selectedTarget, setSelectedTarget] = useState("all");
  const [targetStatus, setTargetStatus] = useState("all");

  // Results
  const [results, setResults] = useState<UserResult[]>([]);
  const [meta, setMeta] = useState<{ count: number; target?: PersonalTarget } | null>(null);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);

  // Load districts on mount
  useEffect(() => {
    apiCall("/districts?limit=100").then(r => setDistricts(r.data || [])).catch(() => {});
  }, []);

  // Load groups when district changes
  useEffect(() => {
    setSelectedGroup("all");
    setGroups([]);
    if (selectedDistrict !== "all") {
      apiCall(`/groups?district=${selectedDistrict}&limit=200`)
        .then(r => setGroups(r.data || []))
        .catch(() => {});
    }
  }, [selectedDistrict]);

  // Load personal targets when type = personal_target
  useEffect(() => {
    setSelectedTarget("all");
    if (consolidationType === "personal_target") {
      apiCall("/personal-targets?limit=100")
        .then(r => setPersonalTargets(r.data || []))
        .catch(() => {});
    }
  }, [consolidationType]);

  const applyFilters = async () => {
    try {
      setLoading(true);
      setApplied(true);
      const qp = new URLSearchParams();
      if (selectedDistrict !== "all") qp.set("districtId", selectedDistrict);
      if (selectedGroup !== "all") qp.set("groupId", selectedGroup);
      if (roleFilter !== "all") qp.set("roleFilter", roleFilter);
      if (consolidationType !== "general") qp.set("consolidationType", consolidationType);
      if (consolidationType === "personal_target" && selectedTarget !== "all") {
        qp.set("targetId", selectedTarget);
      }
      if (consolidationType === "personal_target" && targetStatus !== "all") {
        qp.set("targetStatus", targetStatus);
      }

      const result = await apiCall(`/reports/consolidation?${qp.toString()}`);
      setResults(result.data || []);
      setMeta(result.meta || null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load consolidation data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (results.length === 0) return;
    const headers = ["Name", "Phone", "Role", "District", "Group"];
    if (consolidationType === "personal_target") headers.push("Target Status", "Completed At");
    const rows = results.map(u => {
      const row = [
        u.name,
        u.phone || "",
        getRoleLabel(u.role, u.roleTag?.type),
        u.district?.name || "",
        u.group?.name || "",
      ];
      if (consolidationType === "personal_target") {
        row.push(u.progress?.status || "not_started");
        row.push(u.progress?.completedAt ? new Date(u.progress.completedAt).toLocaleDateString() : "");
      }
      return row;
    });
    const csv = [headers, ...rows].map(r => r.map(f => `"${f}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consolidation-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedTargetObj = personalTargets.find(t => t._id === selectedTarget);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/state-admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Consolidation Report</h1>
            <p className="text-sm text-muted-foreground">Filter and list users by any criteria</p>
          </div>
          {results.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="px-4 pt-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Filters</span>
            </div>

            <div className="space-y-3">
              {/* District */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">District</label>
                <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Districts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Districts</SelectItem>
                    {districts.map(d => (
                      <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Group (Area/Unit) — shown when a district is selected */}
              {selectedDistrict !== "all" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Area / Unit Group</label>
                  <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Groups" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Groups</SelectItem>
                      {groups.map(g => (
                        <SelectItem key={g._id} value={g._id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Role */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Admin Role</label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="district_admin">District Admin</SelectItem>
                    <SelectItem value="area_admin">Area Admin</SelectItem>
                    <SelectItem value="unit_admin">Unit Admin</SelectItem>
                    <SelectItem value="group_admin">Group Admin (All)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Consolidation Type */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Consolidation Type</label>
                <Select value={consolidationType} onValueChange={setConsolidationType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General (All Users)</SelectItem>
                    <SelectItem value="personal_target">Personal Target</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Personal Target options */}
              {consolidationType === "personal_target" && (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Select Target</label>
                    <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Targets" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Targets</SelectItem>
                        {personalTargets.map(t => (
                          <SelectItem key={t._id} value={t._id}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Target Status</label>
                    <Select value={targetStatus} onValueChange={setTargetStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <Button
                className="w-full mt-1"
                onClick={applyFilters}
                disabled={loading}
              >
                {loading ? "Loading..." : "Apply Filters"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      <div className="px-4 pt-4">
        {!applied ? (
          <Card className="p-8 text-center shadow-sm">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-semibold">Apply filters to see results</p>
            <p className="text-sm text-muted-foreground mt-1">Select your filters above and click Apply.</p>
          </Card>
        ) : loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : results.length === 0 ? (
          <Card className="p-8 text-center shadow-sm">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-semibold">No users found</p>
            <p className="text-sm text-muted-foreground mt-1">No users match the selected filters.</p>
          </Card>
        ) : (
          <>
            {/* Result summary */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">{results.length} user{results.length !== 1 ? "s" : ""} found</span>
              </div>
              {meta?.target && (
                <div className="flex items-center gap-1">
                  <Target className="h-3 w-3 text-primary" />
                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">{meta.target.title}</span>
                </div>
              )}
            </div>

            {/* User list */}
            <div className="space-y-2">
              {results.map((user, idx) => {
                const roleLbl = getRoleLabel(user.role, user.roleTag?.type);
                const progressStatus = user.progress?.status;
                const cfg = progressStatus ? STATUS_CONFIG[progressStatus] : null;
                const StatusIcon = cfg?.icon;

                return (
                  <Card key={user._id} className="shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{user.name}</p>
                            <Badge variant="outline" className="text-xs shrink-0">{roleLbl}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {user.district?.name || "—"}
                            {user.group && <span> · {user.group.name}</span>}
                          </p>
                          {user.phone && (
                            <p className="text-xs text-muted-foreground">{user.phone}</p>
                          )}
                        </div>

                        {consolidationType === "personal_target" && cfg && StatusIcon && (
                          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shrink-0 ${cfg.cls}`}>
                            <StatusIcon className="h-3 w-3" />
                            {cfg.label}
                          </div>
                        )}
                        {consolidationType === "personal_target" && !user.progress && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shrink-0 bg-gray-100 text-gray-600">
                            <AlertCircle className="h-3 w-3" />
                            Not Started
                          </div>
                        )}

                        {consolidationType === "general" && (
                          <span className="text-xs text-muted-foreground shrink-0">#{idx + 1}</span>
                        )}
                      </div>

                      {user.progress?.completedAt && (
                        <p className="text-xs text-green-600 mt-1">
                          Completed: {new Date(user.progress.completedAt).toLocaleDateString("en-IN")}
                        </p>
                      )}
                      {user.progress?.feedback && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{user.progress.feedback}"</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Consolidation;
