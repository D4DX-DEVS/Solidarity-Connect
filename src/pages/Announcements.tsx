import { useState, useEffect, useCallback } from "react";
import { Megaphone, ChevronLeft, Plus, Paperclip, X, Send, FileText, Image, Film, Search, ChevronRight, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { uploadsAPI, notificationsAPI } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

const AUDIENCE_OPTIONS = [
  { value: "all", label: "All Users", description: "Everyone in the system" },
  { value: "state_admins", label: "State Admins", description: "State-level administrators" },
  { value: "district_admins", label: "District Admins", description: "District-level administrators" },
  { value: "group_admins", label: "Area Admins", description: "Group-level administrators" },
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

const Announcements = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRole } = useAuth();
  const isStateAdmin = userRole === 'state_admin';

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(["all"]);
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
      const params: Record<string, any> = {
        type: "announcement",
        limit: 10,
        page: currentPage,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (audienceFilter && audienceFilter !== "all") params.audienceFilter = audienceFilter;
      const result = await notificationsAPI.getNotifications(params);
      setAnnouncements(result.data || []);
      if (result.pagination) {
        setTotalPages(result.pagination.totalPages || 1);
        setHasNextPage(result.pagination.hasNextPage || false);
        setHasPrevPage(result.pagination.hasPrevPage || false);
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
    if (selectedAudiences.length === 0) {
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

      // Determine primary targetAudience for backward compat
      const primaryAudience = selectedAudiences.includes("all") ? "all" : selectedAudiences[0];

      await notificationsAPI.createNotification({
        title: title.trim(),
        message: description.trim(),
        type: "announcement",
        priority: "high",
        status: "sent",
        targetAudience: primaryAudience,
        targetAudiences: selectedAudiences,
        channels: ["in_app"],
        attachments,
      });

      toast({ title: "Success", description: "Announcement sent successfully" });

      // Reset form
      setTitle("");
      setDescription("");
      setSelectedAudiences(["all"]);
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
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="bg-primary p-2 rounded-lg">
            <Megaphone className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Announcements</h1>
            <p className="text-sm text-muted-foreground">Send announcements to users</p>
          </div>
          {isStateAdmin && (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-1" />}
              {showForm ? "" : "New"}
            </Button>
          )}
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Create Form */}
        {isStateAdmin && showForm && (
          <Card className="shadow-sm border-primary/30">
            <CardContent className="p-4 space-y-4">
              <h2 className="font-semibold text-base">New Announcement</h2>

              {/* Title */}
              <div className="space-y-1">
                <Label htmlFor="ann-title">Title *</Label>
                <Input
                  id="ann-title"
                  placeholder="Announcement title…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label htmlFor="ann-desc">Description *</Label>
                <Textarea
                  id="ann-desc"
                  placeholder="Write your announcement…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground text-right">{description.length}/1000</p>
              </div>

              {/* File attachments */}
              <div className="space-y-2">
                <Label>Attachments (optional)</Label>
                <div className="flex items-center gap-2">
                  <label htmlFor="ann-files" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors">
                      <Paperclip className="h-4 w-4" />
                      Attach files
                    </div>
                    <input
                      id="ann-files"
                      type="file"
                      multiple
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                  <span className="text-xs text-muted-foreground">Max 20 MB per file</span>
                </div>

                {attachedFiles.length > 0 && (
                  <div className="space-y-2">
                    {attachedFiles.map((af, i) => {
                      const Icon = getFileIcon(af.file.type);
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm"
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

              {/* Target audience */}
              <div className="space-y-2">
                <Label>Send to *</Label>
                <div className="space-y-2">
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <div key={opt.value} className="flex items-start gap-3">
                      <Checkbox
                        id={`audience-${opt.value}`}
                        checked={selectedAudiences.includes(opt.value)}
                        onCheckedChange={() => toggleAudience(opt.value)}
                      />
                      <div>
                        <Label
                          htmlFor={`audience-${opt.value}`}
                          className="font-medium cursor-pointer"
                        >
                          {opt.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{opt.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={submitting || attachedFiles.some((f) => f.uploading)}
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Announcement
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Past Announcements */}
        <div>
          <h2 className="font-semibold mb-3">Past Announcements</h2>

          {/* Search + Filter row */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search announcements…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
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
          </div>
          {loadingList ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : announcements.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="p-8 text-center">
                <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No announcements yet</p>
                {isStateAdmin && (
                  <Button className="mt-4" size="sm" onClick={() => setShowForm(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Create first announcement
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => (
                <Card key={ann._id} className="shadow-sm">
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
            <div className="flex items-center justify-between py-2 mt-3">
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
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Announcements;
