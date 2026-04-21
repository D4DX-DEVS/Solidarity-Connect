import { useState, useEffect, useCallback } from "react";
import {
  BarChart3, ArrowLeft, Filter, Users, Download, CheckCircle, Clock,
  AlertCircle, Target, RefreshCw, TrendingUp,
  Building2, MapPin, UserCheck, UserX, Globe2, Crown, Shield, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight
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
  startDate: string; endDate: string; targetAudience: string; attendanceNeeded?: boolean;
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
interface SimpleTarget { _id: string; title: string; isRecurring?: boolean; attendanceNeeded?: boolean }
interface RecurringGridUser {
  userId: string;
  userName: string;
  role: string;
  district?: string;
  group?: string;
  marks: Record<string, boolean>; // "month" or "month-week" → completed
}
interface DrillState {
  targetId: string; targetTitle: string;
  filterType: "district" | "group";
  id?: string; name: string;
  clickedStatus: "completed" | "not_completed";
}
interface AttendanceMember {
  memberId: string; name: string; phone: string; group: string;
  months: Record<string, boolean>;
  presentCount: number; absentCount: number; unmarkedCount: number;
}
interface AttendanceData {
  targetTitle: string;
  periods: string[];
  members: AttendanceMember[];
  periodSummary: Record<string, { present: number; absent: number; total: number }>;
  totalMembers: number; totalPeriods: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const CATEGORY_EMOJI: Record<string,string> = {
  quran:"📖", hadith:"📜", prayer:"🕌", charity:"💝", knowledge:"🎓", community:"🤝", other:"🎯",
};
const FREQ_LABEL: Record<string,string> = { weekly:"Weekly", monthly:"Monthly", quarterly:"Quarterly" };
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
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
  if (role === "group_admin") return "Area Admin";
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
const PAGE_SIZE = 10;

const TargetCard = ({ target, onBarClick }: TargetCardProps) => {
  const { stats } = target;
  const emoji     = CATEGORY_EMOJI[target.category] || "🎯";
  const freqLabel = FREQ_LABEL[target.recurringFrequency] || target.recurringFrequency;
  const pieData   = [
    { name: "Completed",     value: stats.completed },
    { name: "Not Completed", value: stats.total - stats.completed },
  ];

  const [districtPage, setDistrictPage] = useState(0);
  const [groupPage,    setGroupPage]    = useState(0);

  const districtTotal   = stats.byDistrict.length;
  const groupTotal      = stats.byGroup.length;
  const districtBarData = stats.byDistrict.slice(districtPage * PAGE_SIZE, (districtPage + 1) * PAGE_SIZE);
  const groupBarData    = stats.byGroup.slice(groupPage * PAGE_SIZE, (groupPage + 1) * PAGE_SIZE);
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
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                <BarChart3 className="h-3 w-3" /> By District
                <span className="font-normal text-muted-foreground/70">· tap a bar to drill down</span>
              </p>
              {districtTotal > PAGE_SIZE && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{districtPage * PAGE_SIZE + 1}–{Math.min((districtPage + 1) * PAGE_SIZE, districtTotal)} of {districtTotal}</span>
                  <button onClick={() => setDistrictPage(p => Math.max(0, p - 1))} disabled={districtPage === 0} className="p-0.5 rounded disabled:opacity-30 hover:bg-muted">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDistrictPage(p => p + 1)} disabled={(districtPage + 1) * PAGE_SIZE >= districtTotal} className="p-0.5 rounded disabled:opacity-30 hover:bg-muted">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
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
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                <Users className="h-3 w-3" /> By Group
                <span className="font-normal text-muted-foreground/70">· tap a bar to drill down</span>
              </p>
              {groupTotal > PAGE_SIZE && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{groupPage * PAGE_SIZE + 1}–{Math.min((groupPage + 1) * PAGE_SIZE, groupTotal)} of {groupTotal}</span>
                  <button onClick={() => setGroupPage(p => Math.max(0, p - 1))} disabled={groupPage === 0} className="p-0.5 rounded disabled:opacity-30 hover:bg-muted">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setGroupPage(p => p + 1)} disabled={(groupPage + 1) * PAGE_SIZE >= groupTotal} className="p-0.5 rounded disabled:opacity-30 hover:bg-muted">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
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

  // Recurring grid state
  const [recurringGridTargetId, setRecurringGridTargetId] = useState<string | null>(null);
  const [recurringGridYear, setRecurringGridYear] = useState(new Date().getFullYear());
  const [recurringGridData, setRecurringGridData] = useState<RecurringGridUser[]>([]);
  const [recurringGridLoading, setRecurringGridLoading] = useState(false);
  const [recurringGridFrequency, setRecurringGridFrequency] = useState<string>('monthly');

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

  // Recurring filter period state
  const now = new Date();
  const [rfFromYear,  setRfFromYear]  = useState(now.getFullYear());
  const [rfFromMonth, setRfFromMonth] = useState(1);
  const [rfToYear,    setRfToYear]    = useState(now.getFullYear());
  const [rfToMonth,   setRfToMonth]   = useState(now.getMonth() + 1);
  const [rfStatus,    setRfStatus]    = useState("all");
  const [rfResults,   setRfResults]   = useState<any[]>([]);
  const [rfTotal,     setRfTotal]     = useState(0);
  const [rfLoading,   setRfLoading]   = useState(false);
  const [rfApplied,   setRfApplied]   = useState(false);

  // Attendance consolidation state
  const [attData,      setAttData]      = useState<AttendanceData | null>(null);
  const [attFilter,    setAttFilter]    = useState<"all" | "present" | "absent">("all");

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

  const loadRecurringGrid = useCallback(async (targetId: string, year: number) => {
    setRecurringGridLoading(true);
    try {
      const qp = new URLSearchParams();
      qp.set("targetId", targetId);
      qp.set("year", String(year));
      const result = await apiCall(`/reports/recurring-marks?${qp.toString()}`);
      setRecurringGridData(result.data || []);
      setRecurringGridFrequency(result.frequency || 'monthly');
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load grid", variant: "destructive" });
      setRecurringGridData([]);
    } finally {
      setRecurringGridLoading(false);
    }
  }, []);

  const handleRecurringGridExpand = (targetId: string) => {
    if (recurringGridTargetId === targetId) {
      setRecurringGridTargetId(null);
      setRecurringGridData([]);
    } else {
      setRecurringGridTargetId(targetId);
      loadRecurringGrid(targetId, recurringGridYear);
    }
  };

  const handleRecurringGridYearChange = (year: number) => {
    setRecurringGridYear(year);
    if (recurringGridTargetId) {
      loadRecurringGrid(recurringGridTargetId, year);
    }
  };

  const exportRecurringGrid = (target: TargetStat) => {
    const isWeekly = recurringGridFrequency === 'weekly';
    if (isWeekly) {
      // Weekly: columns for each month-week
      const weekCols: string[] = [];
      for (let m = 0; m < 12; m++) {
        const firstDay = new Date(recurringGridYear, m, 1).getDay();
        const daysInMonth = new Date(recurringGridYear, m + 1, 0).getDate();
        const weeks = Math.ceil((firstDay + daysInMonth) / 7);
        for (let w = 1; w <= weeks; w++) {
          weekCols.push(`${MONTHS_SHORT[m]}-W${w}`);
        }
      }
      const header = ["Name", "Role", "District", "Group", ...weekCols];
      const rows = recurringGridData.map(u => [
        u.userName, u.role, u.district || "", u.group || "",
        ...weekCols.map((_, idx) => {
          // Reconstruct month-week from column index
          let col = 0;
          for (let m = 0; m < 12; m++) {
            const firstDay = new Date(recurringGridYear, m, 1).getDay();
            const daysInMonth = new Date(recurringGridYear, m + 1, 0).getDate();
            const weeks = Math.ceil((firstDay + daysInMonth) / 7);
            for (let w = 1; w <= weeks; w++) {
              if (col === idx) return u.marks[`${m + 1}-${w}`] ? "✓" : "";
              col++;
            }
          }
          return "";
        }),
      ]);
      const csv = [header, ...rows].map(r => r.map(f => `"${f}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `recurring-weekly-${target.title}-${recurringGridYear}.csv`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const header = ["Name", "Role", "District", "Group", ...MONTHS_SHORT];
      const rows = recurringGridData.map(u => [
        u.userName, u.role, u.district || "", u.group || "",
        ...Array.from({ length: 12 }, (_, i) => u.marks[i + 1] ? "✓" : ""),
      ]);
      const csv = [header, ...rows].map(r => r.map(f => `"${f}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `recurring-${target.title}-${recurringGridYear}.csv`; a.click();
      URL.revokeObjectURL(url);
    }
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

  const applyRecurringFilter = async () => {
    if (!sfTargetId) {
      toast({ title: "Select a target", description: "Please select a recurring target first", variant: "destructive" });
      return;
    }
    setRfLoading(true); setRfApplied(true);
    setAttData(null);
    try {
      const qp = new URLSearchParams();
      qp.set("targetId", sfTargetId);
      qp.set("fromYear",  String(rfFromYear));
      qp.set("fromMonth", String(rfFromMonth));
      qp.set("toYear",    String(rfToYear));
      qp.set("toMonth",   String(rfToMonth));
      if (sfDistrict !== "all") qp.set("districtId", sfDistrict);
      if (rfStatus !== "all") qp.set("status", rfStatus);

      const selectedTarget = allTargets.find(t => t._id === sfTargetId);
      const promises: Promise<any>[] = [
        apiCall(`/reports/recurring-marks-filter?${qp.toString()}`)
      ];
      // Also fetch attendance if target has attendanceNeeded
      if (selectedTarget?.attendanceNeeded) {
        const attQp = new URLSearchParams();
        attQp.set("targetId", sfTargetId);
        attQp.set("fromYear", String(rfFromYear));
        attQp.set("fromMonth", String(rfFromMonth));
        attQp.set("toYear", String(rfToYear));
        attQp.set("toMonth", String(rfToMonth));
        if (sfDistrict !== "all") attQp.set("districtId", sfDistrict);
        promises.push(apiCall(`/reports/attendance-consolidation?${attQp.toString()}`));
      }

      const results = await Promise.all(promises);
      setRfResults(results[0].data?.results || []);
      setRfTotal(results[0].data?.total || 0);
      if (results[1]) {
        setAttData(results[1].data || null);
        setAttFilter("all");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to filter", variant: "destructive" });
    } finally { setRfLoading(false); }
  };

  const exportRecurringFilterCSV = () => {
    const headers = ["Name", "Phone", "Role", "District", "Group", "Completed Months", "Completed Count"];
    const data = rfResults.map(r => [
      r.name, r.phone || "", getRoleLabel(r.role, r.roleTag?.type),
      r.district || "", r.group || "",
      (r.completedMonths || []).join("; "),
      String(r.completedCount || 0),
    ]);
    const csv = [headers, ...data].map(row => row.map(f => `"${f}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `recurring-filter-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportAttendanceCSV = () => {
    if (!attData) return;
    const periodLabels = attData.periods.map(p => {
      const [y, m] = p.split("-");
      return `${MONTHS_SHORT[Number(m) - 1]} ${y}`;
    });
    const headers = ["Name", "Phone", "Group", ...periodLabels, "Present", "Absent", "Unmarked"];
    const rows = attData.members.map(m => [
      m.name, m.phone, m.group,
      ...attData.periods.map(p => m.months[p] === true ? "Present" : m.months[p] === false ? "Absent" : "—"),
      String(m.presentCount), String(m.absentCount), String(m.unmarkedCount)
    ]);
    const csv = [headers, ...rows].map(row => row.map(f => `"${f}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `attendance-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
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

          {/* ── Filter Details (top) ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-primary" />
              <h2 className="font-bold text-sm">Filter Details</h2>
            </div>
            <Card className="shadow-sm border-dashed">
              <CardContent className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Target *</label>
                  <Select value={sfTargetId} onValueChange={v => { setSfTargetId(v); setRfApplied(false); setSfApplied(false); }}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select a target…" /></SelectTrigger>
                    <SelectContent>
                      {allTargets.filter(t => !t.isRecurring).length > 0 && (
                        <>
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Regular Targets</div>
                          {allTargets.filter(t => !t.isRecurring).map(t => (
                            <SelectItem key={t._id} value={t._id}>{t.title}</SelectItem>
                          ))}
                        </>
                      )}
                      {allTargets.filter(t => t.isRecurring).length > 0 && (
                        <>
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-1">Recurring Targets</div>
                          {allTargets.filter(t => t.isRecurring).map(t => (
                            <SelectItem key={t._id} value={t._id}>🔁 {t.title}</SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* District filter (shared for both regular and recurring) */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">District / Region</label>
                  <Select value={sfDistrict} onValueChange={setSfDistrict} disabled={userRole !== "state_admin"}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Districts" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts</SelectItem>
                      {districts.map(d => <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* ── Regular target filters ── */}
                {!allTargets.find(t => t._id === sfTargetId)?.isRecurring && sfTargetId && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
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
                    <Button className="w-full h-8 text-sm" onClick={applyStandaloneFilter} disabled={sfLoading}>
                      {sfLoading ? "Loading…" : "Apply Filters"}
                    </Button>
                    {sfApplied && (
                      <UserResultList
                        results={sfResults}
                        loading={sfLoading}
                        applied={sfApplied}
                        onExport={sfResults.length > 0 ? () => exportCSV(sfResults, `consolidation-${Date.now()}.csv`) : undefined}
                      />
                    )}
                  </>
                )}

                {/* ── Recurring target filters ── */}
                {allTargets.find(t => t._id === sfTargetId)?.isRecurring && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">From Month</label>
                        <Select value={String(rfFromMonth)} onValueChange={v => setRfFromMonth(Number(v))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MONTHS_SHORT.map((m, i) => (
                              <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">From Year</label>
                        <Select value={String(rfFromYear)} onValueChange={v => setRfFromYear(Number(v))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()].map(y => (
                              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">To Month</label>
                        <Select value={String(rfToMonth)} onValueChange={v => setRfToMonth(Number(v))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MONTHS_SHORT.map((m, i) => (
                              <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">To Year</label>
                        <Select value={String(rfToYear)} onValueChange={v => setRfToYear(Number(v))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()].map(y => (
                              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Completion Status</label>
                        <Select value={rfStatus} onValueChange={setRfStatus}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="completed">Completed (at least one month)</SelectItem>
                            <SelectItem value="not_completed">Not Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button className="w-full h-8 text-sm" onClick={applyRecurringFilter} disabled={rfLoading}>
                      {rfLoading ? "Loading…" : "Apply Filters"}
                    </Button>

                    {rfApplied && !rfLoading && (
                      <div className="space-y-2 mt-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold">
                            Total: <span className="text-primary">{rfTotal}</span> {rfTotal === 1 ? "result" : "results"}
                          </p>
                          {rfResults.length > 0 && (
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={exportRecurringFilterCSV}>
                              <Download className="h-3 w-3 mr-1" /> CSV
                            </Button>
                          )}
                        </div>
                        {rfResults.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-3">No results found.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-72 overflow-y-auto">
                            {rfResults.map(r => (
                              <div key={r.userId} className="flex items-start justify-between gap-2 p-2 rounded border text-xs bg-muted/20">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{r.name}</p>
                                  <p className="text-muted-foreground truncate">
                                    {getRoleLabel(r.role, r.roleTag?.type)}
                                    {r.district ? ` · ${r.district}` : ""}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-semibold text-green-600">{r.completedCount} ✓</p>
                                  <p className="text-muted-foreground">{(r.completedMonths || []).join(", ") || "—"}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Attendance Consolidation Results */}
                    {rfApplied && !rfLoading && attData && (
                      <div className="space-y-3 mt-4 pt-4 border-t border-amber-200">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-amber-600" />
                          <h3 className="font-semibold text-sm text-amber-700">Attendance Consolidation</h3>
                        </div>

                        {/* Summary stats */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-green-50 rounded p-2 text-center">
                            <p className="text-lg font-bold text-green-600">
                              {attData.members.reduce((s, m) => s + m.presentCount, 0)}
                            </p>
                            <p className="text-xs text-muted-foreground">Total Present</p>
                          </div>
                          <div className="bg-red-50 rounded p-2 text-center">
                            <p className="text-lg font-bold text-red-500">
                              {attData.members.reduce((s, m) => s + m.absentCount, 0)}
                            </p>
                            <p className="text-xs text-muted-foreground">Total Absent</p>
                          </div>
                          <div className="bg-blue-50 rounded p-2 text-center">
                            <p className="text-lg font-bold text-blue-600">{attData.totalMembers}</p>
                            <p className="text-xs text-muted-foreground">Members</p>
                          </div>
                        </div>

                        {/* Period-wise summary */}
                        {attData.periods.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr>
                                  <th className="text-left p-1.5 font-semibold text-muted-foreground border-b">Period</th>
                                  <th className="p-1.5 font-semibold text-green-600 border-b text-center">Present</th>
                                  <th className="p-1.5 font-semibold text-red-500 border-b text-center">Absent</th>
                                </tr>
                              </thead>
                              <tbody>
                                {attData.periods.map(p => {
                                  const [py, pm] = p.split("-");
                                  const summary = attData.periodSummary[p];
                                  return (
                                    <tr key={p} className="border-b last:border-0">
                                      <td className="p-1.5 font-medium">{MONTHS_SHORT[Number(pm) - 1]} {py}</td>
                                      <td className="p-1.5 text-center text-green-600 font-semibold">{summary?.present || 0}</td>
                                      <td className="p-1.5 text-center text-red-500 font-semibold">{summary?.absent || 0}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Filter and export row */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex gap-1">
                            {(["all", "present", "absent"] as const).map(f => (
                              <Button
                                key={f}
                                size="sm" variant={attFilter === f ? "default" : "outline"}
                                className={`h-7 text-xs ${attFilter === f && f === "present" ? "bg-green-600 hover:bg-green-700" : ""} ${attFilter === f && f === "absent" ? "bg-red-500 hover:bg-red-600" : ""}`}
                                onClick={() => setAttFilter(f)}
                              >
                                {f === "all" ? `All (${attData.totalMembers})` : f === "present" ? "Present" : "Absent"}
                              </Button>
                            ))}
                          </div>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={exportAttendanceCSV}>
                            <Download className="h-3 w-3 mr-1" /> CSV
                          </Button>
                        </div>

                        {/* Member attendance grid */}
                        <div className="overflow-x-auto -mx-1">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr>
                                <th className="text-left p-1.5 font-semibold text-muted-foreground border-b sticky left-0 bg-background min-w-[120px]">
                                  Member
                                </th>
                                {attData.periods.map(p => {
                                  const [, pm] = p.split("-");
                                  return (
                                    <th key={p} className="p-1 font-semibold text-muted-foreground border-b text-center min-w-[36px]">
                                      {MONTHS_SHORT[Number(pm) - 1]}
                                    </th>
                                  );
                                })}
                                <th className="p-1 font-semibold text-green-600 border-b text-center min-w-[28px]">P</th>
                                <th className="p-1 font-semibold text-red-500 border-b text-center min-w-[28px]">A</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attData.members
                                .filter(m => {
                                  if (attFilter === "all") return true;
                                  if (attFilter === "present") return m.presentCount > 0;
                                  return m.absentCount > 0;
                                })
                                .map(member => (
                                  <tr key={member.memberId} className="border-b last:border-0 hover:bg-muted/30">
                                    <td className="p-1.5 sticky left-0 bg-background">
                                      <p className="font-medium truncate max-w-[110px]">{member.name}</p>
                                      <p className="text-muted-foreground truncate max-w-[110px]">{member.group}</p>
                                    </td>
                                    {attData.periods.map(p => (
                                      <td key={p} className="p-1 text-center">
                                        {member.months[p] === true ? (
                                          <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                                        ) : member.months[p] === false ? (
                                          <X className="h-3.5 w-3.5 text-red-400 mx-auto" />
                                        ) : (
                                          <span className="text-gray-200">–</span>
                                        )}
                                      </td>
                                    ))}
                                    <td className="p-1 text-center font-semibold text-green-600">{member.presentCount}</td>
                                    <td className="p-1 text-center font-semibold text-red-500">{member.absentCount}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                          {attData.members.filter(m => {
                            if (attFilter === "all") return true;
                            if (attFilter === "present") return m.presentCount > 0;
                            return m.absentCount > 0;
                          }).length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-3">No members match the filter.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </section>

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
                  <div key={target._id} className="space-y-2">
                    <TargetCard
                      target={target}
                      onBarClick={handleBarClick}
                    />

                    {/* Monthly Completion Grid toggle */}
                    <Card className="shadow-sm border-blue-100">
                      <CardContent className="p-3">
                        <button
                          className="w-full flex items-center justify-between text-sm font-medium text-blue-700"
                          onClick={() => handleRecurringGridExpand(target._id)}
                        >
                          <div className="flex items-center gap-2">
                            <RefreshCw className="h-3.5 w-3.5" />
                            {target.recurringFrequency === 'weekly' ? 'Weekly' : 'Monthly'} Completion Grid
                          </div>
                          {recurringGridTargetId === target._id
                            ? <ChevronUp className="h-4 w-4" />
                            : <ChevronDown className="h-4 w-4" />
                          }
                        </button>

                        {recurringGridTargetId === target._id && (
                          <div className="mt-3">
                            {/* Year selector */}
                            <div className="flex items-center gap-2 mb-3">
                              <button
                                onClick={() => handleRecurringGridYearChange(recurringGridYear - 1)}
                                className="px-2 py-1 rounded border text-xs hover:bg-muted"
                              >←</button>
                              <span className="text-sm font-semibold w-12 text-center">{recurringGridYear}</span>
                              <button
                                onClick={() => handleRecurringGridYearChange(recurringGridYear + 1)}
                                className="px-2 py-1 rounded border text-xs hover:bg-muted"
                                disabled={recurringGridYear >= new Date().getFullYear()}
                              >→</button>
                              {recurringGridData.length > 0 && (
                                <Button
                                  variant="outline" size="sm"
                                  className="ml-auto text-xs h-7"
                                  onClick={() => exportRecurringGrid(target)}
                                >
                                  <Download className="h-3 w-3 mr-1" />CSV
                                </Button>
                              )}
                            </div>

                            {recurringGridLoading ? (
                              <div className="text-center py-4 text-muted-foreground text-xs">
                                <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1" />
                                Loading…
                              </div>
                            ) : recurringGridData.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-3">
                                No completion data for {recurringGridYear}.
                              </p>
                            ) : (
                              <div className="overflow-x-auto -mx-1">
                                {recurringGridFrequency === 'weekly' ? (
                                  /* ── Weekly grid: month groups × week columns ── */
                                  <table className="w-full text-xs border-collapse">
                                    <thead>
                                      <tr>
                                        <th rowSpan={2} className="text-left p-1.5 font-semibold text-muted-foreground border-b sticky left-0 bg-background min-w-[120px]">
                                          User
                                        </th>
                                        {MONTHS_SHORT.map((m, mIdx) => {
                                          const firstDay = new Date(recurringGridYear, mIdx, 1).getDay();
                                          const daysInMonth = new Date(recurringGridYear, mIdx + 1, 0).getDate();
                                          const weeks = Math.ceil((firstDay + daysInMonth) / 7);
                                          return (
                                            <th key={mIdx} colSpan={weeks} className="p-1 font-semibold text-muted-foreground border-b text-center border-l">
                                              {m}
                                            </th>
                                          );
                                        })}
                                      </tr>
                                      <tr>
                                        {MONTHS_SHORT.map((_, mIdx) => {
                                          const firstDay = new Date(recurringGridYear, mIdx, 1).getDay();
                                          const daysInMonth = new Date(recurringGridYear, mIdx + 1, 0).getDate();
                                          const weeks = Math.ceil((firstDay + daysInMonth) / 7);
                                          return Array.from({ length: weeks }, (__, w) => (
                                            <th key={`${mIdx}-${w}`} className="p-0.5 text-[9px] text-muted-foreground/60 border-b text-center min-w-[24px]">
                                              W{w + 1}
                                            </th>
                                          ));
                                        })}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {recurringGridData.map((user) => (
                                        <tr key={user.userId} className="border-b last:border-0 hover:bg-muted/30">
                                          <td className="p-1.5 sticky left-0 bg-background">
                                            <p className="font-medium truncate max-w-[110px]">{user.userName}</p>
                                            <p className="text-muted-foreground truncate max-w-[110px]">{user.district || user.role}</p>
                                          </td>
                                          {MONTHS_SHORT.map((_, mIdx) => {
                                            const monthNum = mIdx + 1;
                                            const firstDay = new Date(recurringGridYear, mIdx, 1).getDay();
                                            const daysInMonth = new Date(recurringGridYear, mIdx + 1, 0).getDate();
                                            const weeks = Math.ceil((firstDay + daysInMonth) / 7);
                                            const isFutureMonth = recurringGridYear === new Date().getFullYear() && monthNum > new Date().getMonth() + 1;
                                            return Array.from({ length: weeks }, (__, w) => {
                                              const weekNum = w + 1;
                                              const completed = user.marks[`${monthNum}-${weekNum}`] === true;
                                              return (
                                                <td key={`${mIdx}-${w}`} className="p-0.5 text-center">
                                                  {isFutureMonth ? (
                                                    <span className="text-gray-200">–</span>
                                                  ) : completed ? (
                                                    <CheckCircle className="h-3.5 w-3.5 text-green-500 mx-auto" />
                                                  ) : (
                                                    <X className="h-3 w-3 text-gray-300 mx-auto" />
                                                  )}
                                                </td>
                                              );
                                            });
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  /* ── Monthly grid (existing) ── */
                                  <table className="w-full text-xs border-collapse">
                                    <thead>
                                      <tr>
                                        <th className="text-left p-1.5 font-semibold text-muted-foreground border-b sticky left-0 bg-background min-w-[120px]">
                                          User
                                        </th>
                                        {MONTHS_SHORT.map((m, i) => (
                                          <th key={i} className="p-1 font-semibold text-muted-foreground border-b text-center min-w-[32px]">
                                            {m}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {recurringGridData.map((user) => (
                                        <tr key={user.userId} className="border-b last:border-0 hover:bg-muted/30">
                                          <td className="p-1.5 sticky left-0 bg-background">
                                            <p className="font-medium truncate max-w-[110px]">{user.userName}</p>
                                            <p className="text-muted-foreground truncate max-w-[110px]">{user.district || user.role}</p>
                                          </td>
                                          {Array.from({ length: 12 }, (_, i) => {
                                            const monthNum = i + 1;
                                            const completed = user.marks[monthNum] === true;
                                            const isFuture = recurringGridYear === new Date().getFullYear() && monthNum > new Date().getMonth() + 1;
                                            return (
                                              <td key={monthNum} className="p-1 text-center">
                                                {isFuture ? (
                                                  <span className="text-gray-200">–</span>
                                                ) : completed ? (
                                                  <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                                                ) : (
                                                  <X className="h-3.5 w-3.5 text-gray-300 mx-auto" />
                                                )}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                  </div>
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

        </div>
      )}
    </div>
  );
};

export default Consolidation;
