import { useState, useEffect, useRef } from "react";
import {
  FileText, Film, Music, Upload, Trash2, Edit, ArrowLeft,
  Download, BookOpen, Book, File, Plus, Save, X, Eye, EyeOff, Search
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { apiCall, multipartApiCall } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
import { getHomeRouteByRole } from "@/lib/roleRoutes";

interface OrgFile {
  _id: string;
  title: string;
  description?: string;
  category: string;
  fileType: "general" | "membership_form";
  url: string;
  originalName: string;
  mimetype: string;
  size: number;
  isActive: boolean;
  uploadedBy?: { name: string; role: string };
  createdAt: string;
}

const categoryLabels: Record<string, string> = {
  constitution: "Constitution",
  guidelines: "Guidelines",
  video: "Video",
  audio: "Audio",
  document: "Document",
  other: "Other"
};

const categoryIcons: Record<string, React.ElementType> = {
  constitution: BookOpen,
  guidelines: Book,
  video: Film,
  audio: Music,
  document: FileText,
  other: File
};

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
};

const isAreaAdmin = (user: any) =>
  user?.role === "group_admin" && user?.roleTag?.type === "area";

const OrgFiles = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isStateAdmin = user?.role === "state_admin";
  // All group_admin users (area and local) can see membership forms
  const canSeeMembershipForm = isStateAdmin || user?.role === "group_admin";

  const [files, setFiles] = useState<OrgFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingFile, setEditingFile] = useState<OrgFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    category: "document",
    fileType: "general" as "general" | "membership_form"
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: "document",
    fileType: "general" as "general" | "membership_form",
    isActive: true
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    fetchFiles();
  }, [activeCategory, debouncedSearch]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (activeCategory && activeCategory !== "all") {
        if (activeCategory === "membership_form") {
          params.fileType = "membership_form";
        } else {
          params.category = activeCategory;
        }
      }
      if (debouncedSearch) params.search = debouncedSearch;
      const queryString = new URLSearchParams(params).toString();
      const result = await apiCall(`/org-files${queryString ? `?${queryString}` : ""}`);
      setFiles(result.data || []);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load files", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.title) {
      toast({ title: "Error", description: "Please provide a title and select a file", variant: "destructive" });
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", uploadForm.title);
      formData.append("description", uploadForm.description);
      formData.append("category", uploadForm.category);
      formData.append("fileType", uploadForm.fileType);

      await multipartApiCall("/org-files", formData);
      toast({ title: "File Uploaded", description: "File has been uploaded successfully." });
      setShowUploadDialog(false);
      setSelectedFile(null);
      setUploadForm({ title: "", description: "", category: "document", fileType: "general" });
      await fetchFiles();
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message || "Failed to upload file", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = async () => {
    if (!editingFile) return;
    try {
      setSaving(true);
      await apiCall(`/org-files/${editingFile._id}`, {
        method: "PUT",
        body: JSON.stringify(editForm)
      });
      toast({ title: "Updated", description: "File metadata updated successfully." });
      setShowEditDialog(false);
      setEditingFile(null);
      await fetchFiles();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update file", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (file: OrgFile) => {
    if (!window.confirm(`Delete "${file.title}"?`)) return;
    try {
      await apiCall(`/org-files/${file._id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: "File deleted successfully." });
      await fetchFiles();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete file", variant: "destructive" });
    }
  };

  const openEditDialog = (file: OrgFile) => {
    setEditingFile(file);
    setEditForm({
      title: file.title,
      description: file.description || "",
      category: file.category,
      fileType: file.fileType,
      isActive: file.isActive
    });
    setShowEditDialog(true);
  };

  const filteredFiles = files.filter(f => {
    if (!f.isActive && !isStateAdmin) return false;
    return true;
  });

  const categories = ["all", "constitution", "guidelines", "video", "audio", "document", "other", ...(canSeeMembershipForm ? ["membership_form"] : [])];

  const getBackPath = () => {
    return getHomeRouteByRole(user?.role);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(getBackPath())}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Organizational Files</h1>
            <p className="text-sm text-muted-foreground">Documents, Videos & Audio Resources</p>
          </div>
          {isStateAdmin && (
            <Button size="sm" onClick={() => setShowUploadDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Upload
            </Button>
          )}
        </div>
      </header>

      {/* Category Filter */}
      <div className="px-4 pt-3 pb-1 flex gap-2 overflow-x-auto">
        {categories.map(cat => (
          <Button
            key={cat}
            variant={activeCategory === cat ? "default" : "outline"}
            size="sm"
            className="shrink-0 capitalize"
            onClick={() => setActiveCategory(cat)}
          >
            {cat === "all" ? "All" : cat === "membership_form" ? "Membership Form" : categoryLabels[cat] || cat}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files by title, description…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <main className="p-4 space-y-3 org-files-malayalam">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading files...</div>
        ) : filteredFiles.length === 0 ? (
          <Card className="p-8 text-center shadow-sm">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-semibold">No files found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {isStateAdmin ? "Upload your first file using the button above." : "No files have been uploaded yet."}
            </p>
          </Card>
        ) : (
          filteredFiles.map(file => {
            const Icon = categoryIcons[file.category] || File;
            const isMembershipForm = file.fileType === "membership_form";
            return (
              <Card key={file._id} className={`shadow-sm ${!file.isActive ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${isMembershipForm ? "bg-yellow-100" : "bg-primary/10"}`}>
                      <Icon className={`h-5 w-5 ${isMembershipForm ? "text-yellow-700" : "text-primary"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-medium text-sm malayalam-text">{file.title}</p>
                            {!file.isActive && (
                              <Badge variant="secondary" className="text-xs">Hidden</Badge>
                            )}
                          </div>
                          {file.description && (
                            <p className="text-xs text-muted-foreground mb-1 malayalam-text">{file.description}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs capitalize">
                              {isMembershipForm ? "Membership Form" : categoryLabels[file.category] || file.category}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                            <span className="text-xs text-muted-foreground malayalam-text">{file.originalName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3 flex-wrap">
                        <a href={file.url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="text-xs h-7">
                            {isMembershipForm ? (
                              <><Download className="h-3 w-3 mr-1" />Download</>
                            ) : (
                              <><Eye className="h-3 w-3 mr-1" />View</>
                            )}
                          </Button>
                        </a>
                        {isMembershipForm && (
                          <a href={file.url} download>
                            <Button size="sm" variant="default" className="text-xs h-7">
                              <Download className="h-3 w-3 mr-1" />Download PDF
                            </Button>
                          </a>
                        )}
                        {isStateAdmin && (
                          <>
                            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => openEditDialog(file)}>
                              <Edit className="h-3 w-3 mr-1" />Edit
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className="text-xs h-7 text-destructive"
                              onClick={() => handleDelete(file)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Upload Organizational File</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                placeholder="File title"
                value={uploadForm.title}
                onChange={e => setUploadForm(p => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Optional description"
                className="min-h-[60px]"
                value={uploadForm.description}
                onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select value={uploadForm.category} onValueChange={v => setUploadForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="constitution">Constitution</SelectItem>
                    <SelectItem value="guidelines">Guidelines</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">File Type</label>
                <Select value={uploadForm.fileType} onValueChange={v => setUploadForm(p => ({ ...p, fileType: v as "general" | "membership_form" }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General (All Users)</SelectItem>
                    <SelectItem value="membership_form">Membership Form (Area Admin only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">File *</label>
              <div
                className="mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm truncate">{selectedFile.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); setSelectedFile(null); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to select file</p>
                    <p className="text-xs text-muted-foreground">PDF, DOC, MP4, MP3, WAV up to 50MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.mp4,.mpeg,.mp3,.wav,.ogg,.txt,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={uploading}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading || !selectedFile || !uploadForm.title}>
              {uploading ? "Uploading..." : <><Upload className="h-4 w-4 mr-1" />Upload</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Edit File</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea className="min-h-[60px]" value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select value={editForm.category} onValueChange={v => setEditForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="constitution">Constitution</SelectItem>
                    <SelectItem value="guidelines">Guidelines</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">File Type</label>
                <Select value={editForm.fileType} onValueChange={v => setEditForm(p => ({ ...p, fileType: v as "general" | "membership_form" }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="membership_form">Membership Form</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={editForm.isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setEditForm(p => ({ ...p, isActive: !p.isActive }))}
              >
                {editForm.isActive ? <><Eye className="h-4 w-4 mr-1" />Visible</> : <><EyeOff className="h-4 w-4 mr-1" />Hidden</>}
              </Button>
              <span className="text-xs text-muted-foreground">Toggle visibility for all users</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? "Saving..." : <><Save className="h-4 w-4 mr-1" />Save Changes</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrgFiles;
