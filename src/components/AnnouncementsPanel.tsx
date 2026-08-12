import { useState, useEffect, useCallback } from "react";
import { Megaphone, ChevronLeft, Plus, X, Send, FileText, Image, Film, Search, ChevronRight, Filter, Check, UploadCloud } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SectionCard } from "@/components/app/AppShell";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { uploadsAPI, notificationsAPI, memberAuthAPI } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

const AUDIENCE_OPTIONS = [
  { value: "all", label: "All Users", description: "Everyone in the system" },
  { value: "state_admins", label: "State Admins", description: "State-level administrators" },
  { value: "district_admins", label: "District Admins", description: "District-level administrators" },
  { value: "group_admins", label: "Area Admins (Murabbi)", description: "Area-level administrators" },
  { value: "members", label: "Members", description: "All registered members" },
];

interface AttachedFile {
  file: File;
  url?: string;
  uploading: boolean;
  error?: string;
  previewUrl?: string;
}

interface Announcement {
  _id: string;
  title: string;
  message: string;
  targetAudiences: string[];
  targetAudience: string;
  attachments: { url: string; originalName?: string; mimetype?: string }[];
  createdAt: string;
  status: string;
  createdBy?: { name: string };
}

const getFileIcon = (mimetype: string) => {
  if (mimetype?.startsWith("image/")) return Image;
  if (mimetype?.startsWith("video/")) return Film;
  return FileText;
};

/** Announcements list + create form. Rendered inside the merged Alerts page. */
const AnnouncementsPanel = () => {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const isStateAdmin = userRole === 'state_admin';
  const isDistrictAdmin = userRole === 'district_admin';
  const isGroupAdmin = userRole === 'group_admin';
  const canCreate = isStateAdmin || isDistrictAdmin || isGroupAdmin;

  // District admins only announce downward (area/unit admins, members),
  // scoped to their own district — the backend enforces both.
  const audienceOptions = isDistrictAdmin
    ? AUDIENCE_OPTIONS.filter((o) => o.value === 'group_admins' || o.value === 'members')
    : AUDIENCE_OPTIONS;
  const defaultAudiences = isDistrictAdmin ? ['members'] : ['all'];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(defaultAudiences);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset page on filter/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, audienceFilter]);

  const fetchAnnouncements = useCallback(async () => {
    setLoadingList(true);
    try {
      // ponytail: single alerts surface — list every notification type together
      const params: Record<string, any> = {
        limit: 10,
        page: currentPage,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (audienceFilter && audienceFilter !== "all") params.audienceFilter = audienceFilter;
      const userType = localStorage.getItem('userType');
      const result = userType === 'member'
        ? await memberAuthAPI.getNotifications(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])))
        : await notificationsAPI.getNotifications(params);
      if (userType === 'member') {
        setAnnouncements(result.data?.notifications || []);
        if (result.data?.pagination) {
          setTotalPages(result.data.pagination.totalPages || 1);
          setHasNextPage(result.data.pagination.hasNext || false);
          setHasPrevPage(result.data.pagination.hasPrev || false);
        }
      } else {
        setAnnouncements(result.data || []);
        if (result.pagination) {
          setTotalPages(result.pagination.totalPages || 1);
          setHasNextPage(result.pagination.hasNextPage || false);
          setHasPrevPage(result.pagination.hasPrevPage || false);
        }
      }
    } catch {
      // silently fail for list
    } finally {
      setLoadingList(false);
    }
  }, [currentPage, debouncedSearch, audienceFilter]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const toggleAudience = (value: string) => {
    setSelectedAudiences((prev) => {
      if (value === "all") {
        // Selecting "all" clears others
        return prev.includes("all") ? [] : ["all"];
      }
      // Deselect "all" if something specific is selected
      const withoutAll = prev.filter((a) => a !== "all");
      if (withoutAll.includes(value)) {
        return withoutAll.filter((a) => a !== value);
      }
      return [...withoutAll, value];
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newAttachments: AttachedFile[] = files.map((f) => ({
      file: f,
      uploading: true,
      previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
    }));

    setAttachedFiles((prev) => [...prev, ...newAttachments]);

    // Upload each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const result = await uploadsAPI.uploadFile(file);
        setAttachedFiles((prev) =>
          prev.map((af) =>
            af.file === file ? { ...af, url: result.data.url, uploading: false } : af
          )
        );
      } catch (error: any) {
        setAttachedFiles((prev) =>
          prev.map((af) =>
            af.file === file
              ? { ...af, uploading: false, error: error.message || "Upload failed" }
              : af
          )
        );
      }
    }

    // Reset the input value so the same file can be selected again
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => {
      const removed = prev[index];
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Validation", description: "Title is required", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Validation", description: "Description is required", variant: "destructive" });
      return;
    }
    if (!isGroupAdmin && selectedAudiences.length === 0) {
      toast({ title: "Validation", description: "Select at least one audience", variant: "destructive" });
      return;
    }

    const stillUploading = attachedFiles.some((f) => f.uploading);
    if (stillUploading) {
      toast({ title: "Please wait", description: "Files are still uploading…", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const attachments = attachedFiles
        .filter((f) => f.url)
        .map((f) => ({
          url: f.url!,
          originalName: f.file.name,
          mimetype: f.file.type,
          size: f.file.size,
        }));

      // Determine primary targetAudience for backward compat.
      // Group admins send anything — backend forces scope to their own group.
      const primaryAudience = isGroupAdmin
        ? "specific_groups"
        : selectedAudiences.includes("all") ? "all" : selectedAudiences[0];

      await notificationsAPI.createNotification({
        title: title.trim(),
        message: description.trim(),
        type: "announcement",
        priority: "high",
        status: "sent",
        targetAudience: primaryAudience,
        targetAudiences: isGroupAdmin ? [] : selectedAudiences,
        channels: ["in_app"],
        attachments,
      });

      toast({ title: "Success", description: "Announcement sent successfully" });

      // Reset form
      setTitle("");
      setDescription("");
      setSelectedAudiences(defaultAudiences);
      setAttachedFiles([]);
      setShowForm(false);
      fetchAnnouncements();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send announcement", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const audienceLabel = (audiences: string[], singleAudience?: string) => {
    const arr = audiences?.length > 0 ? audiences : (singleAudience ? [singleAudience] : []);
    if (arr.includes("all")) return "All Users";
    if (arr.length === 0 || arr.includes("specific_groups")) return "Area Members";
    return arr
      .map((a) => AUDIENCE_OPTIONS.find((o) => o.value === a)?.label || a)
      .join(", ");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4">
        {/* Create Form */}
        {canCreate && showForm && (
          <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
          <SectionCard
            title="New Announcement"
            description={isGroupAdmin
              ? "Write a message and attach files. It will be sent to your area's members."
              : "Write a message, attach files, and choose the audience."}
          >

              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="ann-title">Title *</Label>
                <Input
                  id="ann-title"
                  placeholder="Announcement title…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  className="h-11"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ann-desc">Message *</Label>
                  <span className={`text-xs tabular-nums ${description.length > 900 ? "text-destructive" : "text-muted-foreground"}`}>
                    {description.length}/1000
                  </span>
                </div>
                <Textarea
                  id="ann-desc"
                  placeholder="Write your announcement…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={1000}
                  className="resize-none"
                />
              </div>

              {/* File attachments */}
              <div className="space-y-2">
                <Label htmlFor="ann-files">
                  Attachments <span className="font-normal text-muted-foreground">(optional · max 20 MB each)</span>
                </Label>
                <label
                  htmlFor="ann-files"
                  className="group flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border/80 bg-muted/40 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <UploadCloud className="h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary" />
                  <span className="text-sm font-medium">Tap to attach files</span>
                  <span className="text-xs text-muted-foreground">Images, video, PDF, Word, Excel</span>
                  <input
                    id="ann-files"
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>

                {attachedFiles.length > 0 && (
                  <div className="space-y-2">
                    {attachedFiles.map((af, i) => {
                      const Icon = getFileIcon(af.file.type);
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-2.5 text-sm shadow-sm animate-in fade-in-0 duration-200"
                        >
                          {af.previewUrl ? (
                            <img
                              src={af.previewUrl}
                              alt={af.file.name}
                              className="h-8 w-8 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="truncate">{af.file.name}</p>
                            {af.uploading && (
                              <p className="text-xs text-primary">Uploading…</p>
                            )}
                            {af.error && (
                              <p className="text-xs text-destructive">{af.error}</p>
                            )}
                            {af.url && !af.uploading && (
                              <p className="text-xs text-success">Uploaded ✓</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(i)}
                            className="h-6 w-6 p-0 flex-shrink-0"
                            disabled={af.uploading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Target audience (state/district admin picks; group admin fixed to own area) */}
              {!isGroupAdmin && (
              <div className="space-y-2">
                <Label>Send to *</Label>
                <div className="flex flex-wrap gap-2">
                  {audienceOptions.map((opt) => {
                    const selected = selectedAudiences.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleAudience(opt.value)}
                        aria-pressed={selected}
                        title={opt.description}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedAudiences.length === 0
                    ? "Pick at least one audience."
                    : `Sending to: ${audienceLabel(selectedAudiences)}`}
                </p>
              </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  className="h-11 flex-1"
                  onClick={handleSubmit}
                  disabled={
                    submitting ||
                    attachedFiles.some((f) => f.uploading) ||
                    (!isGroupAdmin && selectedAudiences.length === 0)
                  }
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Announcement
                </Button>
                <Button variant="outline" className="h-11" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
          </SectionCard>
          </div>
        )}

        {/* Past Announcements */}
        <SectionCard
          title="Alerts & Announcements"
          description="Search and review everything that has been sent."
          action={canCreate ? (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-1" />}
              {showForm ? "Close" : "New"}
            </Button>
          ) : undefined}
        >

          {/* Search + Filter row */}
          <div className="flex flex-col gap-2 mb-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search announcements…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {canCreate && (
              <Select value={audienceFilter} onValueChange={setAudienceFilter}>
                <SelectTrigger className="w-40 flex-shrink-0">
                  <Filter className="h-4 w-4 mr-1 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Audiences</SelectItem>
                  <SelectItem value="members">Members Only</SelectItem>
                  <SelectItem value="group_admins">Area Admins</SelectItem>
                  <SelectItem value="district_admins">District Admins</SelectItem>
                  <SelectItem value="state_admins">State Admins</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          {loadingList ? (
            <ListSkeleton rows={4} />
          ) : announcements.length === 0 ? (
            <div className="p-8 text-center">
              <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No announcements yet</p>
              {canCreate && (
                <Button className="mt-4" size="sm" onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Create first announcement
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => (
                <Card key={ann._id} className="surface-card transition-all hover:-translate-y-0.5">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{ann.title}</p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                          {ann.message}
                        </p>
                      </div>
                      <Badge
                        variant={ann.status === "sent" ? "default" : "outline"}
                        className="flex-shrink-0 text-xs"
                      >
                        {ann.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {audienceLabel(ann.targetAudiences, ann.targetAudience)}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        {formatDate(ann.createdAt)}
                      </Badge>
                    </div>

                    {ann.attachments && ann.attachments.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">Attachments:</p>
                          {ann.attachments.map((att, i) => {
                            const Icon = getFileIcon(att.mimetype || "");
                            return (
                              <a
                                key={i}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                              >
                                <Icon className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate">{att.originalName || `File ${i + 1}`}</span>
                              </a>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="data-strip flex items-center justify-between py-4 mt-3">
              <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p - 1)}
                  disabled={!hasPrevPage || loadingList}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={!hasNextPage || loadingList}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </SectionCard>
    </div>
  );
};

export default AnnouncementsPanel;
