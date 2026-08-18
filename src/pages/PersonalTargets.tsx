import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiCall } from "@/utils/api";
import { Target, Plus, Edit, Trash2, ArrowLeft, Search, RefreshCw, AlertTriangle } from "lucide-react";
import { PiBookOpenTextFill, PiBooksFill, PiHandsPrayingFill, PiHeartFill, PiGraduationCapFill, PiHandshakeFill, PiTargetFill } from "react-icons/pi";

interface PersonalTarget {
  _id: string;
  title: string;
  description: string;
  category: string;
  targetAudience: string;
  status: string;
  startDate: string;
  endDate: string;
  instructions?: string;
  rewards?: string;
  isRecurring?: boolean;
  recurringFrequency?: string;
  attendanceNeeded?: boolean;
  createdBy: { name: string; role: string };
  createdAt: string;
}

// Format a Date to "yyyy-MM-ddTHH:mm" for datetime-local input
const toDatetimeLocal = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const defaultStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toDatetimeLocal(d);
};

const defaultEnd = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  d.setHours(23, 59, 0, 0);
  return toDatetimeLocal(d);
};

const PersonalTargets = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const { toast } = useToast();

  const canManageTargets = userRole === 'state_admin';

  // ── Tab state ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'regular' | 'recurring'>('regular');

  // ── Regular targets state ──────────────────────────────────
  const [targets, setTargets] = useState<PersonalTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<PersonalTarget | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other',
    startDate: defaultStart(),
    endDate: defaultEnd(),
    active: true,
    targetAudience: 'all_users' as string,
    instructions: '',
    rewards: '',
  });

  // ── Recurring targets state ────────────────────────────────
  const [recurringTargets, setRecurringTargets] = useState<PersonalTarget[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<PersonalTarget | null>(null);
  const [recurringPage, setRecurringPage] = useState(1);
  const [recurringTotalPages, setRecurringTotalPages] = useState(1);
  const [recurringSearch, setRecurringSearch] = useState("");
  const [debouncedRecurringSearch, setDebouncedRecurringSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("");
  const [recurringAudienceFilter, setRecurringAudienceFilter] = useState("");
  const [deleteRequest, setDeleteRequest] = useState<{ id: string; recurring: boolean } | null>(null);

  const [recurringForm, setRecurringForm] = useState({
    title: '',
    category: 'other',
    targetAudience: 'all_users' as string,
    recurringFrequency: 'monthly' as string,
    instructions: '',
    rewards: '',
    active: true,
    attendanceNeeded: false,
  });

  // ── Debounce ────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedRecurringSearch(recurringSearch), 400);
    return () => clearTimeout(t);
  }, [recurringSearch]);

  useEffect(() => { fetchData(1); }, [debouncedSearch, audienceFilter]);
  useEffect(() => { fetchRecurringData(1); }, [debouncedRecurringSearch, recurringAudienceFilter]);

  // ── Fetch regular targets ───────────────────────────────────
  const fetchData = async (page = currentPage) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '9');
      params.set('isRecurring', 'false');
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (audienceFilter) params.set('targetAudience', audienceFilter);
      const res = await apiCall(`/personal-targets?${params.toString()}`);
      // Filter client-side in case backend ignores isRecurring param
      const filtered = (res.data || []).filter((t: PersonalTarget) => !t.isRecurring);
      setTargets(filtered);
      setCurrentPage(res.pagination?.currentPage ?? page);
      setTotalPages(res.pagination?.totalPages ?? 1);
    } catch {
      toast({ title: "Error", description: "Failed to load targets", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch recurring targets ─────────────────────────────────
  const fetchRecurringData = async (page = recurringPage) => {
    try {
      setRecurringLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '9');
      params.set('isRecurring', 'true');
      if (debouncedRecurringSearch.trim()) params.set('search', debouncedRecurringSearch.trim());
      if (recurringAudienceFilter) params.set('targetAudience', recurringAudienceFilter);
      const res = await apiCall(`/personal-targets?${params.toString()}`);
      // Filter client-side in case backend ignores isRecurring param
      const filtered = (res.data || []).filter((t: PersonalTarget) => t.isRecurring);
      setRecurringTargets(filtered);
      setRecurringPage(res.pagination?.currentPage ?? page);
      setRecurringTotalPages(res.pagination?.totalPages ?? 1);
    } catch {
      toast({ title: "Error", description: "Failed to load recurring targets", variant: "destructive" });
    } finally {
      setRecurringLoading(false);
    }
  };

  // ── Regular target CRUD ────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      toast({ title: "Invalid dates", description: "End date must be after start date", variant: "destructive" });
      return;
    }
    try {
      const endpoint = editingTarget ? `/personal-targets/${editingTarget._id}` : '/personal-targets';
      const method = editingTarget ? 'PUT' : 'POST';
      const start = new Date(formData.startDate);
      const targetData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        month: start.getMonth() + 1,
        year: start.getFullYear(),
        status: formData.active ? 'active' : 'inactive',
        targetType: 'monthly',
        targetValue: 1,
        unit: 'times',
        targetAudience: formData.targetAudience,
        instructions: formData.instructions,
        rewards: formData.rewards,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        isRecurring: false,
      };
      await apiCall(endpoint, { method, body: JSON.stringify(targetData) });
      toast({ title: "Success", description: `Target ${editingTarget ? 'updated' : 'created'} successfully` });
      setIsCreateDialogOpen(false);
      setEditingTarget(null);
      resetForm();
      fetchData();
    } catch {
      toast({ title: "Error", description: `Failed to ${editingTarget ? 'update' : 'create'} target`, variant: "destructive" });
    }
  };

  const handleDelete = async (targetId: string) => {
    try {
      await apiCall(`/personal-targets/${targetId}`, { method: 'DELETE' });
      toast({ title: "Success", description: "Target deleted successfully" });
      fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to delete target", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'other',
      startDate: defaultStart(),
      endDate: defaultEnd(),
      active: true,
      targetAudience: 'all_users',
      instructions: '',
      rewards: '',
    });
  };

  const openEditDialog = (target: PersonalTarget) => {
    setEditingTarget(target);
    setFormData({
      title: target.title,
      description: target.description,
      category: target.category,
      startDate: toDatetimeLocal(new Date(target.startDate)),
      endDate: toDatetimeLocal(new Date(target.endDate)),
      active: target.status === 'active',
      targetAudience: ['group_admins', 'area_admins'].includes(target.targetAudience || '') ? 'group_and_area_admins' : (target.targetAudience || 'all_users'),
      instructions: target.instructions || '',
      rewards: target.rewards || '',
    });
    setIsCreateDialogOpen(true);
  };

  // ── Recurring target CRUD ───────────────────────────────────
  const handleRecurringSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = editingRecurring ? `/personal-targets/${editingRecurring._id}` : '/personal-targets';
      const method = editingRecurring ? 'PUT' : 'POST';
      const now = new Date();
      const targetData = {
        title: recurringForm.title,
        description: `Recurring ${recurringForm.recurringFrequency} target`,
        category: recurringForm.category,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        status: recurringForm.active ? 'active' : 'inactive',
        targetType: 'monthly',
        targetValue: 1,
        unit: 'times',
        targetAudience: recurringForm.targetAudience,
        instructions: recurringForm.instructions,
        rewards: recurringForm.rewards,
        isRecurring: true,
        recurringFrequency: recurringForm.recurringFrequency,
        attendanceNeeded: recurringForm.attendanceNeeded,
        // No meaningful start/end — use a wide open range
        startDate: new Date(now.getFullYear(), 0, 1).toISOString(),
        endDate: new Date('2099-12-31T23:59:59').toISOString(),
      };
      await apiCall(endpoint, { method, body: JSON.stringify(targetData) });
      toast({ title: "Success", description: `Recurring target ${editingRecurring ? 'updated' : 'created'} successfully` });
      setIsRecurringDialogOpen(false);
      setEditingRecurring(null);
      resetRecurringForm();
      fetchRecurringData();
    } catch {
      toast({ title: "Error", description: `Failed to ${editingRecurring ? 'update' : 'create'} recurring target`, variant: "destructive" });
    }
  };

  const handleDeleteRecurring = async (targetId: string) => {
    try {
      await apiCall(`/personal-targets/${targetId}`, { method: 'DELETE' });
      toast({ title: "Success", description: "Recurring target deleted successfully" });
      fetchRecurringData();
    } catch {
      toast({ title: "Error", description: "Failed to delete recurring target", variant: "destructive" });
    }
  };

  const resetRecurringForm = () => {
    setRecurringForm({
      title: '',
      category: 'other',
      targetAudience: 'all_users',
      recurringFrequency: 'monthly',
      instructions: '',
      rewards: '',
      active: true,
      attendanceNeeded: false,
    });
  };

  const openEditRecurringDialog = (target: PersonalTarget) => {
    setEditingRecurring(target);
    setRecurringForm({
      title: target.title,
      category: target.category,
      targetAudience: ['group_admins', 'area_admins'].includes(target.targetAudience || '') ? 'group_and_area_admins' : (target.targetAudience || 'all_users'),
      recurringFrequency: target.recurringFrequency || 'monthly',
      instructions: target.instructions || '',
      rewards: target.rewards || '',
      active: target.status === 'active',
      attendanceNeeded: target.attendanceNeeded || false,
    });
    setIsRecurringDialogOpen(true);
  };

  // ── Helpers ─────────────────────────────────────────────────
  const formatDateRange = (startDate: string, endDate: string) => {
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return {
      start: `${fmt(startDate)}, ${fmtTime(startDate)}`,
      end: `${fmt(endDate)}, ${fmtTime(endDate)}`,
    };
  };

  const isCurrentlyActive = (target: PersonalTarget) => {
    const now = new Date();
    return target.status === 'active' && new Date(target.startDate) <= now && new Date(target.endDate) >= now;
  };

  const CATEGORY_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    quran:     { icon: PiBookOpenTextFill,  color: 'text-emerald-600', bg: 'bg-emerald-100' },
    hadith:    { icon: PiBooksFill,         color: 'text-teal-600',    bg: 'bg-teal-100' },
    prayer:    { icon: PiHandsPrayingFill,  color: 'text-indigo-600',  bg: 'bg-indigo-100' },
    charity:   { icon: PiHeartFill,         color: 'text-rose-600',    bg: 'bg-rose-100' },
    knowledge: { icon: PiGraduationCapFill, color: 'text-violet-600',  bg: 'bg-violet-100' },
    community: { icon: PiHandshakeFill,     color: 'text-sky-600',     bg: 'bg-sky-100' },
  };

  const getCategoryMeta = (category: string) =>
    CATEGORY_META[category] ?? { icon: PiTargetFill, color: 'text-orange-600', bg: 'bg-orange-100' };

  const AUDIENCE_LABELS: Record<string, string> = {
    all_users: 'Everyone',
    members_only: 'Members Only',
    group_admins: 'Area Admins',
    area_admins: 'Area Admins',
    group_and_area_admins: 'Area Admins',
    district_admins: 'District Admins',
  };

  const FREQ_LABELS: Record<string, string> = {
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
  };

  // ── Loading state ───────────────────────────────────────────
  if (loading && activeTab === 'regular') {
    return (
      <PageShell>
        <PageHero
          title="Targets"
          subtitle="Loading the current target catalogue and recurring schedules."
          eyebrow="Targets"
          icon={<Target className="h-6 w-6" />}
        />
        <SectionCard title="Target Workspace" description="Switch between regular and recurring targets, then manage the selected list below.">
          <ListSkeleton rows={5} />
        </SectionCard>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        title="Targets"
        subtitle="Create, search, and manage regular or recurring targets without changing the existing workflows."
        eyebrow="Targets"
        icon={<Target className="h-6 w-6" />}
      />

      <SectionCard title="Target Workspace" description="Switch between regular and recurring targets, then manage the selected list below.">
      <div className="container mx-auto max-w-7xl space-y-6 px-0 py-0">

        {/* ── Tab Toggle + Create (inline) ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1 bg-muted/60 p-1.5 rounded-2xl w-fit border border-border/40">
            <button
              onClick={() => setActiveTab('regular')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'regular' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Target className="h-3.5 w-3.5" />
              Regular Targets
            </button>
            <button
              onClick={() => setActiveTab('recurring')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'recurring' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Recurring Targets
            </button>
          </div>
          {canManageTargets && (activeTab === 'regular' ? (
            <Button onClick={() => { resetForm(); setEditingTarget(null); setIsCreateDialogOpen(true); }} className="gap-2 rounded-xl">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Target</span>
              <span className="sm:hidden">Create</span>
            </Button>
          ) : (
            <Button onClick={() => { resetRecurringForm(); setEditingRecurring(null); setIsRecurringDialogOpen(true); }} className="gap-2 rounded-xl bg-primary">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Recurring Target</span>
              <span className="sm:hidden">Create</span>
            </Button>
          ))}
        </div>

        {/* ══════════════ REGULAR TARGETS TAB ══════════════ */}
        {activeTab === 'regular' && (
          <>
            {!canManageTargets && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200/60 px-3 py-2 text-xs text-amber-700 w-fit">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Read-only access. Only State Admins can create/edit targets.
              </div>
            )}
            {canManageTargets && (
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-2xl border border-border/50 shadow-xl bg-background font-sans">
                    {/* Header */}
                    <div className="px-6 pt-6 pb-4 border-b border-border/40">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">{editingTarget ? 'Edit Target' : 'Create New Target'}</DialogTitle>
                        <p className="text-sm text-muted-foreground mt-1">Fill in the details below to {editingTarget ? 'update' : 'create'} a target.</p>
                      </DialogHeader>
                    </div>

                    {/* Scrollable body */}
                    <div className="overflow-y-auto flex-1 px-6 py-5 custom-scrollbar">
                      <form onSubmit={handleSubmit} id="regular-target-form" className="space-y-5">
                        <div className="space-y-1.5">
                          <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
                          <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Enter target title"
                            className="h-10 rounded-lg"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">Category *</Label>
                          <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                            <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Select category" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="quran">Quran</SelectItem>
                              <SelectItem value="hadith">Hadith</SelectItem>
                              <SelectItem value="prayer">Prayer</SelectItem>
                              <SelectItem value="charity">Charity</SelectItem>
                              <SelectItem value="knowledge">Knowledge</SelectItem>
                              <SelectItem value="community">Community</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="description" className="text-sm font-medium">Description *</Label>
                          <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Describe the target in detail"
                            rows={3}
                            className="rounded-lg resize-none"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="startDate" className="text-sm font-medium">Start *</Label>
                            <Input
                              id="startDate"
                              type="datetime-local"
                              value={formData.startDate}
                              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                              className="h-10 rounded-lg text-sm"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="endDate" className="text-sm font-medium">End *</Label>
                            <Input
                              id="endDate"
                              type="datetime-local"
                              value={formData.endDate}
                              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                              className="h-10 rounded-lg text-sm"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">Target Audience *</Label>
                          <Select value={formData.targetAudience} onValueChange={(value) => setFormData({ ...formData, targetAudience: value })} disabled={!!editingTarget}>
                            <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all_users">Everyone</SelectItem>
                              <SelectItem value="members_only">Members Only</SelectItem>
                              <SelectItem value="group_and_area_admins">Area Admins Only</SelectItem>
                              <SelectItem value="district_admins">District Admins Only</SelectItem>
                            </SelectContent>
                          </Select>
                          {editingTarget && (
                            <p className="text-xs text-muted-foreground">Audience is locked after creation — progress is already assigned to these users.</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">Active</p>
                            <p className="text-xs text-muted-foreground">Visible only when active and within date range</p>
                          </div>
                          <Switch
                            id="active"
                            checked={formData.active}
                            onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="instructions" className="text-sm font-medium">Instructions <span className="text-muted-foreground font-normal">(optional)</span></Label>
                          <Textarea
                            id="instructions"
                            value={formData.instructions}
                            onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                            placeholder="How to complete this target..."
                            rows={2}
                            className="rounded-lg resize-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="rewards" className="text-sm font-medium">Rewards <span className="text-muted-foreground font-normal">(optional)</span></Label>
                          <Input
                            id="rewards"
                            value={formData.rewards}
                            onChange={(e) => setFormData({ ...formData, rewards: e.target.value })}
                            placeholder="Reward for completing this target..."
                            className="h-10 rounded-lg"
                          />
                        </div>
                      </form>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/40 bg-muted/20">
                      <Button type="button" variant="ghost" className="h-9 rounded-lg" onClick={() => setIsCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" form="regular-target-form" className="h-9 rounded-lg px-5">
                        {editingTarget ? 'Update' : 'Create Target'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
            )}

            {/* Search and User Type Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  placeholder="Search targets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 rounded-xl border-border/50 bg-card focus:bg-white transition-colors"
                />
              </div>
              <Select value={audienceFilter || "all"} onValueChange={(v) => { setAudienceFilter(v === "all" ? "" : v); setCurrentPage(1); }}>
                <SelectTrigger className="w-full sm:w-[180px] h-10 rounded-xl border-border/50 bg-card">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="members_only">Members Only</SelectItem>
                  <SelectItem value="group_and_area_admins">Area Admins</SelectItem>
                  <SelectItem value="district_admins">District Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Regular Targets List */}
            <div className="space-y-2">
              {targets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-border/50 bg-muted/20">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                    <Target className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground/70">No regular targets created yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {canManageTargets ? 'Create your first target to get started' : 'Contact your State Admin to create targets'}
                  </p>
                </div>
              ) : (
                targets.map((target) => {
                  const active = isCurrentlyActive(target);
                  const { start, end } = formatDateRange(target.startDate, target.endDate);
                  const isScheduled = target.status === 'active' && new Date(target.startDate) > new Date();
                  const isExpired = target.status === 'active' && new Date(target.endDate) < new Date();
                  const { icon: CatIcon, color: catColor, bg: catBg } = getCategoryMeta(target.category);
                  return (
                    <div
                      key={target._id}
                      className="group flex items-center gap-4 rounded-xl border border-border/40 bg-background px-4 py-3 transition-colors hover:bg-muted/30"
                    >
                      {/* Left: category icon */}
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${catBg}`}>
                        <CatIcon className={`h-5 w-5 ${catColor}`} />
                      </div>

                      {/* Middle: title + meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm truncate">{target.title}</h3>
                          <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                            active ? 'bg-emerald-100 text-emerald-700' :
                            isScheduled ? 'bg-amber-100 text-amber-700' :
                            isExpired ? 'bg-red-50 text-red-600' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500 animate-pulse' : isScheduled ? 'bg-amber-500' : 'bg-gray-400'}`} />
                            {active ? 'Active' : isScheduled ? 'Scheduled' : isExpired ? 'Expired' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{start} → {end}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">{AUDIENCE_LABELS[target.targetAudience] || target.targetAudience}</span>
                        </div>
                      </div>

                      {/* Right: actions */}
                      {canManageTargets && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => openEditDialog(target)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteRequest({ id: target._id, recurring: false })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Regular Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2 pb-4">
                <Button variant="outline" size="sm" disabled={currentPage === 1 || loading} onClick={() => fetchData(currentPage - 1)} className="h-9 px-4 rounded-xl border-border/50 hover:bg-muted/50">
                  ← Previous
                </Button>
                <span className="text-xs font-medium text-muted-foreground px-3 py-2 rounded-xl bg-muted/50">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={currentPage === totalPages || loading} onClick={() => fetchData(currentPage + 1)} className="h-9 px-4 rounded-xl border-border/50 hover:bg-muted/50">
                  Next →
                </Button>
              </div>
            )}
          </>
        )}

        {/* ══════════════ RECURRING TARGETS TAB ══════════════ */}
        {activeTab === 'recurring' && (
          <>
            {/* Info banner */}
            <div className="flex items-start gap-3 rounded-2xl bg-blue-50/80 border border-blue-200/50 px-4 py-3">
              <RefreshCw className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700/90 leading-relaxed">
                Recurring targets are perpetual — users mark their completion for each period (month/week/quarter). No submission window, no file attachment required.
              </p>
            </div>

            {!canManageTargets && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200/60 px-3 py-2 text-xs text-amber-700 w-fit">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Read-only access. Only State Admins can create/edit targets.
              </div>
            )}
            {canManageTargets && (
                <Dialog open={isRecurringDialogOpen} onOpenChange={setIsRecurringDialogOpen}>
                  <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-2xl border border-border/50 shadow-xl bg-background font-sans">
                    {/* Header */}
                    <div className="px-6 pt-6 pb-4 border-b border-border/40">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">
                          {editingRecurring ? 'Edit Recurring Target' : 'Create Recurring Target'}
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Users mark completion each period. No submission window or file upload needed.
                        </p>
                      </DialogHeader>
                    </div>

                    {/* Scrollable body */}
                    <div className="overflow-y-auto flex-1 px-6 py-5 custom-scrollbar">
                      <form onSubmit={handleRecurringSubmit} id="recurring-target-form" className="space-y-5">
                        <div className="space-y-1.5">
                          <Label htmlFor="r-title" className="text-sm font-medium">Title *</Label>
                          <Input
                            id="r-title"
                            value={recurringForm.title}
                            onChange={(e) => setRecurringForm({ ...recurringForm, title: e.target.value })}
                            placeholder="Enter recurring target title"
                            className="h-10 rounded-lg"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">Category *</Label>
                          <Select value={recurringForm.category} onValueChange={(value) => setRecurringForm({ ...recurringForm, category: value })}>
                            <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Select category" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="quran">Quran</SelectItem>
                              <SelectItem value="hadith">Hadith</SelectItem>
                              <SelectItem value="prayer">Prayer</SelectItem>
                              <SelectItem value="charity">Charity</SelectItem>
                              <SelectItem value="knowledge">Knowledge</SelectItem>
                              <SelectItem value="community">Community</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">Frequency *</Label>
                          <Select value={recurringForm.recurringFrequency} onValueChange={(v) => setRecurringForm({ ...recurringForm, recurringFrequency: v })}>
                            <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Users will see a checkbox for each {recurringForm.recurringFrequency === 'weekly' ? 'week' : recurringForm.recurringFrequency === 'quarterly' ? 'quarter' : 'month'}.
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">Target Audience *</Label>
                          <Select value={recurringForm.targetAudience} onValueChange={(value) => setRecurringForm({ ...recurringForm, targetAudience: value })} disabled={!!editingRecurring}>
                            <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all_users">Everyone</SelectItem>
                              <SelectItem value="members_only">Members Only</SelectItem>
                              <SelectItem value="group_and_area_admins">Area Admins Only</SelectItem>
                              <SelectItem value="district_admins">District Admins Only</SelectItem>
                            </SelectContent>
                          </Select>
                          {editingRecurring && (
                            <p className="text-xs text-muted-foreground">Audience is locked after creation — completion marks are already tied to these users.</p>
                          )}
                        </div>

                        {/* Toggle group */}
                        <div className="space-y-2 rounded-lg bg-muted/40 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Active</p>
                              <p className="text-xs text-muted-foreground">Only active targets are visible to users</p>
                            </div>
                            <Switch
                              checked={recurringForm.active}
                              onCheckedChange={(checked) => setRecurringForm({ ...recurringForm, active: checked })}
                            />
                          </div>
                          <div className="border-t border-border/40 pt-2 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Attendance Needed</p>
                              <p className="text-xs text-muted-foreground">Area admins mark member attendance</p>
                            </div>
                            <Switch
                              checked={recurringForm.attendanceNeeded}
                              onCheckedChange={(checked) => setRecurringForm({ ...recurringForm, attendanceNeeded: checked })}
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="r-instructions" className="text-sm font-medium">Instructions <span className="text-muted-foreground font-normal">(optional)</span></Label>
                          <Textarea
                            id="r-instructions"
                            value={recurringForm.instructions}
                            onChange={(e) => setRecurringForm({ ...recurringForm, instructions: e.target.value })}
                            placeholder="What users need to do each period..."
                            rows={2}
                            className="rounded-lg resize-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="r-rewards" className="text-sm font-medium">Rewards <span className="text-muted-foreground font-normal">(optional)</span></Label>
                          <Input
                            id="r-rewards"
                            value={recurringForm.rewards}
                            onChange={(e) => setRecurringForm({ ...recurringForm, rewards: e.target.value })}
                            placeholder="Reward for completing this target..."
                            className="h-10 rounded-lg"
                          />
                        </div>
                      </form>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/40 bg-muted/20">
                      <Button type="button" variant="ghost" className="h-9 rounded-lg" onClick={() => setIsRecurringDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" form="recurring-target-form" className="h-9 rounded-lg px-5">
                        {editingRecurring ? 'Update' : 'Create Target'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
            )}

            {/* Recurring Search and User Type Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  placeholder="Search recurring targets..."
                  value={recurringSearch}
                  onChange={(e) => setRecurringSearch(e.target.value)}
                  className="pl-10 h-10 rounded-xl border-border/50 bg-card focus:bg-white transition-colors"
                />
              </div>
              <Select value={recurringAudienceFilter || "all"} onValueChange={(v) => { setRecurringAudienceFilter(v === "all" ? "" : v); setRecurringPage(1); }}>
                <SelectTrigger className="w-full sm:w-[180px] h-10 rounded-xl border-border/50 bg-card">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="members_only">Members Only</SelectItem>
                  <SelectItem value="group_and_area_admins">Area Admins</SelectItem>
                  <SelectItem value="district_admins">District Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Recurring Targets List */}
            {recurringLoading ? (
              <ListSkeleton rows={4} />
            ) : (
              <div className="space-y-2">
                {recurringTargets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-border/50 bg-muted/20">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 mb-3">
                      <RefreshCw className="h-6 w-6 text-blue-400/70" />
                    </div>
                    <p className="text-sm font-medium text-foreground/70">No recurring targets created yet</p>
                    {canManageTargets && (
                      <p className="text-xs text-muted-foreground mt-1">Create a recurring target to get started</p>
                    )}
                  </div>
                ) : (
                  recurringTargets.map((target) => {
                    const { icon: CatIcon, color: catColor, bg: catBg } = getCategoryMeta(target.category);
                    return (
                      <div
                        key={target._id}
                        className="group flex items-center gap-4 rounded-xl border border-border/40 bg-background px-4 py-3 transition-colors hover:bg-muted/30"
                      >
                        {/* Left: category icon */}
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${catBg}`}>
                          <CatIcon className={`h-5 w-5 ${catColor}`} />
                        </div>

                        {/* Middle: title + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm truncate">{target.title}</h3>
                            <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                              target.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${target.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                              {target.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="inline-flex items-center gap-1 font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                              <RefreshCw className="h-2.5 w-2.5" />
                              {FREQ_LABELS[target.recurringFrequency || 'monthly'] || target.recurringFrequency}
                            </span>
                            {target.attendanceNeeded && (
                              <span className="font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Attendance</span>
                            )}
                            <span className="hidden sm:inline">•</span>
                            <span className="hidden sm:inline">{AUDIENCE_LABELS[target.targetAudience] || target.targetAudience}</span>
                          </div>
                        </div>

                        {/* Right: actions */}
                        {canManageTargets && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-blue-50 hover:text-blue-600" onClick={() => openEditRecurringDialog(target)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteRequest({ id: target._id, recurring: true })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Recurring Pagination */}
            {recurringTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2 pb-4">
                <Button variant="outline" size="sm" disabled={recurringPage === 1 || recurringLoading} onClick={() => fetchRecurringData(recurringPage - 1)} className="h-9 px-4 rounded-xl border-border/50 hover:bg-muted/50">
                  ← Previous
                </Button>
                <span className="text-xs font-medium text-muted-foreground px-3 py-2 rounded-xl bg-muted/50">Page {recurringPage} of {recurringTotalPages}</span>
                <Button variant="outline" size="sm" disabled={recurringPage === recurringTotalPages || recurringLoading} onClick={() => fetchRecurringData(recurringPage + 1)} className="h-9 px-4 rounded-xl border-border/50 hover:bg-muted/50">
                  Next →
                </Button>
              </div>
            )}
          </>
        )}

      </div>
      </SectionCard>

      <AlertDialog open={!!deleteRequest} onOpenChange={(open) => !open && setDeleteRequest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteRequest?.recurring ? "recurring " : ""}target?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!deleteRequest) return;
                if (deleteRequest.recurring) handleDeleteRecurring(deleteRequest.id);
                else handleDelete(deleteRequest.id);
                setDeleteRequest(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
};

export default PersonalTargets;
