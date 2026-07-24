import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { memberAuthAPI, apiCall } from "@/utils/api";
import { useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getHomeRouteByRole } from "@/lib/roleRoutes";
import Leaders from "@/pages/Leaders";
import {
  User,
  CreditCard,
  Calendar,
  Target,
  Bell,
  MapPin,
  Users,
  Phone,
  Mail,
  IndianRupee,
  Home,
  Star,
  FileText,
  Image,
  Film,
  Paperclip,
  CheckCircle,
  Clock,
  AlertCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Upload,
  X,
  RefreshCw,
  FolderOpen,
  Edit,
  Save,
  BookOpen,
  Book,
  Music,
  File,
  Eye,
  Download,
  Search,
  Link2,
  LogOut,
  Menu,
  Library,
  HandHeart,
  Heart,
  GraduationCap,
  Handshake
} from "lucide-react";

interface MemberProfile {
  profile: {
    id: string;
    name: string;
    phone: string;
    avatar?: string;
    email?: string;
    dateOfBirth?: string;
    age?: number;
    bloodGroup?: string;
    profession?: string;
    education?: string;
    address?: string;
    areaOfInterest?: string;
    skills?: string;
    district: { name: string };
    group: { name: string };
    status: string;
    joinedDate: string;
  };
  baithulMaal: {
    monthlyAmount: number;
    totalPaid: number;
    pendingAmount: number;
    lastPaymentDate?: string;
    paymentCount: number;
  };
}

interface BaithulPayment {
  _id: string;
  amount: number;
  paymentDate: string;
  paymentMonth: string; // YYYY-MM
  receiptNumber?: string;
  paymentMethod?: string;
}

interface FileAttachment {
  url: string;
  originalName: string;
  mimetype: string;
  size: number;
  key: string;
}

interface PersonalTarget {
  _id: string | null;
  personalTarget: {
    _id: string;
    title: string;
    description: string;
    category: string;
    targetValue: number;
    unit: string;
    month: number;
    year: number;
    startDate: string;
    endDate: string;
    instructions?: string;
    rewards?: string;
    isRecurring?: boolean;
    recurringFrequency?: string;
  };
  currentProgress: number;
  targetValue: number;
  progressPercentage: number;
  status: string;
  completedAt?: string;
  feedback?: string;
  fileAttachment?: FileAttachment | null;
}

interface RecurringMark {
  targetId: string;
  year: number;
  month: number;
  week?: number;
  completed: boolean;
}

interface Meeting {
  _id: string;
  title: string;
  description?: string;
  agenda: Array<{
    item: string;
    duration?: number;
    presenter?: string;
    notes?: string;
  }>;
  scheduledDate: string;
  duration: number;
  venue?: string;
  meetingType: string;
  status: string;
}

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
  attachments?: { url: string; originalName?: string; mimetype?: string }[];
}

interface OrgFileItem {
  _id: string;
  title: string;
  description?: string;
  category: string;
  fileType: string;
  link?: string;
  url: string;
  originalName: string;
  mimetype: string;
  size: number;
  createdAt: string;
}

const orgCategoryLabels: Record<string, string> = {
  constitution: "Constitution",
  guidelines: "Guidelines",
  video: "Video",
  audio: "Audio",
  document: "Document",
  link: "Link",
  other: "Other"
};

const orgCategoryIcons: Record<string, React.ElementType> = {
  constitution: BookOpen,
  guidelines: Book,
  video: Film,
  audio: Music,
  document: FileText,
  link: Link2,
  other: File
};

const formatOrgFileSize = (bytes: number | undefined) => {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
};

const MemberDashboard = () => {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [targets, setTargets] = useState<PersonalTarget[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get("view") || "overview";
  const setActiveView = (view: string) =>
    setSearchParams(view === "overview" ? {} : { view }, { replace: true });
  // Target interaction state
  const [expandedTargetId, setExpandedTargetId] = useState<string | null>(null);
  const [targetFeedback, setTargetFeedback] = useState<Record<string, string>>({});
  const [targetSaving, setTargetSaving] = useState<string | null>(null);
  const [targetUploading, setTargetUploading] = useState<string | null>(null);
  const [pendingTargetFiles, setPendingTargetFiles] = useState<Record<string, File>>({});
  const [uploadedTargetAttachments, setUploadedTargetAttachments] = useState<Record<string, FileAttachment>>({});
  const targetFileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Recurring marks state
  const [recurringMarks, setRecurringMarks] = useState<RecurringMark[]>([]);
  const [expandedRecurringId, setExpandedRecurringId] = useState<string | null>(null);
  const [recurringMarkKey, setRecurringMarkKey] = useState<string | null>(null);
  const [recurringYear, setRecurringYear] = useState(new Date().getFullYear());
  const [weeklyViewMonth, setWeeklyViewMonth] = useState(new Date().getMonth() + 1);
  const [weeklyViewYear, setWeeklyViewYear] = useState(new Date().getFullYear());

  // Org files state
  const [orgFiles, setOrgFiles] = useState<OrgFileItem[]>([]);
  const [orgFilesLoading, setOrgFilesLoading] = useState(false);
  const [orgFilesCategory, setOrgFilesCategory] = useState("all");
  const [orgFilesSearch, setOrgFilesSearch] = useState("");
  const [orgFilesDebouncedSearch, setOrgFilesDebouncedSearch] = useState("");
  const [viewerFile, setViewerFile] = useState<OrgFileItem | null>(null);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement | null>(null);
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [changeRequestForm, setChangeRequestForm] = useState({ name: "", phone: "", note: "" });
  const [changeRequestSending, setChangeRequestSending] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({
    email: "",
    profession: "",
    education: "",
    address: "",
    bloodGroup: "",
    age: "",
    areaOfInterest: "",
    skills: ""
  });

  const { token, logout, availableRoles, switchRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [baithulPayments, setBaithulPayments] = useState<BaithulPayment[]>([]);
  const [baithulLoading, setBaithulLoading] = useState(false);
  const [baithulFetched, setBaithulFetched] = useState(false);

  const syncTargetState = (data: PersonalTarget[]) => {
    const feedbackMap: Record<string, string> = {};
    const attachmentMap: Record<string, FileAttachment> = {};
    data.forEach((t) => {
      const id = t.personalTarget._id;
      if (t.feedback) feedbackMap[id] = t.feedback;
      if (t.fileAttachment?.url) attachmentMap[id] = t.fileAttachment as FileAttachment;
    });
    setTargetFeedback(feedbackMap);
    setUploadedTargetAttachments(attachmentMap);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch profile
        const profileData = await memberAuthAPI.getProfile();
        setProfile(profileData.data);

        // Fetch all targets (sorted by release date, recent first)
        const targetsData = await memberAuthAPI.getTargets({
          limit: '20' // Show recent 20 targets
        });
        setTargets(targetsData.data);
        syncTargetState(targetsData.data);

        // Fetch recurring marks
        try {
          const marksData = await apiCall('/member-auth/recurring-marks');
          setRecurringMarks(marksData.data || []);
        } catch {
          // Endpoint may not exist yet — fail silently
        }

        // Fetch upcoming meetings
        const meetingsData = await memberAuthAPI.getMeetings({
          status: 'scheduled',
          limit: '5'
        });
        setMeetings(meetingsData.data.meetings);

        // Fetch recent notifications
        const notificationsData = await memberAuthAPI.getNotifications({
          limit: '5'
        });
        setNotifications(notificationsData.data.notifications);

      } catch {
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token, toast]);

  // Fetch payment history first time the Baithul Maal tab opens
  useEffect(() => {
    if (activeView !== "baithul" || baithulFetched) return;
    setBaithulFetched(true);
    setBaithulLoading(true);
    memberAuthAPI.getBaithulMaal({ limit: "24" })
      .then((res) => setBaithulPayments(res.data?.payments || []))
      .catch(() => toast({ title: "Error", description: "Failed to load payment history", variant: "destructive" }))
      .finally(() => setBaithulLoading(false));
  }, [activeView, baithulFetched, toast]);

  // Debounce org files search
  useEffect(() => {
    const t = setTimeout(() => setOrgFilesDebouncedSearch(orgFilesSearch), 400);
    return () => clearTimeout(t);
  }, [orgFilesSearch]);

  // Fetch org files when tab is active
  useEffect(() => {
    if (activeView !== "orgfiles") return;
    const fetchOrgFiles = async () => {
      try {
        setOrgFilesLoading(true);
        const params: Record<string, string> = {};
        if (orgFilesCategory !== "all") params.category = orgFilesCategory;
        if (orgFilesDebouncedSearch) params.search = orgFilesDebouncedSearch;
        const result = await memberAuthAPI.getOrgFiles(params);
        setOrgFiles(result.data || []);
      } catch {
        toast({ title: "Error", description: "Failed to load files", variant: "destructive" });
      } finally {
        setOrgFilesLoading(false);
      }
    };
    fetchOrgFiles();
  }, [activeView, orgFilesCategory, orgFilesDebouncedSearch]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'not_started': return 'bg-gray-100 text-gray-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string, className = "h-5 w-5") => {
    const icons: Record<string, typeof Target> = {
      quran: BookOpen,
      hadith: Library,
      prayer: HandHeart,
      charity: Heart,
      knowledge: GraduationCap,
      community: Handshake,
    };
    const Icon = icons[category] || Target;
    return <Icon className={className} />;
  };

  if (loading) {
    return (
      <PageShell contentClassName="pb-40 lg:pb-8">
        <Card className="surface-card">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-[4.75rem] animate-pulse rounded-xl border bg-card" />
          ))}
        </div>
        <div className="h-24 animate-pulse rounded-xl border bg-card" />
        <div className="h-40 animate-pulse rounded-xl border bg-card" />
      </PageShell>
    );
  }

  if (!profile) {
    return (
      <PageShell contentClassName="pb-32">
        <PageHero
          title="Member Dashboard"
          subtitle="We couldn’t load the member profile for this workspace yet."
          eyebrow="Member Portal"
          icon={<Home className="h-6 w-6" />}
        />
        <SectionCard title="Profile Unavailable" description="Retry loading the member profile data.">
          <div className="py-12 text-center">
            <p className="text-destructive">Failed to load profile data</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Retry
            </Button>
          </div>
        </SectionCard>
      </PageShell>
    );
  }

  const uploadTargetFile = async (targetId: string) => {
    const file = pendingTargetFiles[targetId];
    if (!file) return uploadedTargetAttachments[targetId];
    try {
      setTargetUploading(targetId);
      const result = await memberAuthAPI.uploadFile(file);
      const attachment = result.data;
      setUploadedTargetAttachments(prev => ({ ...prev, [targetId]: attachment }));
      setPendingTargetFiles(prev => { const n = { ...prev }; delete n[targetId]; return n; });
      return attachment;
    } catch {
      toast({ title: "Upload Failed", description: "Could not upload the file.", variant: "destructive" });
      return undefined;
    } finally {
      setTargetUploading(null);
    }
  };

  const toggleRecurringMark = async (targetId: string, year: number, month: number, week = 0) => {
    const key = `${targetId}-${year}-${month}-${week}`;
    const existing = recurringMarks.find(m => m.targetId === targetId && m.year === year && m.month === month && (m.week ?? 0) === week);
    const newCompleted = !existing?.completed;
    setRecurringMarkKey(key);
    // Optimistic update
    setRecurringMarks(prev => {
      const filtered = prev.filter(m => !(m.targetId === targetId && m.year === year && m.month === month && (m.week ?? 0) === week));
      return [...filtered, { targetId, year, month, week, completed: newCompleted }];
    });
    try {
      await apiCall('/member-auth/recurring-marks', {
        method: 'POST',
        body: JSON.stringify({ targetId, year, month, week, completed: newCompleted }),
      });
    } catch {
      setRecurringMarks(prev => {
        const filtered = prev.filter(m => !(m.targetId === targetId && m.year === year && m.month === month && (m.week ?? 0) === week));
        if (existing) return [...filtered, existing];
        return filtered;
      });
      toast({ title: "Error", description: "Failed to update mark", variant: "destructive" });
    } finally {
      setRecurringMarkKey(null);
    }
  };

  const updateTargetProgress = async (targetId: string, status: string) => {
    try {
      setTargetSaving(targetId);
      let fileAttachment = uploadedTargetAttachments[targetId];
      if (pendingTargetFiles[targetId]) {
        fileAttachment = await uploadTargetFile(targetId);
      }
      const result = await memberAuthAPI.updateTargetProgress(targetId, {
        status,
        feedback: targetFeedback[targetId] || '',
        ...(fileAttachment ? { fileAttachment } : {})
      });

      // Optimistically update the badge immediately from the API response
      if (result?.data) {
        const updated = result.data;
        setTargets(prev =>
          prev.map(t =>
            t.personalTarget._id === targetId
              ? { ...t, status: updated.status, completedAt: updated.completedAt ?? t.completedAt, progressPercentage: updated.progressPercentage ?? t.progressPercentage }
              : t
          )
        );
      }

      toast({ title: "Progress Updated", description: "Your target progress has been saved." });
      // Full sync in background
      const targetsData = await memberAuthAPI.getTargets({ limit: '20' });
      setTargets(targetsData.data);
      syncTargetState(targetsData.data);
    } catch {
      toast({ title: "Error", description: "Failed to update progress", variant: "destructive" });
    } finally {
      setTargetSaving(null);
    }
  };

  const menuItems = [
    { id: "overview", label: "Home", icon: Home },
    { id: "targets", label: "Targets", icon: Target },
    { id: "meetings", label: "Meetings", icon: Calendar },
    { id: "orgfiles", label: "Files", icon: FolderOpen },
    { id: "leaders", label: "Leaders", icon: Star }
  ];


  const unreadNotificationCount = notifications.filter((notification) => !notification.isRead).length;
  const handleLeadersClick = () => setActiveView("leaders");
  // Keep for overview quick link

  const renderContent = () => {
    switch (activeView) {
      case "overview":
        return renderOverviewContent();
      case "profile":
        return renderProfileContent();
      case "targets":
        return renderTargetsContent();
      case "meetings":
        return renderMeetingsContent();
      case "orgfiles":
        return renderOrgFilesContent();
      case "notifications":
        return renderNotificationsContent();
      case "baithul":
        return renderBaithulContent();
      case "leaders":
        return <Leaders embedded />;
      default:
        return renderOverviewContent();
    }
  };

  const renderOverviewContent = () => (
    <div className="space-y-4">
      {/* Compact stat strip */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Targets", value: targets.length, icon: Target, view: "targets", tone: "text-primary bg-primary/10" },
          { label: "Meetings", value: meetings.length, icon: Calendar, view: "meetings", tone: "text-green-600 bg-green-100" },
        ].map(({ label, value, icon: Icon, view, tone }) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className="flex items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-[0_1px_2px_rgba(16,24,40,0.06),0_4px_12px_-2px_rgba(16,24,40,0.08)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div className={`inline-flex rounded-lg p-2 ${tone}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold leading-none">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Baithul Maal summary — opens Baithul Maal view */}
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setActiveView("baithul")}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveView("baithul"); }}
        className="cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      >
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold">
            <span className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4" /> Baithul Maal
            </span>
            <span className="text-xs font-medium text-muted-foreground">See details</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(profile.baithulMaal.totalPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-bold text-orange-600">{formatCurrency(profile.baithulMaal.pendingAmount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Targets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5" />
            Recent Targets
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveView("targets")}>
            See all
          </Button>
        </CardHeader>
        <CardContent>
          {targets.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No targets available
            </p>
          ) : (
            <div className="divide-y">
              {targets.slice(0, 3).map((target) => (
                <div key={target._id ?? target.personalTarget._id} className="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0">
                  <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {getCategoryIcon(target.personalTarget.category)}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium malayalam-text">
                    {target.personalTarget.title}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {target.currentProgress}/{target.targetValue}
                  </span>
                  <span className="shrink-0 text-sm font-semibold">
                    {target.progressPercentage.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );

  const uploadAvatar = async (file: File) => {
    try {
      setAvatarUploading(true);
      const result = await memberAuthAPI.uploadFile(file);
      const url = result.data?.url;
      if (!url) throw new Error("Upload failed");
      await memberAuthAPI.updateProfile({ avatar: url });
      setProfile(prev => prev ? { ...prev, profile: { ...prev.profile, avatar: url } } : prev);
      toast({ title: "Photo Updated", description: "Your profile photo has been updated." });
    } catch {
      toast({ title: "Error", description: "Failed to update photo", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
      if (avatarFileRef.current) avatarFileRef.current.value = "";
    }
  };

  const submitChangeRequest = async () => {
    try {
      setChangeRequestSending(true);
      await memberAuthAPI.requestProfileChange({
        name: changeRequestForm.name.trim() || undefined,
        phone: changeRequestForm.phone.trim() || undefined,
        note: changeRequestForm.note.trim() || undefined,
      });
      setShowChangeRequest(false);
      setChangeRequestForm({ name: "", phone: "", note: "" });
      toast({ title: "Request Sent", description: "Your area admin will review the change." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send request", variant: "destructive" });
    } finally {
      setChangeRequestSending(false);
    }
  };

  const openEditProfile = () => {
    setEditProfileForm({
      email: profile!.profile.email || "",
      profession: profile!.profile.profession || "",
      education: profile!.profile.education || "",
      address: profile!.profile.address || "",
      bloodGroup: profile!.profile.bloodGroup || "",
      age: profile!.profile.age ? String(profile!.profile.age) : "",
      areaOfInterest: profile!.profile.areaOfInterest || "",
      skills: profile!.profile.skills || ""
    });
    setIsEditingProfile(true);
  };

  const saveProfile = async () => {
    try {
      setProfileSaving(true);
      const payload: Record<string, any> = { ...editProfileForm };
      if (payload.age) payload.age = Number(payload.age);
      else delete payload.age;
      const result = await memberAuthAPI.updateProfile(payload);
      // Merge updated data back into profile state
      setProfile(prev => prev ? {
        ...prev,
        profile: { ...prev.profile, ...result.data }
      } : prev);
      setIsEditingProfile(false);
      toast({ title: "Profile Updated", description: "Your profile has been updated successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update profile", variant: "destructive" });
    } finally {
      setProfileSaving(false);
    }
  };

  const renderProfileContent = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            {!isEditingProfile ? (
              <Button size="sm" variant="outline" onClick={openEditProfile}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setIsEditingProfile(false)} disabled={profileSaving}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={saveProfile} disabled={profileSaving}>
                  <Save className="h-4 w-4 mr-1" />
                  {profileSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {profile.profile.avatar ? (
              <img src={profile.profile.avatar} alt={profile.profile.name} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                {profile.profile.name.charAt(0)}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={avatarFileRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAvatar(file);
              }}
            />
            <div className="space-y-1.5">
              <Button size="sm" variant="outline" disabled={avatarUploading} onClick={() => avatarFileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {avatarUploading ? "Uploading..." : "Change Photo"}
              </Button>
              <button
                className="block text-xs text-primary hover:underline"
                onClick={() => {
                  setChangeRequestForm({ name: profile.profile.name, phone: profile.profile.phone, note: "" });
                  setShowChangeRequest(true);
                }}
              >
                Request name/phone change
              </button>
            </div>
          </div>
          {!isEditingProfile ? (
            <div className="grid grid-cols-2 gap-3 md:gap-4 [&_p]:text-sm [&_p]:md:text-base [&_label]:text-xs [&_label]:md:text-sm">
              <div className="col-span-2 md:col-span-1">
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <p className="text-lg">{profile.profile.name}</p>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-sm font-medium text-muted-foreground">Phone</label>
                <p className="text-lg flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {profile.profile.phone}
                </p>
              </div>
              {profile.profile.email && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-lg flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {profile.profile.email}
                  </p>
                </div>
              )}
              {profile.profile.age && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Age</label>
                  <p className="text-lg">{profile.profile.age} years</p>
                </div>
              )}
              {profile.profile.bloodGroup && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Blood Group</label>
                  <p className="text-lg">{profile.profile.bloodGroup}</p>
                </div>
              )}
              {profile.profile.profession && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Profession</label>
                  <p className="text-lg">{profile.profile.profession}</p>
                </div>
              )}
              {profile.profile.education && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Education</label>
                  <p className="text-lg">{profile.profile.education}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground">District</label>
                <p className="text-lg flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {profile.profile.district.name}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Group</label>
                <p className="text-lg flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {profile.profile.group.name}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Member Since</label>
                <p className="text-lg">{formatDate(profile.profile.joinedDate)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <p className="text-lg flex items-center">
                  <Badge className={`${profile.profile.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                    {profile.profile.status}
                  </Badge>
                </p>
              </div>
              {profile.profile.address && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <p className="text-lg">{profile.profile.address}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="member-profile-email" className="text-sm font-medium">Email</label>
                <Input
                  id="member-profile-email"
                  type="email"
                  value={editProfileForm.email}
                  onChange={e => setEditProfileForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="Email address"
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="member-profile-age" className="text-sm font-medium">Age</label>
                <Input
                  id="member-profile-age"
                  type="number"
                  value={editProfileForm.age}
                  onChange={e => setEditProfileForm(p => ({ ...p, age: e.target.value }))}
                  placeholder="Age"
                  min={0}
                  max={120}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="member-profile-blood-group" className="text-sm font-medium">Blood Group</label>
                <Select
                  value={editProfileForm.bloodGroup || "none"}
                  onValueChange={(val) => setEditProfileForm(p => ({ ...p, bloodGroup: val === "none" ? "" : val }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select blood group</SelectItem>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                      <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="member-profile-profession" className="text-sm font-medium">Profession</label>
                <Input
                  id="member-profile-profession"
                  value={editProfileForm.profession}
                  onChange={e => setEditProfileForm(p => ({ ...p, profession: e.target.value }))}
                  placeholder="Your profession"
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="member-profile-education" className="text-sm font-medium">Education</label>
                <Input
                  id="member-profile-education"
                  value={editProfileForm.education}
                  onChange={e => setEditProfileForm(p => ({ ...p, education: e.target.value }))}
                  placeholder="Educational qualification"
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="member-profile-area-of-interest" className="text-sm font-medium">Area of Interest</label>
                <Input
                  id="member-profile-area-of-interest"
                  value={editProfileForm.areaOfInterest}
                  onChange={e => setEditProfileForm(p => ({ ...p, areaOfInterest: e.target.value }))}
                  placeholder="Areas of interest"
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="member-profile-skills" className="text-sm font-medium">Skills</label>
                <Input
                  id="member-profile-skills"
                  value={editProfileForm.skills}
                  onChange={e => setEditProfileForm(p => ({ ...p, skills: e.target.value }))}
                  placeholder="Your skills"
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="member-profile-address" className="text-sm font-medium">Address</label>
                <Input
                  id="member-profile-address"
                  value={editProfileForm.address}
                  onChange={e => setEditProfileForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="Home address"
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-2 p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Name, phone, and group/district changes need admin approval — use "Request name/phone change".
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {baithulDetailsCard}
    </div>
  );

  const baithulDetailsCard = (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Baithul Maal Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Monthly Amount</label>
              <p className="text-xl font-semibold text-blue-600">
                {formatCurrency(profile.baithulMaal.monthlyAmount)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Total Paid</label>
              <p className="text-xl font-semibold text-green-600">
                {formatCurrency(profile.baithulMaal.totalPaid)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Pending Amount</label>
              <p className="text-xl font-semibold text-orange-600">
                {formatCurrency(profile.baithulMaal.pendingAmount)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Total Payments</label>
              <p className="text-xl font-semibold">
                {profile.baithulMaal.paymentCount}
              </p>
            </div>
          </div>
          {profile.baithulMaal.lastPaymentDate && (
            <div className="mt-4">
              <label className="text-sm font-medium text-muted-foreground">Last Payment</label>
              <p className="text-lg">{formatDate(profile.baithulMaal.lastPaymentDate)}</p>
            </div>
          )}
        </CardContent>
      </Card>
  );

  const formatPaymentMonth = (ym: string) => {
    const [year, month] = ym.split("-");
    return `${MONTHS_SHORT[parseInt(month) - 1] || month} ${year}`;
  };

  const renderBaithulContent = () => (
    <div className="space-y-4">
      {baithulDetailsCard}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {baithulLoading ? (
            <p className="text-sm text-muted-foreground">Loading payments…</p>
          ) : baithulPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <div className="divide-y">
              {baithulPayments.map((p) => (
                <div key={p._id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{formatPaymentMonth(p.paymentMonth)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.paymentDate)}
                      {p.receiptNumber ? ` • Receipt ${p.receiptNumber}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-green-600">{formatCurrency(p.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const getWeeksInMonth = (year: number, month: number) => {
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const total = firstDayOfWeek + daysInMonth;
    const weeks = Math.ceil(total / 7);
    // If the last calendar row has only 1 day (a lone Sunday), don't count it
    return total % 7 === 1 ? weeks - 1 : weeks;
  };

  const prevWeeklyMonth = () => {
    if (weeklyViewMonth === 1) {
      setWeeklyViewMonth(12);
      setWeeklyViewYear(y => y - 1);
    } else {
      setWeeklyViewMonth(m => m - 1);
    }
  };

  const nextWeeklyMonth = () => {
    if (weeklyViewMonth === 12) {
      setWeeklyViewMonth(1);
      setWeeklyViewYear(y => y + 1);
    } else {
      setWeeklyViewMonth(m => m + 1);
    }
  };
  const FREQ_LABELS: Record<string, string> = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' };

  const renderTargetsContent = () => {
    const regularTargets = targets.filter(t => !t.personalTarget?.isRecurring);
    const recurringTargets = targets.filter(t => t.personalTarget?.isRecurring);

    return (
      <div className="space-y-4">

        {/* ── Regular Targets ── */}
        {regularTargets.length > 0 && (
          <div className="surface-card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Target className="h-5 w-5" />
              Personal Targets
            </h2>
              <div className="space-y-3">
                {regularTargets.map((target) => {
                  const targetId = target.personalTarget._id;
                  const isExpanded = expandedTargetId === targetId;
                  const isSaving = targetSaving === targetId;
                  const isUploading = targetUploading === targetId;
                  const attachment = uploadedTargetAttachments[targetId];
                  const pendingFile = pendingTargetFiles[targetId];

                  return (
                    <Card key={target._id ?? target.personalTarget._id} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            <span className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{getCategoryIcon(target.personalTarget.category, "h-5 w-5")}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <Badge className={getStatusColor(target.status)}>
                                  {target.status === 'completed' ? <CheckCircle className="h-3 w-3 mr-1" /> :
                                    target.status === 'in_progress' ? <Clock className="h-3 w-3 mr-1" /> :
                                    <AlertCircle className="h-3 w-3 mr-1" />}
                                  {target.status.replace('_', ' ')}
                                </Badge>
                                <span className="text-xs text-muted-foreground font-medium">
                                  {target.progressPercentage.toFixed(0)}%
                                </span>
                              </div>
                              <p className="font-semibold text-sm">{target.personalTarget.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">{target.personalTarget.description}</p>
                            </div>
                          </div>
                          <button
                            className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                            onClick={() => setExpandedTargetId(isExpanded ? null : targetId)}
                            aria-label={isExpanded ? `Collapse ${target.personalTarget.title}` : `Expand ${target.personalTarget.title}`}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min(100, target.progressPercentage)}%` }}
                          />
                        </div>

                        {isExpanded && (
                          <div className="mt-3 space-y-3 border-t pt-3">
                            {target.personalTarget.instructions && (
                              <div className="bg-muted/50 p-2 rounded text-xs">
                                <p className="font-medium mb-1">Instructions:</p>
                                <p>{target.personalTarget.instructions}</p>
                              </div>
                            )}
                            {target.personalTarget.rewards && (
                              <div className="bg-yellow-50 p-2 rounded text-xs">
                                <p className="font-medium mb-1">Rewards:</p>
                                <p>{target.personalTarget.rewards}</p>
                              </div>
                            )}
                            <div>
                              <label htmlFor={`target-feedback-${targetId}`} className="text-xs font-medium flex items-center gap-1 mb-1">
                                <MessageSquare className="h-3 w-3" /> Feedback
                              </label>
                              <textarea
                                id={`target-feedback-${targetId}`}
                                className="w-full text-xs border rounded p-2 min-h-[60px] bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                                placeholder="Add your feedback..."
                                value={targetFeedback[targetId] || ''}
                                onChange={(e) => setTargetFeedback(prev => ({ ...prev, [targetId]: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label htmlFor={`target-file-${targetId}`} className="text-xs font-medium flex items-center gap-1 mb-1">
                                <Paperclip className="h-3 w-3" /> Attachment
                              </label>
                              <input
                                id={`target-file-${targetId}`}
                                type="file"
                                className="hidden"
                                ref={el => { targetFileRefs.current[targetId] = el; }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) setPendingTargetFiles(prev => ({ ...prev, [targetId]: file }));
                                }}
                              />
                              {(attachment || pendingFile) ? (
                                <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs">
                                  {(() => {
                                    const mime = attachment?.mimetype || pendingFile?.type || '';
                                    const name = attachment?.originalName || pendingFile?.name || 'File';
                                    const Icon = mime.startsWith('image/') ? Image : mime.startsWith('video/') ? Film : FileText;
                                    return (
                                      <>
                                        <Icon className="h-3 w-3 shrink-0" />
                                        {attachment?.url ? (
                                          <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary hover:underline">{name}</a>
                                        ) : (
                                          <span className="flex-1 truncate">{name}</span>
                                        )}
                                        {pendingFile && <span className="text-amber-600 shrink-0">unsaved</span>}
                                      </>
                                    );
                                  })()}
                                  <button
                                    className="shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => {
                                      setPendingTargetFiles(prev => { const n = { ...prev }; delete n[targetId]; return n; });
                                      setUploadedTargetAttachments(prev => { const n = { ...prev }; delete n[targetId]; return n; });
                                      if (targetFileRefs.current[targetId]) targetFileRefs.current[targetId]!.value = '';
                                    }}
                                    aria-label={`Remove attachment for ${target.personalTarget.title}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="text-xs border rounded px-3 py-1.5 flex items-center gap-1 hover:bg-muted w-full justify-center"
                                  onClick={() => targetFileRefs.current[targetId]?.click()}
                                >
                                  <Upload className="h-3 w-3" /> Choose File
                                </button>
                              )}
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {target.status !== 'in_progress' && (
                                <button
                                  className="text-xs border rounded px-3 py-1.5 flex items-center gap-1 hover:bg-muted disabled:opacity-50"
                                  disabled={isSaving || isUploading}
                                  onClick={() => updateTargetProgress(targetId, 'in_progress')}
                                >
                                  <Clock className="h-3 w-3" /> Mark In Progress
                                </button>
                              )}
                              {target.status !== 'completed' && (
                                <button
                                  className="text-xs bg-green-600 text-white rounded px-3 py-1.5 flex items-center gap-1 hover:bg-green-700 disabled:opacity-50"
                                  disabled={isSaving || isUploading}
                                  onClick={() => updateTargetProgress(targetId, 'completed')}
                                >
                                  <CheckCircle className="h-3 w-3" />
                                  {isSaving ? 'Saving...' : isUploading ? 'Uploading...' : 'Mark Complete'}
                                </button>
                              )}
                              <button
                                className="text-xs border rounded px-3 py-1.5 ml-auto hover:bg-muted disabled:opacity-50"
                                disabled={isSaving || isUploading}
                                onClick={() => updateTargetProgress(targetId, target.status)}
                              >
                                Save
                              </button>
                            </div>
                            {target.completedAt && (
                              <p className="text-xs text-green-600">Completed on {formatDate(target.completedAt)}</p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
          </div>
        )}

        {/* ── Recurring Targets (same as district admin: title + month grid, mark done only) ── */}
        {recurringTargets.length > 0 && (
          <div className="surface-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <RefreshCw className="h-5 w-5 text-blue-500" />
                Recurring Targets
              </h2>
              {/* Year selector */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRecurringYear(y => y - 1)}
                  className="px-2 py-1 rounded border text-xs hover:bg-muted"
                  aria-label={`Show recurring targets for ${recurringYear - 1}`}
                >←</button>
                <span className="text-sm font-semibold w-12 text-center">{recurringYear}</span>
                <button
                  onClick={() => setRecurringYear(y => y + 1)}
                  className="px-2 py-1 rounded border text-xs hover:bg-muted"
                  disabled={recurringYear >= new Date().getFullYear()}
                  aria-label={`Show recurring targets for ${recurringYear + 1}`}
                >→</button>
              </div>
            </div>

              <div className="space-y-4">
                {recurringTargets.map((target) => {
                  const targetId = target.personalTarget._id;
                  const freq = target.personalTarget.recurringFrequency || 'monthly';
                  return (
                    <Card key={target._id ?? targetId} className="border border-blue-100">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{getCategoryIcon(target.personalTarget.category)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm truncate">{target.personalTarget.title}</p>
                              <Badge className="text-xs bg-blue-100 text-blue-700 shrink-0">
                                <RefreshCw className="h-2.5 w-2.5 mr-1 inline" />
                                {FREQ_LABELS[freq] || freq}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {freq === 'weekly' ? (
                          <>
                            <div className="flex items-center gap-2 mb-2">
                              <p className="text-xs text-muted-foreground font-medium flex-1">Mark completed weeks:</p>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={prevWeeklyMonth}
                                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 text-xs"
                                  aria-label="Previous month"
                                >←</button>
                                <span className="text-xs font-semibold w-16 text-center">{MONTHS_SHORT[weeklyViewMonth - 1]} {weeklyViewYear}</span>
                                <button
                                  onClick={nextWeeklyMonth}
                                  disabled={weeklyViewYear > new Date().getFullYear() || (weeklyViewYear === new Date().getFullYear() && weeklyViewMonth >= new Date().getMonth() + 1)}
                                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                                  aria-label="Next month"
                                >→</button>
                              </div>
                            </div>
                            {(() => {
                              const totalWeeks = getWeeksInMonth(weeklyViewYear, weeklyViewMonth);
                              const isFutureMonth = weeklyViewYear > new Date().getFullYear() || (weeklyViewYear === new Date().getFullYear() && weeklyViewMonth > new Date().getMonth() + 1);
                              return (
                                <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${totalWeeks}, minmax(0, 1fr))` }}>
                                  {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((weekNum) => {
                                    const key = `${targetId}-${weeklyViewYear}-${weeklyViewMonth}-${weekNum}`;
                                    const mark = recurringMarks.find(
                                      m => m.targetId === targetId && m.year === weeklyViewYear && m.month === weeklyViewMonth && (m.week ?? 0) === weekNum
                                    );
                                    const isCompleted = mark?.completed || false;
                                    const isMarkLoading = recurringMarkKey === key;
                                    return (
                                      <button
                                        key={weekNum}
                                        onClick={() => !isFutureMonth && toggleRecurringMark(targetId, weeklyViewYear, weeklyViewMonth, weekNum)}
                                        disabled={isMarkLoading || isFutureMonth}
                                        title={isFutureMonth ? 'Future week' : `Week ${weekNum} – ${MONTHS_SHORT[weeklyViewMonth - 1]} ${weeklyViewYear}`}
                                        className={`
                                          h-9 rounded-lg text-xs font-medium transition-all border
                                          ${isCompleted
                                            ? 'bg-green-500 border-green-500 text-white shadow-sm'
                                            : isFutureMonth
                                              ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                                              : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                                          }
                                          ${isMarkLoading ? 'opacity-60 cursor-wait' : ''}
                                        `}
                                      >
                                        {isCompleted ? '✓' : `Wk ${weekNum}`}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          <>
                            {(() => {
                              const now = new Date();
                              const curMonth = now.getMonth() + 1;
                              const curYear = now.getFullYear();
                              const curMark = recurringMarks.find(
                                m => m.targetId === targetId && m.year === curYear && m.month === curMonth && (m.week ?? 0) === 0
                              );
                              const curDone = curMark?.completed || false;
                              const doneCount = MONTHS_SHORT.filter((_, i) =>
                                recurringMarks.find(m => m.targetId === targetId && m.year === recurringYear && m.month === i + 1 && (m.week ?? 0) === 0)?.completed
                              ).length;
                              const isOpen = expandedRecurringId === targetId;
                              const curKey = `${targetId}-${curYear}-${curMonth}-0`;
                              return (
                                <div className="flex items-center gap-2 mb-2">
                                  <button
                                    onClick={() => toggleRecurringMark(targetId, curYear, curMonth, 0)}
                                    disabled={recurringMarkKey === curKey}
                                    className={`flex-1 h-9 rounded-lg text-xs font-medium border transition-all ${
                                      curDone
                                        ? 'bg-green-500 border-green-500 text-white'
                                        : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                                    }`}
                                  >
                                    {curDone ? `✓ ${MONTHS_SHORT[curMonth - 1]} done` : `Mark ${MONTHS_SHORT[curMonth - 1]} done`}
                                  </button>
                                  <button
                                    onClick={() => setExpandedRecurringId(isOpen ? null : targetId)}
                                    className="shrink-0 h-9 px-3 rounded-lg text-xs font-medium border bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600 flex items-center gap-1"
                                    aria-expanded={isOpen}
                                  >
                                    {doneCount}/12
                                    {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  </button>
                                </div>
                              );
                            })()}
                            {expandedRecurringId === targetId && (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                              {MONTHS_SHORT.map((month, idx) => {
                                const monthNum = idx + 1;
                                const key = `${targetId}-${recurringYear}-${monthNum}-0`;
                                const mark = recurringMarks.find(
                                  m => m.targetId === targetId && m.year === recurringYear && m.month === monthNum && (m.week ?? 0) === 0
                                );
                                const isCompleted = mark?.completed || false;
                                const isMarkLoading = recurringMarkKey === key;
                                const isFuture = recurringYear === new Date().getFullYear() && monthNum > new Date().getMonth() + 1;
                                return (
                                  <button
                                    key={monthNum}
                                    onClick={() => !isFuture && toggleRecurringMark(targetId, recurringYear, monthNum, 0)}
                                    disabled={isMarkLoading || isFuture}
                                    title={isFuture ? 'Future month' : `${month} ${recurringYear}`}
                                    aria-label={isFuture ? `${month} ${recurringYear} is a future month` : `Toggle ${month} ${recurringYear} for ${target.personalTarget.title}`}
                                    className={`
                                      h-9 rounded-lg text-xs font-medium transition-all border
                                      ${isCompleted
                                        ? 'bg-green-500 border-green-500 text-white shadow-sm'
                                        : isFuture
                                          ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                                          : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                                      }
                                      ${isMarkLoading ? 'opacity-60 cursor-wait' : ''}
                                    `}
                                  >
                                    {isCompleted ? '✓' : month}
                                  </button>
                                );
                              })}
                            </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
          </div>
        )}

        {/* Empty state */}
        {targets.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No targets available</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderOrgFilesContent = () => {
    const categories = ["all", "constitution", "guidelines", "video", "audio", "document", "link", "other"];
    return (
      <div className="space-y-3 org-files-malayalam">
            {/* Search + category filter in one row */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={orgFilesSearch}
                  onChange={e => setOrgFilesSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Select value={orgFilesCategory} onValueChange={setOrgFilesCategory}>
                <SelectTrigger className="h-9 w-[7.5rem] shrink-0 text-sm" aria-label="Filter by category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat === "all" ? "All" : orgCategoryLabels[cat] || cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

        {orgFilesLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading files...</div>
        ) : orgFiles.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No files available</p>
            </CardContent>
          </Card>
        ) : (
          orgFiles.map(file => {
            const Icon = orgCategoryIcons[file.category] || File;
            const isOpen = expandedFileId === file._id;
            return (
              <Card key={file._id} className="shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedFileId(isOpen ? null : file._id)}
                  className="flex w-full items-center gap-2.5 p-2.5 text-left"
                >
                  <div className="p-1.5 rounded-lg shrink-0 bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="flex-1 min-w-0 truncate font-medium text-sm malayalam-text">{file.title}</p>
                  {isOpen ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
                {isOpen && (
                  <div className="px-2.5 pb-2.5 pl-11">
                    {file.description && (
                      <p className="text-xs text-muted-foreground line-clamp-3 malayalam-text">{file.description}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      <Badge variant="outline" className="text-xs capitalize">
                        {orgCategoryLabels[file.category] || file.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatOrgFileSize(file.size)}</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {file.category === "link" && file.link ? (
                        <a href={file.link} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="text-xs h-7">
                            <Link2 className="h-3 w-3 mr-1" />Open Link
                          </Button>
                        </a>
                      ) : file.url ? (
                        <>
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setViewerFile(file)}>
                            <Eye className="h-3 w-3 mr-1" />View
                          </Button>
                          <a href={file.url} download>
                            <Button size="sm" variant="ghost" className="text-xs h-7">
                              <Download className="h-3 w-3 mr-1" />Download
                            </Button>
                          </a>
                        </>
                      ) : null}
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    );
  };

  const renderMeetingsContent = () => (
    <div className="space-y-3">
      {meetings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No upcoming meetings scheduled
            </p>
          ) : (
            <div className="space-y-2.5">
              {meetings.map((meeting) => {
                const isOpen = expandedMeetingId === meeting._id;
                return (
                <Card
                  key={meeting._id}
                  className={`overflow-hidden transition-colors ${isOpen ? "border-green-500/40" : "hover:border-green-500/30"}`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedMeetingId(isOpen ? null : meeting._id)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <div className="shrink-0 rounded-lg bg-green-100 p-2 text-green-600">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-sm malayalam-text">{meeting.title}</h3>
                      <p className="text-xs text-muted-foreground">{formatDate(meeting.scheduledDate)}</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="space-y-2 px-3 pb-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className="bg-green-100 text-green-800 text-xs">{meeting.meetingType}</Badge>
                        <Badge className="bg-blue-100 text-blue-800 text-xs">{meeting.status}</Badge>
                      </div>
                      {meeting.description && (
                        <p className="text-sm text-muted-foreground malayalam-text">{meeting.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(meeting.scheduledDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {meeting.duration} min
                        </span>
                        {meeting.venue && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="malayalam-text">{meeting.venue}</span>
                          </span>
                        )}
                      </div>
                      {meeting.agenda && meeting.agenda.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-foreground">Agenda</p>
                          {meeting.agenda.map((item, index) => (
                            <div key={index} className="rounded-lg border border-border/60 p-2">
                              <p className="text-sm font-medium malayalam-text">{item.item}</p>
                              <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                                {item.duration ? <span>{item.duration} min</span> : null}
                                {item.presenter ? <span className="malayalam-text">{item.presenter}</span> : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
                );
              })}
            </div>
          )}
    </div>
  );

  const renderNotificationsContent = () => (
    <div className="space-y-3">
      {notifications.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No notifications available
            </p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <Card key={notification._id} className={`${!notification.isRead ? 'border-l-4 border-l-blue-500' : ''}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-3 h-3 rounded-full mt-1 ${notification.isRead ? 'bg-gray-300' : 'bg-blue-500'}`} />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium">{notification.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge className={`text-xs ${notification.priority === 'high' ? 'bg-red-100 text-red-800' :
                            notification.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'}`}>
                            {notification.priority}
                          </Badge>
                          <Badge className="bg-blue-100 text-blue-800 text-xs">
                            {notification.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDate(notification.createdAt)}
                        </p>
                        {notification.attachments && notification.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <Paperclip className="h-3 w-3" /> Attachments:
                            </p>
                            {notification.attachments.map((att, i) => {
                              const mime = att.mimetype || '';
                              const Icon = mime.startsWith('image/') ? Image : mime.startsWith('video/') ? Film : FileText;
                              return (
                                <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm text-primary hover:underline">
                                  <Icon className="h-4 w-4 flex-shrink-0" />
                                  <span className="truncate">{att.originalName || `File ${i + 1}`}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
    </div>
  );

  return (
    <>
    <PageShell contentClassName="pb-40 lg:pb-8">
      <header className="hero-card">
        <div className="flex items-center gap-3">
          {/* ponytail: brand logo on mobile only — desktop sidebar already shows it */}
          <img src="/logo-icon.png" alt="Solidarity Connect logo" className="h-10 w-10 shrink-0 rounded-xl object-contain lg:hidden" />
          {activeView === "overview" ? (
            <>
              {profile.profile.avatar ? (
                <img
                  src={profile.profile.avatar}
                  alt={profile.profile.name}
                  className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white/40"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">
                  {profile.profile.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold leading-tight">{profile.profile.name}</p>
                <p className="truncate text-xs text-primary-foreground/70">
                  {profile.profile.group.name === profile.profile.district.name
                    ? profile.profile.district.name
                    : `${profile.profile.group.name} • ${profile.profile.district.name}`}
                </p>
              </div>
            </>
          ) : (
            <p className="min-w-0 flex-1 truncate text-base font-bold">
              {{ profile: "My Profile", targets: "Targets", meetings: "Meetings", baithul: "Baithul Maal", orgfiles: "Files", notifications: "Notifications", leaders: "Leaders" }[activeView] || ""}
            </p>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="relative shrink-0 border-0 bg-white/15 text-white hover:bg-white/25 hover:text-white"
            onClick={() => setActiveView("notifications")}
            aria-label={`Notifications${unreadNotificationCount > 0 ? `, ${unreadNotificationCount} unread` : ""}`}
          >
            <Bell className="h-5 w-5" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-primary">
                {unreadNotificationCount}
              </span>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/* ponytail: hamburger hidden on lg — sidebar covers profile/roles/logout there */}
              <Button variant="ghost" size="icon" className="border-0 bg-white/15 text-white hover:bg-white/25 hover:text-white lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass w-64 rounded-xl border-border/50 p-1.5 shadow-2xl">
              <div className="px-3 py-2.5 mb-1 bg-secondary/50 rounded-xl">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logged in as</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{profile.profile.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{profile.profile.phone}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {profile.profile.group.name === profile.profile.district.name
                    ? profile.profile.district.name
                    : `${profile.profile.group.name} · ${profile.profile.district.name}`}
                </p>
              </div>
              {availableRoles.filter((role) => role !== "member").length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-3 pt-1.5 pb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Switch role
                  </div>
                  {availableRoles.filter((role) => role !== "member").map((role) => (
                    <DropdownMenuItem
                      key={role}
                      onClick={async () => {
                        try {
                          await switchRole(role);
                          navigate(getHomeRouteByRole(role));
                        } catch {
                          toast({ title: "Switch failed", description: "Could not switch role.", variant: "destructive" });
                        }
                      }}
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      {role === "state_admin" ? "State Admin" : role === "district_admin" ? "District Admin" : "Area Admin"}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setActiveView("profile")}>
                <User className="mr-2 h-4 w-4" />My Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLeadersClick}>
                <Star className="mr-2 h-4 w-4" />Leaders
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowLogoutConfirm(true)} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {renderContent()}

      <div className="fixed bottom-4 left-4 right-4 z-30 lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around rounded-2xl border border-border/70 bg-background/95 px-3 py-2 shadow-lg">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                aria-pressed={isActive}
                className={`flex min-w-0 flex-1 flex-col items-center space-y-1 rounded-2xl px-2 py-2 transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
              >
                <IconComponent className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-[11px] font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </PageShell>

    <Dialog open={!!viewerFile} onOpenChange={(o) => !o && setViewerFile(null)}>
      <DialogContent className="max-w-3xl p-3 sm:p-4">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate text-base malayalam-text">{viewerFile?.title}</DialogTitle>
        </DialogHeader>
        {viewerFile && (
          viewerFile.mimetype?.startsWith("image/") ? (
            <img src={viewerFile.url} alt={viewerFile.title} className="max-h-[70dvh] w-full rounded-lg object-contain" />
          ) : viewerFile.mimetype?.startsWith("video/") ? (
            <video src={viewerFile.url} controls className="max-h-[70dvh] w-full rounded-lg" />
          ) : viewerFile.mimetype?.startsWith("audio/") ? (
            <audio src={viewerFile.url} controls className="w-full" />
          ) : viewerFile.mimetype === "application/pdf" ? (
            <iframe src={viewerFile.url} title={viewerFile.title} className="h-[70dvh] w-full rounded-lg border" />
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Preview not available for this file type.
              <a href={viewerFile.url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-primary hover:underline">
                Open in new tab
              </a>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={showChangeRequest} onOpenChange={setShowChangeRequest}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Request Name/Phone Change</DialogTitle>
          <DialogDescription>Your area admin will review and approve this change.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="change-request-name" className="text-sm font-medium">New Name</label>
            <Input
              id="change-request-name"
              value={changeRequestForm.name}
              onChange={e => setChangeRequestForm(p => ({ ...p, name: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="change-request-phone" className="text-sm font-medium">New Phone</label>
            <Input
              id="change-request-phone"
              type="tel"
              value={changeRequestForm.phone}
              onChange={e => setChangeRequestForm(p => ({ ...p, phone: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="change-request-note" className="text-sm font-medium">Reason (optional)</label>
            <Input
              id="change-request-note"
              value={changeRequestForm.note}
              onChange={e => setChangeRequestForm(p => ({ ...p, note: e.target.value }))}
              placeholder="Why is this change needed?"
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter className="flex flex-row gap-2 justify-end">
          <Button variant="outline" onClick={() => setShowChangeRequest(false)} disabled={changeRequestSending}>Cancel</Button>
          <Button onClick={submitChangeRequest} disabled={changeRequestSending}>
            {changeRequestSending ? "Sending..." : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Confirm Logout</DialogTitle>
          <DialogDescription>Are you sure you want to log out?</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-row gap-2 justify-end">
          <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { logout(); navigate("/login"); }}>
            Logout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default MemberDashboard;