import { useState, useEffect, useCallback } from "react";
import {
  BarChart3, ArrowLeft, Filter, Users, Download, CheckCircle, Clock,
  AlertCircle, Target, RefreshCw, TrendingUp,
  Building2, MapPin, UserCheck, UserX, Globe2, Crown, Shield, X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { apiCall } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
import { getHomeRouteByRole } from "@/lib/roleRoutes";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────
interface TargetStat {
  _id: string; title: string; category: string; recurringFrequency: string;
  startDate: string; endDate: string; targetAudience: string;
  stats: {
    total: number; completed: number; in_progress: number; not_started: number;
    completionRate: number;
    byDistrict: { _id?: string; name: string; completed: number; not_completed: number }[];
    byGroup:    { _id?: string; name: string; completed: number; not_completed: number }[];
  };
}
interface DashboardStats {
  members:   { total: number; active: number; inactive: number; abroad: number; approved: number; pending: number };
  districts: { total: number; active: number };
  groups:    { total: number };
}
interface OrgStats {
  users: { total: number; district_admin: number; area_admin: number; unit_admin: number; group_admin: number; leaders: number; other: number };
  targets: { active: number; total: number; completedSubmissions: number; inProgressSubmissions: number };
  totalGroups: number;
}
interface District { _id: string; name: string; code: string }
interface Group    { _id: string; name: string; code: string }
interface UserResult {
  _id: string; name: string; role: string;
  roleTag?: { type: string; name?: string };
  district?: { _id: string; name: string };
  group?:    { _id: string; name: string };
  phone?: string;
  progress: { status: "not_started" | "in_progress" | "completed"; completedAt?: string; feedback?: string } | null;
}
interface SimpleTarget { _id: string; title: string; isRecurring?: boolean }
interface DrillState {
  targetId: string; targetTitle: string;
  filterType: "district" | "group";
  id?: string; name: string;
  clickedStatus: "completed" | "not_completed";
}

// ── Constants ──────────────────────────────────────────────────────────────────
const CATEGORY_EMOJI: Record<string,string> = {
  quran:"📖", hadith:"📜", prayer:"🕌", charity:"💝", knowledge:"🎓", community:"🤝", other:"🎯",
};
const FREQ_LABEL: Record<string,string> = { weekly:"Weekly", monthly:"Monthly", quarterly:"Quarterly" };
const STATUS_CONFIG = {
  not_started: { label:"Not Started", icon:AlertCircle, cls:"bg-gray-100 text-gray-700" },
  in_progress:  { label:"In Progress",  icon:Clock,         cls:"bg-blue-100 text-blue-700"  },
  completed:    { label:"Completed",     icon:CheckCircle,   cls:"bg-green-100 text-green-700" },
};
const PIE_COLORS        = ["#22c55e","#f87171","#f59e0b","#94a3b8"];
const MEMBER_PIE_COLORS = ["#22c55e","#f87171","#3b82f6","#a78bfa"];
const BAR_COLORS = { completed:"#22c55e", not_completed:"#f87171" };

const getRoleLabel = (role: string, tagType?: string) => {
  if (role === "district_admin") return "District Admin";
  if (role === "group_admin" && tagType === "area") return "Area Admin";
  if (role === "group_admin" && tagType === "unit") return "Unit Admin";
  if (role === "group_admin") return "Group Admin";
  return role;
};

// ── Stat Card ──────────────────────────────────────────────────────────────────
const StatCard = ({
  label, value, sub, icon: Icon, color = "text-primary", bg = "bg-primary/10"
}: { label:string; value:string|number; sub?:string; icon:React.ElementType; color?:string; bg?:string }) => (
  <Card className="shadow-sm">
    <CardContent className="p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className={`p-1.5 rounded-md ${bg}`}><Icon className={`h-3.5 w-3.5 ${color}`} /></div>
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      </div>
      <p className={`text-2xl font-bold leading-none ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </CardContent>
  </Card>
);

// ── Shared User Result List ────────────────────────────────────────────────────
const UserResultList = ({
  results, loading, applied, onExport, title,
}: {
  results: UserResult[]; loading: boolean; applied: boolean;
  onExport?: () => void; title?: string;
}) => {
  if (!applied) return (
    <p className="text-xs text-muted-foreground text-center py-3">Apply filters to see the list.</p>
  );
  if (loading) return <div className="text-center py-4 text-muted-foreground text-sm">Loading…</div>;
  if (results.length === 0) return (
    <Card className="p-6 text-center shadow-sm">
      <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm font-medium">No users found</p>
    </Card>
  );
  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">{title ?? `${results.length} user${results.length !== 1 ? "s" : ""}`}</span>
        {onExport && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={onExport}>
            <Download className="h-3 w-3 mr-1" />CSV
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {results.map((user, idx) => {
          const roleLbl    = getRoleLabel(user.role, user.roleTag?.type);
          const pStatus    = user.progress?.status;
          const cfg        = pStatus ? STATUS_CONFIG[pStatus] : null;
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
                    {user.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
                  </div>
                  {cfg && StatusIcon ? (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shrink-0 ${cfg.cls}`}>
                      <StatusIcon className="h-3 w-3" />{cfg.label}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shrink-0 bg-gray-100 text-gray-600">
                      <AlertCircle className="h-3 w-3" />Not Started
                    </div>
                  )}
                  {!user.progress && <span className="text-xs text-muted-foreground shrink-0">#{idx + 1}</span>}
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
  );
};

// ── Recurring Target Card ──────────────────────────────────────────────────────
interface TargetCardProps {
  target: TargetStat;
  onBarClick: (targetId: string, filterType: "district" | "group", id: string | undefined, name: string, status: "completed" | "not_completed") => void;
}
const TargetCard = ({ target, onBarClick }: TargetCardProps) => {
  const { stats } = target;
  const emoji     = CATEGORY_EMOJI[target.category] || "🎯";
  const freqLabel = FREQ_LABEL[target.recurringFrequency] || target.recurringFrequency;
  const pieData   = [
    { name: "Completed",     value: stats.completed },
    { name: "Not Completed", value: stats.total - stats.completed },
  ];
  const districtBarData = stats.byDistrict.slice(0, 10);
  const groupBarData    = stats.byGroup.slice(0, 10);
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <Card className="shadow-md overflow-hidden">
      <CardHeader className="pb-3 pt-4 px-4 bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-lg">{emoji}</span>
              <CardTitle className="text-base leading-tight">{target.title}</CardTitle>
              <Badge variant="secondary" className="text-xs shrink-0">{freqLabel}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {fmtDate(target.startDate)} → {fmtDate(target.endDate)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-primary">{stats.completionRate}%</p>
            <p className="text-xs text-muted-foreground">completed</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-3 space-y-4">
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span><span>{stats.completed} / {stats.total}</span>
          </div>
          <Progress value={stats.completionRate} className="h-2" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
            <CheckCircle className="h-4 w-4 text-green-600 mx-auto mb-0.5" />
            <p className="text-lg font-bold text-green-700">{stats.completed}</p>
            <p className="text-xs text-green-600">Completed</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
            <Clock className="h-4 w-4 text-blue-600 mx-auto mb-0.5" />
            <p className="text-lg font-bold text-blue-700">{stats.in_progress}</p>
            <p className="text-xs text-blue-600">In Progress</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
            <AlertCircle className="h-4 w-4 text-gray-500 mx-auto mb-0.5" />
            <p className="text-lg font-bold text-gray-600">{stats.not_started}</p>
            <p className="text-xs text-gray-500">Not Started</p>
          </div>
        </div>
        {stats.total > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Completion Overview
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${v}`, ""]} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {districtBarData.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-2">
              <BarChart3 className="h-3 w-3" /> By District
              <span className="font-normal text-muted-foreground/70">· tap a bar to drill down</span>
            </p>
            <ResponsiveContainer width="100%" height={Math.max(120, districtBarData.length * 28)}>
              <BarChart data={districtBarData} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                <Tooltip />
                <Bar dataKey="completed" name="Completed" fill={BAR_COLORS.completed} radius={[0, 2, 2, 0]} cursor="pointer"
                  onClick={(data) => onBarClick(target._id, "district", data._id, data.name, "completed")} />
                <Bar dataKey="not_completed" name="Not Completed" fill={BAR_COLORS.not_completed} radius={[0, 2, 2, 0]} cursor="pointer"
                  onClick={(data) => onBarClick(target._id, "district", data._id, data.name, "not_completed")} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {groupBarData.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-2">
              <Users className="h-3 w-3" /> By Group (top 10)
              <span className="font-normal text-muted-foreground/70">· tap a bar to drill down</span>
            </p>
            <ResponsiveContainer width="100%" height={Math.max(120, groupBarData.length * 28)}>
              <BarChart data={groupBarData} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                <Tooltip />
                <Bar dataKey="completed" name="Completed" fill={BAR_COLORS.completed} radius={[0, 2, 2, 0]} cursor="pointer"
                  onClick={(data) => onBarClick(target._id, "group", data._id, data.name, "completed")} />
                <Bar dataKey="not_completed" name="Not Completed" fill={BAR_COLORS.not_completed} radius={[0, 2, 2, 0]} cursor="pointer"
                  onClick={(data) => onBarClick(target._id, "group", data._id, data.name, "not_completed")} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────
const Consolidation = () => {
  const navigate = useNavigate();
  const { userRole, user } = useAuth();
  const homeRoute = getHomeRouteByRole(userRole);
  const [dashStats,        setDashStats]        = useState<DashboardStats | null>(null);
  const [orgStats,         setOrgStats]         = useState<OrgStats | null>(null);
  const [recurringTargets, setRecurringTargets] = useState<TargetStat[]>([]);
  const [districts,        setDistricts]        = useState<District[]>([]);
  const [allTargets,       setAllTargets]       = useState<SimpleTarget[]>([]);
  const [loading,          setLoading]          = useState(true);

  // Drilldown (bar chart click)
  const [drillState,   setDrillState]   = useState<DrillState | null>(null);
  const [drillResults, setDrillResults] = useState<UserResult[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  // Standalone filter section
  const [sfTargetId, setSfTargetId] = useState("");
  const [sfDistrict, setSfDistrict] = useState("all");
  const [sfGroups,   setSfGroups]   = useState<Group[]>([]);
  const [sfGroup,    setSfGroup]    = useState("all");
  const [sfRole,     setSfRole]     = useState("all");
  const [sfStatus,   setSfStatus]   = useState("all");
  const [sfResults,  setSfResults]  = useState<UserResult[]>([]);
  const [sfLoading,  setSfLoading]  = useState(false);
  const [sfApplied,  setSfApplied]  = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const districtRequest = userRole === "state_admin"
        ? apiCall("/districts?limit=100")
        : Promise.resolve({ data: [] as District[] });

      const [dashRes, orgRes, recurringRes, distRes, targetsRes] = await Promise.all([
        apiCall("/reports/dashboard"),
        apiCall("/reports/org-stats"),
        apiCall("/reports/recurring-target-stats"),
        districtRequest,
        apiCall("/personal-targets?limit=200"),
      ]);
      const d  = dashRes.data;
      const ms = d?.memberStatistics || {};
      setDashStats({
        members: {
          total:    ms.totalMembers    || 0,
          active:   ms.activeMembers   || 0,
          inactive: ms.inactiveMembers || 0,
          abroad:   ms.abroadMembers   || 0,
          approved: ms.approvedMembers || 0,
          pending:  ms.pendingMembers  || 0,
        },
        districts: {
          total:  d?.districtStatistics?.totalDistricts  || 0,
          active: d?.districtStatistics?.activeDistricts || 0,
        },
        groups: { total: d?.groupStatistics?.totalGroups || 0 },
      });
      setOrgStats(orgRes.data);
      setRecurringTargets(recurringRes.data || []);
      if (userRole === "state_admin") {
        setDistricts(distRes.data || []);
      } else if (user?.district) {
        setDistricts([user.district]);
      } else {
        setDistricts([]);
      }
      setAllTargets(targetsRes.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load dashboard", variant: "destructive" });
    } finally { setLoading(false); }
  }, [userRole, user]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (userRole === "district_admin" && user?.district?._id) {
      setSfDistrict(user.district._id);
      setSfGroup("all");
    }
    if (userRole === "group_admin" && user?.group?._id) {
      if (user?.district?._id) setSfDistrict(user.district._id);
      setSfGroup(user.group._id);
    }
  }, [userRole, user]);

  // Load groups for standalone filter when district changes
  useEffect(() => {
    if (userRole === "group_admin") {
      if (user?.group) {
        setSfGroups([user.group]);
        setSfGroup(user.group._id);
      } else {
        setSfGroups([]);
        setSfGroup("all");
      }
      return;
    }

    setSfGroup("all");
    setSfGroups([]);
    if (sfDistrict !== "all") {
      apiCall(`/groups?district=${sfDistrict}&limit=200`).then(r => setSfGroups(r.data || [])).catch(() => {});
    }
  }, [sfDistrict, userRole, user]);

  // Bar chart click → fetch drilldown list
  const handleBarClick = async (
    targetId: string, filterType: "district" | "group",
    id: string | undefined, name: string, clickedStatus: "completed" | "not_completed"
  ) => {
    const tgt = recurringTargets.find(t => t._id === targetId);
    setDrillState({ targetId, targetTitle: tgt?.title || "", filterType, id, name, clickedStatus });
    setDrillResults([]);
    setDrillLoading(true);
    try {
      const qp = new URLSearchParams();
      qp.set("consolidationType", "personal_target");
      qp.set("targetId", targetId);
      qp.set("targetStatus", "all");
      if (filterType === "district" && id) qp.set("districtId", id);
      if (filterType === "group"    && id) qp.set("groupId",    id);
      const result = await apiCall(`/reports/consolidation?${qp.toString()}`);
      const all: UserResult[] = result.data || [];
      const filtered = clickedStatus === "completed"
        ? all.filter(u => u.progress?.status === "completed")
        : all.filter(u => u.progress?.status !== "completed");
      setDrillResults(filtered);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load details", variant: "destructive" });
    } finally { setDrillLoading(false); }
  };

  const exportCSV = (rows: UserResult[], filename: string) => {
    const headers = ["Name", "Phone", "Role", "District", "Group", "Target Status", "Completed At"];
    const data = rows.map(u => [
      u.name, u.phone || "", getRoleLabel(u.role, u.roleTag?.type),
      u.district?.name || "", u.group?.name || "",
      u.progress?.status || "not_started",
      u.progress?.completedAt ? new Date(u.progress.completedAt).toLocaleDateString() : "",
    ]);
    const csv  = [headers, ...data].map(r => r.map(f => `"${f}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const applyStandaloneFilter = async () => {
    if (!sfTargetId) {
      toast({ title: "Select a target", description: "Please select a target first", variant: "destructive" });
      return;
    }
    setSfLoading(true); setSfApplied(true);
    try {
      const qp = new URLSearchParams();
      qp.set("consolidationType", "personal_target");
      qp.set("targetId", sfTargetId);
      if (userRole === "district_admin" && user?.district?._id) {
        qp.set("districtId", user.district._id);
      } else if (sfDistrict !== "all") {
        qp.set("districtId", sfDistrict);
      }

      if (userRole === "group_admin" && user?.group?._id) {
        qp.set("groupId", user.group._id);
      } else if (sfGroup !== "all") {
        qp.set("groupId", sfGroup);
      }

      if (sfRole     !== "all") qp.set("roleFilter",   sfRole);
      if (sfStatus   !== "all") qp.set("targetStatus", sfStatus);
      const result = await apiCall(`/reports/consolidation?${qp.toString()}`);
      setSfResults(result.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed", variant: "destructive" });
    } finally { setSfLoading(false); }
  };

  const memberPieData = dashStats ? [
    { name: "Active",   value: dashStats.members.active   },
    { name: "Inactive", value: dashStats.members.inactive },
    { name: "Abroad",   value: dashStats.members.abroad   },
    { name: "Pending",  value: dashStats.members.pending  },
  ].filter(d => d.value > 0) : [];

  const adminBarData = orgStats ? [
    { role: "District", count: orgStats.users.district_admin },
    { role: "Area",     count: orgStats.users.area_admin     },
    { role: "Unit",     count: orgStats.users.unit_admin     },
    { role: "Group",    count: orgStats.users.group_admin    },
  ] : [];

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-card border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(homeRoute)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Consolidation</h1>
            <p className="text-xs text-muted-foreground">Organisation overview & recurring targets</p>
          </div>
          <Button variant="ghost" size="icon" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading dashboard…</p>
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-6">

          {/* ── Section 1: Members ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="font-bold text-sm">Members</h2>
              {dashStats && (
                <Badge variant="outline" className="text-xs ml-auto">Total: {dashStats.members.total}</Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Active Members"   value={dashStats?.members.active   ?? "—"} icon={UserCheck} color="text-green-600" bg="bg-green-100" />
              <StatCard label="Inactive Members" value={dashStats?.members.inactive ?? "—"} icon={UserX}     color="text-red-500"   bg="bg-red-100"   />
              <StatCard label="Abroad Members"   value={dashStats?.members.abroad   ?? "—"} icon={Globe2}    color="text-blue-600"  bg="bg-blue-100"  />
              <StatCard label="Pending Approval" value={dashStats?.members.pending  ?? "—"} icon={Clock}     color="text-amber-600" bg="bg-amber-100" />
            </div>
            {memberPieData.length > 0 && (
              <Card className="mt-3 shadow-sm">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Member Status Distribution
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={memberPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {memberPieData.map((_, i) => <Cell key={i} fill={MEMBER_PIE_COLORS[i % MEMBER_PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v}`, ""]} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </section>

          {/* ── Section 2: Organisation Structure ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="font-bold text-sm">Organisation Structure</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Districts"    value={dashStats?.districts.total ?? "—"} icon={MapPin}    color="text-violet-600" bg="bg-violet-100" sub={`${dashStats?.districts.active ?? 0} active`} />
              <StatCard label="Groups"       value={orgStats?.totalGroups ?? dashStats?.groups.total ?? "—"} icon={Building2} color="text-indigo-600" bg="bg-indigo-100" />
              <StatCard label="Leaders"      value={orgStats?.users.leaders ?? "—"}    icon={Crown}     color="text-amber-600"  bg="bg-amber-100"  sub="District + Area admins" />
              <StatCard label="Total Admins" value={orgStats?.users.total   ?? "—"}    icon={Shield}    color="text-primary"    bg="bg-primary/10" />
            </div>
            {adminBarData.length > 0 && orgStats && (
              <Card className="mt-3 shadow-sm">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" /> Admin Role Breakdown
                  </p>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={adminBarData} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="role" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Admins" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </section>

          {/* ── Section 3: Targets Overview ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="font-bold text-sm">Targets Overview</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Active Targets" value={orgStats?.targets.active ?? "—"} icon={Target}      color="text-green-600" bg="bg-green-100" />
              <StatCard label="Total Targets"  value={orgStats?.targets.total  ?? "—"} icon={BarChart3}   color="text-blue-600"  bg="bg-blue-100"  />
              <StatCard label="Completed"      value={orgStats?.targets.completedSubmissions  ?? "—"} icon={CheckCircle} color="text-green-700" bg="bg-green-100" sub="submissions" />
              <StatCard label="In Progress"    value={orgStats?.targets.inProgressSubmissions ?? "—"} icon={Clock}       color="text-blue-600"  bg="bg-blue-100"  sub="submissions" />
            </div>
          </section>

          {/* ── Section 4: Recurring Targets ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="h-4 w-4 text-primary" />
              <h2 className="font-bold text-sm">Recurring Targets</h2>
              <Badge variant="outline" className="text-xs ml-auto">{recurringTargets.length} active</Badge>
            </div>
            {recurringTargets.length === 0 ? (
              <Card className="p-6 text-center shadow-sm border-dashed">
                <RefreshCw className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium text-sm">No active recurring targets</p>
                <p className="text-xs text-muted-foreground mt-1">
                  There are no recurring targets active for today.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/personal-targets")}>
                  Manage Targets
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {recurringTargets.map(target => (
                  <TargetCard
                    key={target._id}
                    target={target}
                    onBarClick={handleBarClick}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── Drilldown Panel (shown after a bar is clicked) ── */}
          {drillState && (
            <section>
              <Card className="shadow-md border-2 border-primary/20">
                <CardHeader className="pb-2 pt-3 px-4 bg-primary/5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{drillState.targetTitle}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {drillState.filterType === "district" ? "📍 District" : "👥 Group"}:{" "}
                        <span className="font-medium">{drillState.name}</span>
                        {" · "}
                        <span className={drillState.clickedStatus === "completed" ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                          {drillState.clickedStatus === "completed" ? "Completed" : "Not Completed"}
                        </span>
                      </p>
                    </div>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                      onClick={() => { setDrillState(null); setDrillResults([]); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-3 space-y-2">
                  <UserResultList
                    results={drillResults}
                    loading={drillLoading}
                    applied
                    onExport={drillResults.length > 0 ? () => exportCSV(drillResults, `drill-${drillState.name}-${Date.now()}.csv`) : undefined}
                  />
                </CardContent>
              </Card>
            </section>
          )}

          {/* ── Section 5: Filter Details (Standalone Consolidation) ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-primary" />
              <h2 className="font-bold text-sm">Filter Details</h2>
            </div>
            <Card className="shadow-sm border-dashed">
              <CardContent className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Target *</label>
                  <Select value={sfTargetId} onValueChange={setSfTargetId}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select a target…" /></SelectTrigger>
                    <SelectContent>
                      {allTargets.map(t => (
                        <SelectItem key={t._id} value={t._id}>
                          {t.isRecurring ? "🔁 " : ""}{t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">District</label>
                    <Select value={sfDistrict} onValueChange={setSfDistrict} disabled={userRole !== "state_admin"}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Districts" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Districts</SelectItem>
                        {districts.map(d => <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Group</label>
                    <Select value={sfGroup} onValueChange={setSfGroup} disabled={sfDistrict === "all" || userRole === "group_admin"}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Groups" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Groups</SelectItem>
                        {sfGroups.map(g => <SelectItem key={g._id} value={g._id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
                    <Select value={sfRole} onValueChange={setSfRole}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Roles" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="district_admin">District Admin</SelectItem>
                        <SelectItem value="area_admin">Area Admin</SelectItem>
                        <SelectItem value="unit_admin">Unit Admin</SelectItem>
                        <SelectItem value="group_admin">Group Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                    <Select value={sfStatus} onValueChange={setSfStatus}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  className="w-full h-8 text-sm"
                  onClick={applyStandaloneFilter}
                  disabled={sfLoading || !sfTargetId}
                >
                  {sfLoading ? "Loading…" : "Apply Filters"}
                </Button>
              </CardContent>
            </Card>
            {sfApplied && (
              <div className="mt-3 space-y-2">
                <UserResultList
                  results={sfResults}
                  loading={sfLoading}
                  applied={sfApplied}
                  onExport={sfResults.length > 0 ? () => exportCSV(sfResults, `consolidation-${Date.now()}.csv`) : undefined}
                />
              </div>
            )}
          </section>

        </div>
      )}
    </div>
  );
};

export default Consolidation;
