import { useState, useEffect, useRef } from "react";
import {
  Target, CheckCircle, Clock, AlertCircle, MessageSquare,
  ChevronDown, ChevronUp, Paperclip, Upload, X, FileText, Image, Film, RefreshCw
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { apiCall, uploadsAPI } from "@/utils/api";

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
  completed: boolean;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const statusConfig = {
  not_started: { label: "Not Started", icon: AlertCircle, color: "text-muted-foreground", badge: "secondary" as const },
  in_progress: { label: "In Progress", icon: Clock, color: "text-blue-500", badge: "default" as const },
  completed: { label: "Completed", icon: CheckCircle, color: "text-green-500", badge: "default" as const },
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'quran': return '📖';
    case 'hadith': return '📚';
    case 'prayer': return '🤲';
    case 'charity': return '💝';
    case 'knowledge': return '🎓';
    case 'community': return '🤝';
    default: return '🎯';
  }
};

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

const UserTargetsSection = () => {
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
      // Endpoint may not exist yet — fail silently
      console.error("Failed to fetch recurring marks:", error);
    }
  };

  const toggleRecurringMark = async (targetId: string, year: number, month: number) => {
    const key = `${targetId}-${year}-${month}`;
    const existing = recurringMarks.find(m => m.targetId === targetId && m.year === year && m.month === month);
    const newCompleted = !existing?.completed;
    setMarkingKey(key);
    // Optimistic update
    setRecurringMarks(prev => {
      const filtered = prev.filter(m => !(m.targetId === targetId && m.year === year && m.month === month));
      return [...filtered, { targetId, year, month, completed: newCompleted }];
    });
    try {
      await apiCall("/recurring-marks", {
        method: "POST",
        body: JSON.stringify({ targetId, year, month, completed: newCompleted }),
      });
    } catch {
      // Revert on failure
      setRecurringMarks(prev => {
        const filtered = prev.filter(m => !(m.targetId === targetId && m.year === year && m.month === month));
        if (existing) return [...filtered, existing];
        return filtered;
      });
      toast({ title: "Error", description: "Failed to update mark", variant: "destructive" });
    } finally {
      setMarkingKey(null);
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
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">My Targets</h2>
          </div>
          <p className="text-sm text-muted-foreground">Loading targets...</p>
        </CardContent>
      </Card>
    );
  }

  // ── Split regular vs recurring ───────────────────────────
  const regularProgress = progressList.filter(p => !p.personalTarget?.isRecurring);
  const recurringProgress = progressList.filter(p => p.personalTarget?.isRecurring);

  if (progressList.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">My Targets</h2>
          </div>
          <p className="text-sm text-muted-foreground">No targets assigned to you yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">

      {/* ══════════ REGULAR TARGETS ══════════ */}
      {regularProgress.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">My Targets</h2>
              </div>
              <Badge variant="outline">{regularProgress.length}</Badge>
            </div>

            <div className="space-y-3">
              {regularProgress.map((progress) => {
                const target = progress.personalTarget;
                if (!target) return null;
                const cfg = statusConfig[progress.status];
                const StatusIcon = cfg.icon;
                const isExpanded = expandedId === progress._id;

                return (
                  <Card key={progress._id} className="border">
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
                            <div className="bg-muted/50 p-2 rounded text-xs">
                              <p className="font-medium mb-1">Instructions:</p>
                              <p>{target.instructions}</p>
                            </div>
                          )}
                          {target.rewards && (
                            <div className="bg-yellow-50 p-2 rounded text-xs">
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
                              <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs">
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
          </CardContent>
        </Card>
      )}

      {/* ══════════ RECURRING TARGETS ══════════ */}
      {recurringProgress.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-500" />
                <h2 className="font-semibold">Recurring Targets</h2>
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {recurringProgress.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Tick each month/period you completed the target. You can mark or unmark anytime.
            </p>

            {/* Year selector */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setRecurringYear(y => y - 1)}
                className="px-2 py-1 rounded border text-xs hover:bg-muted"
              >
                ←
              </button>
              <span className="text-sm font-semibold w-12 text-center">{recurringYear}</span>
              <button
                onClick={() => setRecurringYear(y => y + 1)}
                className="px-2 py-1 rounded border text-xs hover:bg-muted"
                disabled={recurringYear >= new Date().getFullYear()}
              >
                →
              </button>
            </div>

            <div className="space-y-4">
              {recurringProgress.map((progress) => {
                const target = progress.personalTarget;
                if (!target) return null;
                const isExpanded = expandedRecurringId === progress._id;
                const freq = target.recurringFrequency || 'monthly';

                return (
                  <Card key={progress._id} className="border border-blue-100">
                    <CardContent className="p-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          <span className="text-xl shrink-0">{getCategoryIcon(target.category)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <p className="font-medium text-sm truncate">{target.title}</p>
                              <Badge className="text-xs bg-blue-100 text-blue-700 shrink-0">
                                <RefreshCw className="h-2.5 w-2.5 mr-1 inline" />
                                {FREQ_LABELS[freq] || freq}
                              </Badge>
                            </div>
                            {target.instructions && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{target.instructions}</p>
                            )}
                          </div>
                        </div>
                        <button
                          className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                          onClick={() => setExpandedRecurringId(isExpanded ? null : progress._id)}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Month grid — always visible */}
                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Mark completed months:</p>
                        <div className="grid grid-cols-6 gap-1.5">
                          {MONTHS_SHORT.map((month, idx) => {
                            const monthNum = idx + 1;
                            const key = `${target._id}-${recurringYear}-${monthNum}`;
                            const mark = recurringMarks.find(
                              m => m.targetId === target._id && m.year === recurringYear && m.month === monthNum
                            );
                            const isCompleted = mark?.completed || false;
                            const isLoading = markingKey === key;
                            const isFuture = recurringYear === new Date().getFullYear() && monthNum > new Date().getMonth() + 1;

                            return (
                              <button
                                key={monthNum}
                                onClick={() => !isFuture && toggleRecurringMark(target._id, recurringYear, monthNum)}
                                disabled={isLoading || isFuture}
                                title={isFuture ? 'Future month' : `${month} ${recurringYear}`}
                                className={`
                                  h-9 rounded-lg text-xs font-medium transition-all border
                                  ${isCompleted
                                    ? 'bg-green-500 border-green-500 text-white shadow-sm'
                                    : isFuture
                                      ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                                      : 'bg-white border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
                                  }
                                  ${isLoading ? 'opacity-60 cursor-wait' : ''}
                                `}
                              >
                                {isCompleted ? '✓' : month}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Expanded: instructions / rewards */}
                      {isExpanded && (
                        <div className="mt-3 space-y-2 border-t pt-3">
                          {target.instructions && (
                            <div className="bg-muted/50 p-2 rounded text-xs">
                              <p className="font-medium mb-1">Instructions:</p>
                              <p>{target.instructions}</p>
                            </div>
                          )}
                          {target.rewards && (
                            <div className="bg-yellow-50 p-2 rounded text-xs">
                              <p className="font-medium mb-1">Rewards:</p>
                              <p>{target.rewards}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UserTargetsSection;
