import { useState, useEffect, useRef } from "react";
import { isAreaLevelAdmin } from "@/lib/adminKinds";
import {
  Target, CheckCircle, Clock, AlertCircle, MessageSquare,
  ChevronDown, ChevronUp, Paperclip, Upload, X, FileText, Image, Film, RefreshCw, Users, Plus, Minus,
  BookOpen, Library, HandHeart, Heart, GraduationCap, Handshake
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionCard } from "@/components/app/AppShell";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import { toast } from "@/hooks/use-toast";
import { apiCall, uploadsAPI } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

interface PersonalTarget {
  _id: string;
  title: string;
  description: string;
  category: string;
  instructions?: string;
  rewards?: string;
  month: number;
  year: number;
  status: string;
  isRecurring?: boolean;
  recurringFrequency?: string;
  attendanceNeeded?: boolean;
}

interface FileAttachment {
  url: string;
  originalName: string;
  mimetype: string;
  size: number;
  key: string;
}

interface ProgressRecord {
  _id: string;
  personalTarget: PersonalTarget;
  status: "not_started" | "in_progress" | "completed";
  feedback?: string;
  fileAttachment?: FileAttachment;
  completedAt?: string;
  updatedAt: string;
}

interface RecurringMark {
  targetId: string;
  year: number;
  month: number; // 1–12
  week: number; // 0 = month-level, 1..5 = week-within-month (weekly targets only)
  completed: boolean;
  completionCount?: number;
  attendance?: { member: string; present: boolean }[];
}

interface AreaMember {
  _id: string;
  name: string;
  phone: string;
  group?: { _id: string; name: string };
  status: string;
  isLeader?: boolean;
  roleTag?: { type?: string; name?: string };
}

interface AreaLeader {
  _id: string;
  name: string;
  phone: string;
  roleTag?: { type?: string; name?: string; roleDescription?: string };
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Each month is split into 5 slots for weekly targets. Week 5 only exists
// if the month actually has a 5th calendar week (days 29–31 that fall in a new week).
const WEEKLY_SLOTS = [1, 2, 3, 4, 5];

const getWeeksInMonth = (year: number, monthIdx0: number): number => {
  // monthIdx0 is 0-based (0 = Jan). Returns number of calendar weeks overlapping this month.
  const firstDay = new Date(year, monthIdx0, 1).getDay(); // 0 (Sun) .. 6 (Sat)
  const daysInMonth = new Date(year, monthIdx0 + 1, 0).getDate();
  return Math.ceil((firstDay + daysInMonth) / 7);
};

const statusConfig = {
  not_started: { label: "Not Started", icon: AlertCircle, color: "text-muted-foreground", badge: "secondary" as const },
  in_progress: { label: "In Progress", icon: Clock, color: "text-blue-500", badge: "default" as const },
  completed: { label: "Completed", icon: CheckCircle, color: "text-green-500", badge: "default" as const },
};

const CATEGORY_ICONS: Record<string, typeof Target> = {
  quran: BookOpen,
  hadith: Library,
  prayer: HandHeart,
  charity: Heart,
  knowledge: GraduationCap,
  community: Handshake,
};

const getCategoryIcon = (category: string, className = "h-5 w-5") => {
  const Icon = CATEGORY_ICONS[category] || Target;
  return <Icon className={className} />;
};

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

const UserTargetsSection = () => {
  const { user } = useAuth();
  // Area-level = area proper OR murabi/coordinator (identical permissions by design)
  const isAreaAdmin = isAreaLevelAdmin(user);

  const [progressList, setProgressList] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [uploadedAttachments, setUploadedAttachments] = useState<Record<string, FileAttachment>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Recurring marks state ────────────────────────────────
  const [recurringMarks, setRecurringMarks] = useState<RecurringMark[]>([]);
  const [markingKey, setMarkingKey] = useState<string | null>(null);
  const [expandedRecurringId, setExpandedRecurringId] = useState<string | null>(null);
  const [recurringYear, setRecurringYear] = useState(new Date().getFullYear());
  const [weeklySelectedMonth, setWeeklySelectedMonth] = useState<number>(new Date().getMonth() + 1);

  // ── Attendance dialog state ──────────────────────────────
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceTargetId, setAttendanceTargetId] = useState<string | null>(null);
  const [attendanceYear, setAttendanceYear] = useState(0);
  const [attendanceMonth, setAttendanceMonth] = useState(0);
  const [attendanceWeek, setAttendanceWeek] = useState(0);
  const [areaMembers, setAreaMembers] = useState<AreaMember[]>([]);
  const [areaLeaders, setAreaLeaders] = useState<AreaLeader[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});
  const [memberPage, setMemberPage] = useState(1);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberHasMore, setMemberHasMore] = useState(false);
  const [loadingMoreMembers, setLoadingMoreMembers] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceIsUnmarking, setAttendanceIsUnmarking] = useState(false);

  useEffect(() => {
    fetchProgress();
    fetchRecurringMarks();
  }, []);

  const fetchProgress = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const result = await apiCall("/user-target-progress");
      const data: ProgressRecord[] = result.data || [];
      setProgressList(data);
      const feedbackMap: Record<string, string> = {};
      const attachmentMap: Record<string, FileAttachment> = {};
      data.forEach((p) => {
        if (p.feedback) feedbackMap[p._id] = p.feedback;
        if (p.fileAttachment?.url) attachmentMap[p._id] = p.fileAttachment;
      });
      setFeedbackText(feedbackMap);
      setUploadedAttachments(attachmentMap);
    } catch (error) {
      console.error("Failed to fetch user target progress:", error);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const fetchRecurringMarks = async () => {
    try {
      const result = await apiCall("/recurring-marks/my");
      setRecurringMarks(result.data || []);
    } catch (error) {
      console.error("Failed to fetch recurring marks:", error);
    }
  };

  // ── Attendance helpers ─────────────────────────────────────
  const openAttendanceDialog = async (
    targetId: string,
    year: number,
    month: number,
    week: number = 0,
  ) => {
    const existing = recurringMarks.find(
      m => m.targetId === targetId && m.year === year && m.month === month && (m.week || 0) === week
    );
    // If already completed, this is an unmark action — confirm and unmark directly
    if (existing?.completed) {
      setAttendanceIsUnmarking(true);
      setAttendanceTargetId(targetId);
      setAttendanceYear(year);
      setAttendanceMonth(month);
      setAttendanceWeek(week);
      setAttendanceOpen(true);
      return;
    }

    setAttendanceIsUnmarking(false);
    setAttendanceTargetId(targetId);
    setAttendanceYear(year);
    setAttendanceMonth(month);
    setAttendanceWeek(week);
    setAttendanceOpen(true);
    setLoadingMembers(true);

    try {
      // First page of area members — everyone starts unmarked
      const membersRes = await apiCall("/recurring-marks/area-members?page=1&limit=20");

      const members: AreaMember[] = membersRes.data?.members || [];
      const leaders: AreaLeader[] = membersRes.data?.areaLeaders || [];
      setAreaMembers(members);
      setAreaLeaders(leaders);
      setMemberPage(1);
      setMemberTotal(membersRes.data?.memberCount || members.length);
      setMemberHasMore(Boolean(membersRes.data?.hasMore));

      const map: Record<string, boolean> = {};
      members.forEach(m => { map[m._id] = false; });
      setAttendanceMap(map);
    } catch {
      toast({ title: "Error", description: "Failed to load area members", variant: "destructive" });
      setAttendanceOpen(false);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadMoreMembers = async () => {
    if (loadingMoreMembers || !memberHasMore) return;
    setLoadingMoreMembers(true);
    try {
      const nextPage = memberPage + 1;
      const res = await apiCall(`/recurring-marks/area-members?page=${nextPage}&limit=20`);
      const more: AreaMember[] = res.data?.members || [];
      setAreaMembers(prev => [...prev, ...more]);
      setMemberPage(nextPage);
      setMemberHasMore(Boolean(res.data?.hasMore));
      setAttendanceMap(prev => {
        const next = { ...prev };
        more.forEach(m => { if (!(m._id in next)) next[m._id] = false; });
        return next;
      });
    } catch {
      toast({ title: "Error", description: "Failed to load more members", variant: "destructive" });
    } finally {
      setLoadingMoreMembers(false);
    }
  };

  const submitAttendance = async () => {
    if (!attendanceTargetId) return;
    setSavingAttendance(true);

    const attendance = Object.entries(attendanceMap).map(([memberId, present]) => ({
      memberId,
      present
    }));

    try {
      await apiCall("/recurring-marks", {
        method: "POST",
        body: JSON.stringify({
          targetId: attendanceTargetId,
          year: attendanceYear,
          month: attendanceMonth,
          week: attendanceWeek,
          completed: true,
          attendance
        }),
      });
      setRecurringMarks(prev => {
        const filtered = prev.filter(
          m => !(m.targetId === attendanceTargetId && m.year === attendanceYear && m.month === attendanceMonth && (m.week || 0) === attendanceWeek)
        );
        return [...filtered, {
          targetId: attendanceTargetId!,
          year: attendanceYear,
          month: attendanceMonth,
          week: attendanceWeek,
          completed: true,
          completionCount: 1,
          attendance: attendance.map(a => ({ member: a.memberId, present: a.present }))
        }];
      });
      toast({ title: "Success", description: "Attendance marked and target completed" });
      setAttendanceOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to save attendance", variant: "destructive" });
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleUnmarkAttendance = async () => {
    if (!attendanceTargetId) return;
    setSavingAttendance(true);
    try {
      await apiCall("/recurring-marks", {
        method: "POST",
        body: JSON.stringify({
          targetId: attendanceTargetId,
          year: attendanceYear,
          month: attendanceMonth,
          week: attendanceWeek,
          completed: false,
          completionCount: 0,
          attendance: []
        }),
      });
      setRecurringMarks(prev => {
        const filtered = prev.filter(
          m => !(m.targetId === attendanceTargetId && m.year === attendanceYear && m.month === attendanceMonth && (m.week || 0) === attendanceWeek)
        );
        return [...filtered, {
          targetId: attendanceTargetId!,
          year: attendanceYear,
          month: attendanceMonth,
          week: attendanceWeek,
          completed: false,
          completionCount: 0,
          attendance: []
        }];
      });
      toast({ title: "Unmarked", description: "Mark and attendance cleared" });
      setAttendanceOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to unmark", variant: "destructive" });
    } finally {
      setSavingAttendance(false);
    }
  };

  // ponytail: marking window = current + previous month; older months are expired (view-only)
  const getSlotState = (year: number, monthNum: number): 'future' | 'expired' | 'open' => {
    const now = new Date();
    const ago = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - monthNum);
    if (ago < 0) return 'future';
    if (ago > 1) return 'expired';
    return 'open';
  };

  const showExpiredToast = () =>
    toast({ title: "Expired", description: "You can only mark the current or previous month.", variant: "destructive" });

  // Look up a stored mark for a specific slot. `week` defaults to 0 (month-level).
  const findMark = (targetId: string, year: number, month: number, week: number = 0) =>
    recurringMarks.find(
      m => m.targetId === targetId && m.year === year && m.month === month && (m.week || 0) === week
    );

  const toggleRecurringMark = async (
    targetId: string,
    year: number,
    month: number,
    week: number = 0,
  ) => {
    const key = `${targetId}-${year}-${month}-${week}`;
    const existing = findMark(targetId, year, month, week);
    const newCompleted = !existing?.completed;
    const newCount = newCompleted ? Math.max(1, existing?.completionCount || 0) : 0;
    setMarkingKey(key);
    // Optimistic update
    setRecurringMarks(prev => {
      const filtered = prev.filter(
        m => !(m.targetId === targetId && m.year === year && m.month === month && (m.week || 0) === week)
      );
      return [...filtered, { targetId, year, month, week, completed: newCompleted, completionCount: newCount }];
    });
    try {
      await apiCall("/recurring-marks", {
        method: "POST",
        body: JSON.stringify({ targetId, year, month, week, completed: newCompleted, completionCount: newCount }),
      });
    } catch {
      // Revert on failure
      setRecurringMarks(prev => {
        const filtered = prev.filter(
          m => !(m.targetId === targetId && m.year === year && m.month === month && (m.week || 0) === week)
        );
        if (existing) return [...filtered, existing];
        return filtered;
      });
      toast({ title: "Error", description: "Failed to update mark", variant: "destructive" });
    } finally {
      setMarkingKey(null);
    }
  };

  // Adjust the optional completion count for a monthly mark (extra completions in the same month).
  // The month stays marked as completed as long as count > 0.
  const adjustCompletionCount = async (
    targetId: string,
    year: number,
    month: number,
    delta: number,
  ) => {
    const key = `${targetId}-${year}-${month}-0-count`;
    const existing = findMark(targetId, year, month, 0);
    const nextCount = Math.max(0, (existing?.completionCount || 0) + delta);
    const nextCompleted = nextCount > 0;
    setMarkingKey(key);
    setRecurringMarks(prev => {
      const filtered = prev.filter(
        m => !(m.targetId === targetId && m.year === year && m.month === month && (m.week || 0) === 0)
      );
      return [...filtered, { targetId, year, month, week: 0, completed: nextCompleted, completionCount: nextCount }];
    });
    try {
      await apiCall("/recurring-marks", {
        method: "POST",
        body: JSON.stringify({
          targetId,
          year,
          month,
          week: 0,
          completed: nextCompleted,
          completionCount: nextCount,
        }),
      });
    } catch {
      setRecurringMarks(prev => {
        const filtered = prev.filter(
          m => !(m.targetId === targetId && m.year === year && m.month === month && (m.week || 0) === 0)
        );
        if (existing) return [...filtered, existing];
        return filtered;
      });
      toast({ title: "Error", description: "Failed to update count", variant: "destructive" });
    } finally {
      setMarkingKey(null);
    }
  };

  const handleSlotClick = (
    target: PersonalTarget,
    year: number,
    monthNum: number,
    week: number = 0,
  ) => {
    // Attendance dialog only applies to month-level marks (attendanceNeeded + area admin).
    if (target.attendanceNeeded && isAreaAdmin && week === 0) {
      openAttendanceDialog(target._id, year, monthNum, 0);
    } else {
      toggleRecurringMark(target._id, year, monthNum, week);
    }
  };

  const handleFileSelect = (progressId: string, file: File) => {
    setPendingFiles(prev => ({ ...prev, [progressId]: file }));
  };

  const uploadFile = async (progressId: string): Promise<FileAttachment | undefined> => {
    const file = pendingFiles[progressId];
    if (!file) return uploadedAttachments[progressId];
    try {
      setUploading(progressId);
      const result = await uploadsAPI.uploadFile(file);
      const attachment = result.data as FileAttachment;
      setUploadedAttachments(prev => ({ ...prev, [progressId]: attachment }));
      setPendingFiles(prev => { const n = { ...prev }; delete n[progressId]; return n; });
      return attachment;
    } catch {
      toast({ title: "Upload Failed", description: "Could not upload the file.", variant: "destructive" });
      return undefined;
    } finally {
      setUploading(null);
    }
  };

  const updateProgress = async (
    progressId: string,
    targetId: string,
    newStatus: "not_started" | "in_progress" | "completed",
    feedback?: string
  ) => {
    try {
      setSaving(progressId);
      let fileAttachment = uploadedAttachments[progressId];
      if (pendingFiles[progressId]) {
        fileAttachment = await uploadFile(progressId);
      }
      const result = await apiCall(`/user-target-progress/${targetId}`, {
        method: "POST",
        body: JSON.stringify({
          status: newStatus,
          feedback: feedback !== undefined ? feedback : (feedbackText[progressId] || ""),
          ...(fileAttachment ? { fileAttachment } : {})
        })
      });
      if (result?.data) {
        const updated = result.data;
        setProgressList(prev =>
          prev.map(p =>
            p._id === progressId
              ? { ...p, status: updated.status, completedAt: updated.completedAt ?? p.completedAt }
              : p
          )
        );
      }
      toast({ title: "Progress Updated", description: "Your target progress has been saved." });
      await fetchProgress(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update progress", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <SectionCard title="My Targets" description="Track assigned targets, notes, and recurring completion status.">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">Loading targets...</p>
        </div>
      </SectionCard>
    );
  }

  // ── Split regular vs recurring ───────────────────────────
  const regularProgress = progressList.filter(p => !p.personalTarget?.isRecurring);
  const recurringProgress = progressList.filter(p => p.personalTarget?.isRecurring);

  if (progressList.length === 0) {
    return (
      <SectionCard title="My Targets" description="Track assigned targets, notes, and recurring completion status.">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">No targets assigned to you yet.</p>
        </div>
      </SectionCard>
    );
  }

  const presentCount = Object.values(attendanceMap).filter(Boolean).length;
  const totalAttendance = Object.keys(attendanceMap).length;

  return (
    <div className="space-y-4">

      {/* ══════════ REGULAR TARGETS ══════════ */}
      {regularProgress.length > 0 && (
        <SectionCard
          title="My Targets"
          action={<Badge variant="outline">{regularProgress.length}</Badge>}
        >
            <div className="space-y-3">
              {regularProgress.map((progress) => {
                const target = progress.personalTarget;
                if (!target) return null;
                const cfg = statusConfig[progress.status];
                const StatusIcon = cfg.icon;
                const isExpanded = expandedId === progress._id;

                return (
                  <Card key={progress._id} className="surface-card border-primary/10">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant={cfg.badge} className={progress.status === "completed" ? "bg-green-100 text-green-800" : progress.status === "in_progress" ? "bg-blue-100 text-blue-800" : ""}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {cfg.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {MONTHS_FULL[(target.month || 1) - 1]} {target.year}
                            </span>
                          </div>
                          <p className="font-medium text-sm">{target.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{target.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => setExpandedId(isExpanded ? null : progress._id)}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 space-y-3 border-t pt-3">
                          {target.instructions && (
                            <div className="rounded-2xl bg-muted/60 p-3 text-xs">
                              <p className="font-medium mb-1">Instructions:</p>
                              <p>{target.instructions}</p>
                            </div>
                          )}
                          {target.rewards && (
                            <div className="rounded-2xl bg-amber-50 p-3 text-xs text-amber-900">
                              <p className="font-medium mb-1">Rewards:</p>
                              <p>{target.rewards}</p>
                            </div>
                          )}

                          {/* Feedback */}
                          <div>
                            <label className="text-xs font-medium flex items-center gap-1 mb-1">
                              <MessageSquare className="h-3 w-3" /> Feedback / Notes
                            </label>
                            <Textarea
                              placeholder="Add your feedback or notes here..."
                              className="text-xs min-h-[60px]"
                              value={feedbackText[progress._id] || ""}
                              onChange={(e) => setFeedbackText(prev => ({ ...prev, [progress._id]: e.target.value }))}
                            />
                          </div>

                          {/* File Upload */}
                          <div>
                            <label className="text-xs font-medium flex items-center gap-1 mb-1">
                              <Paperclip className="h-3 w-3" /> Attachment
                            </label>
                            <input
                              type="file"
                              className="hidden"
                              ref={el => { fileInputRefs.current[progress._id] = el; }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileSelect(progress._id, file);
                              }}
                            />
                            {(uploadedAttachments[progress._id] || pendingFiles[progress._id]) ? (
                              <div className="flex items-center gap-2 rounded-2xl bg-muted p-3 text-xs">
                                {(() => {
                                  const att = uploadedAttachments[progress._id];
                                  const pending = pendingFiles[progress._id];
                                  const mime = att?.mimetype || pending?.type || '';
                                  const name = att?.originalName || pending?.name || 'File';
                                  const Icon = mime.startsWith('image/') ? Image : mime.startsWith('video/') ? Film : FileText;
                                  return (
                                    <>
                                      <Icon className="h-3 w-3 shrink-0" />
                                      {att?.url ? (
                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary hover:underline">{name}</a>
                                      ) : (
                                        <span className="flex-1 truncate">{name}</span>
                                      )}
                                      {pending && <span className="text-amber-600 shrink-0">unsaved</span>}
                                    </>
                                  );
                                })()}
                                <button
                                  className="shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    setPendingFiles(prev => { const n = { ...prev }; delete n[progress._id]; return n; });
                                    setUploadedAttachments(prev => { const n = { ...prev }; delete n[progress._id]; return n; });
                                    if (fileInputRefs.current[progress._id]) fileInputRefs.current[progress._id]!.value = '';
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs w-full"
                                onClick={() => fileInputRefs.current[progress._id]?.click()}
                              >
                                <Upload className="h-3 w-3 mr-1" /> Choose File
                              </Button>
                            )}
                          </div>

                          {/* Status Buttons */}
                          <div className="flex gap-2 flex-wrap">
                            {progress.status !== "in_progress" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                disabled={saving === progress._id || uploading === progress._id}
                                onClick={() => updateProgress(progress._id, target._id, "in_progress")}
                              >
                                <Clock className="h-3 w-3 mr-1" /> Mark In Progress
                              </Button>
                            )}
                            {progress.status !== "completed" && (
                              <Button
                                size="sm"
                                className="text-xs bg-green-600 hover:bg-green-700"
                                disabled={saving === progress._id || uploading === progress._id}
                                onClick={() => updateProgress(progress._id, target._id, "completed")}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {saving === progress._id ? "Saving..." : "Mark Complete"}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs ml-auto"
                              disabled={saving === progress._id || uploading === progress._id}
                              onClick={() => updateProgress(progress._id, target._id, progress.status, feedbackText[progress._id])}
                            >
                              {uploading === progress._id ? "Uploading..." : "Save"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
        </SectionCard>
      )}

      {/* ══════════ RECURRING TARGETS ══════════ */}
      {recurringProgress.length > 0 && (
        <SectionCard
          title="Recurring Targets"
          action={
            <div className="flex items-center gap-2">
              <span className="hidden sm:flex items-center gap-2.5 text-[11px] text-muted-foreground mr-1">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />Done</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-200 border border-gray-300" />Pending</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-200 border border-blue-300" />Now</span>
              </span>
              <button
                onClick={() => setRecurringYear(y => y - 1)}
                className="h-7 w-7 rounded-full border border-border/60 bg-background flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="View previous year"
              >
                &larr;
              </button>
              <span className="text-sm font-bold tracking-tight text-foreground">{recurringYear}</span>
              <button
                onClick={() => setRecurringYear(y => y + 1)}
                className="h-7 w-7 rounded-full border border-border/60 bg-background flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
                disabled={recurringYear >= new Date().getFullYear()}
                aria-label="View next year"
              >
                &rarr;
              </button>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{recurringProgress.length}</Badge>
            </div>
          }
        >
            <div className="space-y-2.5">
              {recurringProgress.map((progress) => {
                const target = progress.personalTarget;
                if (!target) return null;
                const isExpanded = expandedRecurringId === progress._id;
                const freq = target.recurringFrequency || 'monthly';
                const isWeekly = freq === 'weekly';

                // Calculate progress for this target
                const today = new Date();
                const currentMonthIdx = recurringYear === today.getFullYear() ? today.getMonth() : 11;
                let totalSlots = 0;
                let completedSlots = 0;
                if (freq === 'weekly') {
                  for (let m = 0; m <= currentMonthIdx; m++) {
                    const weeks = getWeeksInMonth(recurringYear, m);
                    totalSlots += weeks;
                    for (let w = 1; w <= weeks; w++) {
                      if (findMark(target._id, recurringYear, m + 1, w)?.completed) completedSlots++;
                    }
                  }
                } else {
                  totalSlots = currentMonthIdx + 1;
                  for (let m = 1; m <= currentMonthIdx + 1; m++) {
                    if (findMark(target._id, recurringYear, m, 0)?.completed) completedSlots++;
                  }
                }
                const progressPct = totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0;
                const summaryLabel = `${completedSlots} of ${totalSlots} ${isWeekly ? 'weeks' : 'months'} marked`;

                return (
                  <div key={progress._id} className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                    {/* Header */}
                    <div
                      className="flex items-center gap-2.5 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setExpandedRecurringId(isExpanded ? null : progress._id)}
                    >
                      <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{getCategoryIcon(target.category)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{target.title}</p>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <Badge className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200 shrink-0">
                            <RefreshCw className="h-2.5 w-2.5 mr-1 inline" />
                            {FREQ_LABELS[freq] || freq}
                          </Badge>
                          {target.attendanceNeeded && isAreaAdmin && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-600 border-amber-200 shrink-0">
                              <Users className="h-2.5 w-2.5 mr-1 inline" />
                              Attendance
                            </Badge>
                          )}
                          <span className="text-[11px] font-medium text-foreground/70">{summaryLabel}</span>
                        </div>
                      </div>
                      {/* Progress indicator */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="relative h-9 w-9">
                          <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-100" />
                            <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-500" strokeDasharray={`${progressPct * 0.88} 100`} strokeLinecap="round" />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-green-700">{progressPct}%</span>
                        </div>
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Grid */}
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-border/40">
                        {freq === 'weekly' ? (
                          <div className="mt-3">
                            {/* Month selector pills */}
                            <div className="grid grid-cols-6 gap-1.5 mb-3">
                              {MONTHS_SHORT.map((month, idx) => {
                                const monthNum = idx + 1;
                                const weeksInMonth = getWeeksInMonth(recurringYear, idx);
                                const isSelected = weeklySelectedMonth === monthNum;
                                const isCurrent = recurringYear === today.getFullYear() && monthNum === today.getMonth() + 1;
                                const pillState = getSlotState(recurringYear, monthNum);

                                let monthCompleted = 0;
                                for (let w = 1; w <= weeksInMonth; w++) {
                                  if (findMark(target._id, recurringYear, monthNum, w)?.completed) monthCompleted++;
                                }
                                const allDone = monthCompleted === weeksInMonth && pillState !== 'future';

                                return (
                                  <button
                                    key={monthNum}
                                    onClick={() => setWeeklySelectedMonth(monthNum)}
                                    className={`
                                      py-1.5 rounded-lg text-xs font-semibold transition-all text-center
                                      ${isSelected
                                        ? 'bg-primary text-primary-foreground shadow'
                                        : allDone
                                          ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                                          : isCurrent
                                            ? 'bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100'
                                            : pillState !== 'open'
                                              ? 'bg-muted/40 text-muted-foreground/40'
                                              : 'bg-card text-muted-foreground border border-border hover:bg-muted/60'
                                      }
                                    `}
                                  >
                                    {month}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Week grid for selected month */}
                            {(() => {
                              const selIdx = weeklySelectedMonth - 1;
                              const weeksInMonth = getWeeksInMonth(recurringYear, selIdx);
                              const slotState = getSlotState(recurringYear, weeklySelectedMonth);
                              const monthIsFuture = slotState === 'future';
                              const monthIsExpired = slotState === 'expired';
                              let monthCompleted = 0;
                              for (let w = 1; w <= weeksInMonth; w++) {
                                if (findMark(target._id, recurringYear, weeklySelectedMonth, w)?.completed) monthCompleted++;
                              }

                              return (
                                <>
                                  <p className="mb-2 text-xs text-muted-foreground">
                                    <span className="font-semibold text-foreground">{MONTHS_FULL[selIdx]}</span>
                                    {' '}· {monthCompleted}/{weeksInMonth} weeks{monthIsFuture ? ' · locked' : monthIsExpired ? ' · expired' : ''}
                                  </p>
                                  <div className="grid grid-cols-5 gap-2">
                                    {WEEKLY_SLOTS.map((weekNum) => {
                                      const exists = weekNum <= weeksInMonth;
                                      if (!exists) return <div key={weekNum} />;
                                      const slotKey = `${target._id}-${recurringYear}-${weeklySelectedMonth}-${weekNum}`;
                                      const mark = findMark(target._id, recurringYear, weeklySelectedMonth, weekNum);
                                      const isCompleted = mark?.completed || false;
                                      const isLoading = markingKey === slotKey;
                                      const isFuture = monthIsFuture;
                                      return (
                                        <button
                                          key={weekNum}
                                          onClick={() => {
                                            if (isFuture) return;
                                            if (monthIsExpired) { showExpiredToast(); return; }
                                            handleSlotClick(target, recurringYear, weeklySelectedMonth, weekNum);
                                          }}
                                          disabled={isLoading || isFuture}
                                          className={`
                                            h-11 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1
                                            ${isCompleted
                                              ? 'bg-green-500 text-white shadow-sm'
                                              : isFuture || monthIsExpired
                                                ? 'bg-muted/40 text-muted-foreground/40 cursor-not-allowed'
                                                : 'bg-card text-foreground border border-border hover:border-green-300 hover:bg-green-50 hover:text-green-700 active:scale-95'
                                            }
                                            ${isLoading ? 'opacity-50 animate-pulse' : ''}
                                          `}
                                        >
                                          {isCompleted && <CheckCircle className="h-3.5 w-3.5" />}
                                          W{weekNum}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="mt-3">
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                              {MONTHS_SHORT.map((month, idx) => {
                                const monthNum = idx + 1;
                                const slotKey = `${target._id}-${recurringYear}-${monthNum}-0`;
                                const countKey = `${target._id}-${recurringYear}-${monthNum}-0-count`;
                                const mark = findMark(target._id, recurringYear, monthNum, 0);
                                const isCompleted = mark?.completed || false;
                                const count = mark?.completionCount || (isCompleted ? 1 : 0);
                                const isLoading = markingKey === slotKey || markingKey === countKey;
                                const slotState = getSlotState(recurringYear, monthNum);
                                const isFuture = slotState === 'future';
                                const isExpired = slotState === 'expired';
                                const isCurrent =
                                  recurringYear === today.getFullYear() && monthNum === today.getMonth() + 1;

                                return (
                                  <div key={monthNum} className={`
                                    rounded-lg border overflow-hidden transition-all
                                    ${isCompleted
                                      ? 'border-green-300 bg-green-50'
                                      : isCurrent
                                        ? 'border-blue-300 bg-blue-50/40'
                                        : isFuture || isExpired
                                          ? 'border-border/40 bg-muted/30'
                                          : 'border-border bg-card'
                                    }
                                  `}>
                                    <button
                                      onClick={() => {
                                        if (isFuture) return;
                                        if (isExpired) { showExpiredToast(); return; }
                                        handleSlotClick(target, recurringYear, monthNum, 0);
                                      }}
                                      disabled={isLoading || isFuture}
                                      className={`
                                        w-full px-1 py-2.5 flex flex-col items-center gap-1 transition-all
                                        ${isCompleted
                                          ? 'text-green-700'
                                          : isFuture || isExpired
                                            ? 'text-muted-foreground/40 cursor-not-allowed'
                                            : 'text-foreground hover:bg-green-50 active:scale-95'
                                        }
                                        ${isLoading ? 'opacity-50 animate-pulse' : ''}
                                      `}
                                    >
                                      {isCompleted ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <span className={`h-4 w-4 rounded-full border-2 ${isFuture || isExpired ? 'border-border/40' : isCurrent ? 'border-blue-400' : 'border-border'}`} />
                                      )}
                                      <span className="text-xs font-semibold">{month}</span>
                                      {isExpired && !isCompleted && (
                                        <span className="text-[9px] text-muted-foreground/50">Expired</span>
                                      )}
                                    </button>
                                    {isCompleted && slotState === 'open' && (
                                      <div className="flex items-center justify-center gap-1 pb-1.5 px-1">
                                        <button
                                          onClick={() => adjustCompletionCount(target._id, recurringYear, monthNum, -1)}
                                          disabled={isLoading || count <= 0}
                                          className="h-5 w-5 rounded-full bg-white border border-gray-200 hover:bg-gray-100 text-muted-foreground disabled:opacity-30 inline-flex items-center justify-center transition-colors"
                                        >
                                          <Minus className="h-2.5 w-2.5" />
                                        </button>
                                        <span className="text-[10px] font-bold tabular-nums min-w-[16px] text-center text-green-700">
                                          ×{count}
                                        </span>
                                        <button
                                          onClick={() => adjustCompletionCount(target._id, recurringYear, monthNum, +1)}
                                          disabled={isLoading || count >= 99}
                                          className="h-5 w-5 rounded-full bg-green-100 hover:bg-green-200 text-green-600 disabled:opacity-30 inline-flex items-center justify-center transition-colors"
                                        >
                                          <Plus className="h-2.5 w-2.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Expanded details */}
                        {target.instructions && (
                          <div className="mt-4 rounded-xl bg-muted/50 p-3 text-xs">
                            <p className="font-semibold mb-1 text-muted-foreground">Instructions</p>
                            <p className="text-foreground/80">{target.instructions}</p>
                          </div>
                        )}
                        {target.rewards && (
                          <div className="mt-2 rounded-xl bg-amber-50/80 p-3 text-xs">
                            <p className="font-semibold mb-1 text-amber-700">Rewards</p>
                            <p className="text-amber-900/80">{target.rewards}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
        </SectionCard>
      )}

      {/* ══════════ ATTENDANCE DIALOG ══════════ */}
      <Dialog open={attendanceOpen} onOpenChange={setAttendanceOpen}>
        <DialogContent aria-describedby={undefined} className="glass sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border-border/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {attendanceIsUnmarking
                ? `Unmark ${MONTHS_FULL[attendanceMonth - 1]} ${attendanceYear}`
                : `Mark Attendance - ${MONTHS_FULL[attendanceMonth - 1]} ${attendanceYear}`
              }
            </DialogTitle>
          </DialogHeader>

          {attendanceIsUnmarking ? (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                This will unmark the target completion and clear the attendance for this month. Continue?
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setAttendanceOpen(false)} disabled={savingAttendance}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleUnmarkAttendance}
                  disabled={savingAttendance}
                >
                  {savingAttendance ? "Unmarking..." : "Unmark Month"}
                </Button>
              </div>
            </div>
          ) : loadingMembers ? (
            <ListSkeleton rows={4} />
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Compact single-row header: actions + count */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 px-2.5"
                  onClick={() => {
                    const newMap: Record<string, boolean> = {};
                    Object.keys(attendanceMap).forEach(id => { newMap[id] = true; });
                    setAttendanceMap(newMap);
                  }}
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 px-2.5"
                  onClick={() => {
                    const newMap: Record<string, boolean> = {};
                    Object.keys(attendanceMap).forEach(id => { newMap[id] = false; });
                    setAttendanceMap(newMap);
                  }}
                >
                  Deselect All
                </Button>
                <Badge variant="outline" className="shrink-0 ml-auto">
                  {presentCount}/{totalAttendance} present
                </Badge>
              </div>

              {/* Member list */}
              <div className="overflow-y-auto flex-1 space-y-0.5 pr-1">
                {/* Area Leaders section */}
                {areaLeaders.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-1">Area Leaders</p>
                    {areaLeaders.map(leader => {
                      // Leaders are Users, not Members — show them as info-only (not in attendanceMap)
                      return (
                        <div key={`leader-${leader._id}`} className="flex items-center gap-2 rounded-xl px-2 py-1">
                          <Users className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <div className="flex-1 min-w-0 leading-tight">
                            <p className="text-[13px] font-medium truncate leading-tight">{leader.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate leading-tight">{leader.roleTag?.roleDescription || leader.roleTag?.name || 'Area'} - {leader.phone}</p>
                          </div>
                          <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 shrink-0">Leader</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Members section */}
                {areaMembers.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-1">
                      Members ({areaMembers.length}{memberTotal > areaMembers.length ? ` of ${memberTotal}` : ''})
                    </p>
                    {areaMembers.map(member => (
                      <label
                        key={member._id}
                        className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-muted/60 cursor-pointer"
                      >
                        <Checkbox
                          className="h-3.5 w-3.5 shrink-0"
                          checked={attendanceMap[member._id] || false}
                          onCheckedChange={(checked) => {
                            setAttendanceMap(prev => ({
                              ...prev,
                              [member._id]: Boolean(checked)
                            }));
                          }}
                        />
                        <div className="flex-1 min-w-0 leading-tight">
                          <p className="text-[13px] font-medium truncate leading-tight">{member.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate leading-tight">
                            {member.group?.name || 'No group'} - {member.phone}
                          </p>
                        </div>
                        {member.isLeader && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 shrink-0">
                            {member.roleTag?.name || 'Leader'}
                          </Badge>
                        )}
                      </label>
                    ))}
                    {memberHasMore && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2 text-xs"
                        onClick={loadMoreMembers}
                        disabled={loadingMoreMembers}
                      >
                        {loadingMoreMembers ? "Loading..." : `Load More (${areaMembers.length} of ${memberTotal})`}
                      </Button>
                    )}
                  </div>
                )}

                {areaMembers.length === 0 && areaLeaders.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No members found in your area</p>
                )}
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4 mt-3 border-t">
                <Button variant="outline" onClick={() => setAttendanceOpen(false)} disabled={savingAttendance}>
                  Cancel
                </Button>
                <Button
                  onClick={submitAttendance}
                  disabled={savingAttendance}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {savingAttendance ? "Saving..." : "Mark Complete with Attendance"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserTargetsSection;
