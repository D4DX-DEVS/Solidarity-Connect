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
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { memberAuthAPI, apiCall } from "@/utils/api";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  Search
} from "lucide-react";

interface MemberProfile {
  profile: {
    id: string;
    name: string;
    phone: string;
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
  other: "Other"
};

const orgCategoryIcons: Record<string, React.ElementType> = {
  constitution: BookOpen,
  guidelines: Book,
  video: Film,
  audio: Music,
  document: FileText,
  other: File
};

const formatOrgFileSize = (bytes: number) => {
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
  const [activeView, setActiveView] = useState("overview");
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

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({
    name: "",
    email: "",
    profession: "",
    education: "",
    address: "",
    bloodGroup: "",
    age: "",
    areaOfInterest: "",
    skills: ""
  });

  const { token, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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

  if (loading) {
    return (
      <PageShell contentClassName="pb-32">
        <PageHero
          title="Member Dashboard"
          subtitle="Loading your profile, targets, meetings, and notifications."
          eyebrow="Member Portal"
          icon={<Home className="h-6 w-6" />}
        />
        <SectionCard title="Preparing Dashboard" description="Fetching the latest member workspace data.">
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
              <p className="text-muted-foreground">Loading dashboard...</p>
            </div>
          </div>
        </SectionCard>
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
    { id: "overview", label: "Overview", icon: Home },
    { id: "profile", label: "Profile", icon: User },
    { id: "targets", label: "Targets", icon: Target },
    { id: "meetings", label: "Meetings", icon: Calendar },
    { id: "orgfiles", label: "Org Files", icon: FolderOpen },
    { id: "notifications", label: "Alerts", icon: Bell }
  ];


  const activeViewLabel = menuItems.find((item) => item.id === activeView)?.label || "Overview";
  const unreadNotificationCount = notifications.filter((notification) => !notification.isRead).length;
  const handleLeadersClick = () => navigate("/leaders");
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
      default:
        return renderOverviewContent();
    }
  };

  const renderOverviewContent = () => (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Baithul Maal Paid</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(profile.baithulMaal.totalPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              {profile.baithulMaal.paymentCount} payments made
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(profile.baithulMaal.pendingAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              Monthly: {formatCurrency(profile.baithulMaal.monthlyAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Targets</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {targets.filter(t => t.status === 'in_progress' || t.status === 'not_started').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {targets.filter(t => t.status === 'completed').length} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Meetings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meetings.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Next scheduled items
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Targets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Recent Targets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {targets.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No targets available
            </p>
          ) : (
            <div className="space-y-4">
              {targets.slice(0, 3).map((target) => (
                <div key={target._id ?? target.personalTarget._id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {getCategoryIcon(target.personalTarget.category)}
                    </span>
                    <div>
                      <h4 className="font-medium">{target.personalTarget.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {target.currentProgress} / {target.targetValue} {target.personalTarget.unit}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={getStatusColor(target.status)}>
                      {target.status.replace('_', ' ')}
                    </Badge>
                    <div className="text-sm font-medium mt-1">
                      {target.progressPercentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recent Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No recent notifications
            </p>
          ) : (
            <div className="space-y-3">
              {notifications.slice(0, 3).map((notification) => (
                <div key={notification._id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className={`w-2 h-2 rounded-full mt-2 ${notification.isRead ? 'bg-gray-300' : 'bg-blue-500'}`} />
                  <div className="flex-1">
                    <h4 className="font-medium">{notification.title}</h4>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(notification.createdAt)}
                    </p>
                    {notification.attachments && notification.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {notification.attachments.map((att, i) => {
                          const mime = att.mimetype || '';
                          const Icon = mime.startsWith('image/') ? Image : mime.startsWith('video/') ? Film : FileText;
                          return (
                            <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-primary hover:underline">
                              <Icon className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{att.originalName || `File ${i + 1}`}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leaders Quick Link */}
      <Card
        className="shadow-sm border-primary/20 cursor-pointer hover:border-primary/50 transition-colors"
        onClick={handleLeadersClick}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className="bg-yellow-100 p-2 rounded-full">
            <Star className="h-5 w-5 text-yellow-600 fill-yellow-500" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Leaders</p>
            <p className="text-sm text-muted-foreground">View all designated leaders</p>
          </div>
          <Star className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  );

  const openEditProfile = () => {
    setEditProfileForm({
      name: profile!.profile.name || "",
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
          {!isEditingProfile ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <p className="text-lg">{profile.profile.name}</p>
              </div>
              <div>
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
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <p className="text-lg">{profile.profile.address}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="member-profile-name" className="text-sm font-medium">Name *</label>
                <Input
                  id="member-profile-name"
                  value={editProfileForm.name}
                  onChange={e => setEditProfileForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Full name"
                  className="mt-1"
                />
              </div>
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
                  Phone number and group/district cannot be changed here. Contact your admin for such changes.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Baithul Maal Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Personal Targets
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                            <span className="text-2xl shrink-0">{getCategoryIcon(target.personalTarget.category)}</span>
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
            </CardContent>
          </Card>
        )}

        {/* ── Recurring Targets (same as district admin: title + month grid, mark done only) ── */}
        {recurringTargets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-500" />
                Recurring Targets
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Tick each month you completed the target. You can mark or unmark anytime.
              </p>
            </CardHeader>
            <CardContent>
              {/* Year selector */}
              <div className="flex items-center gap-2 mb-4">
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

              <div className="space-y-4">
                {recurringTargets.map((target) => {
                  const targetId = target.personalTarget._id;
                  const freq = target.personalTarget.recurringFrequency || 'monthly';
                  return (
                    <Card key={target._id ?? targetId} className="border border-blue-100">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xl shrink-0">{getCategoryIcon(target.personalTarget.category)}</span>
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
                            <p className="text-xs text-muted-foreground mb-2 font-medium">Mark completed months:</p>
                            <div className="grid grid-cols-6 gap-1.5">
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
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
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
    const categories = ["all", "constitution", "guidelines", "video", "audio", "document", "other"];
    return (
      <div className="space-y-3 org-files-malayalam">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Organizational Files
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {/* Category filter */}
            <div className="px-4 pt-1 pb-2 flex gap-2 overflow-x-auto">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setOrgFilesCategory(cat)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    orgFilesCategory === cat
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:border-primary"
                  }`}
                >
                  {cat === "all" ? "All" : orgCategoryLabels[cat] || cat}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={orgFilesSearch}
                  onChange={e => setOrgFilesSearch(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

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
            return (
              <Card key={file._id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg shrink-0 bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm malayalam-text">{file.title}</p>
                      {file.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 malayalam-text">{file.description}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <Badge variant="outline" className="text-xs capitalize">
                          {orgCategoryLabels[file.category] || file.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatOrgFileSize(file.size)}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <a href={file.url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="text-xs h-7">
                            {file.mimetype?.startsWith('video/') || file.mimetype?.startsWith('audio/') ? (
                              <><Eye className="h-3 w-3 mr-1" />Open</>
                            ) : (
                              <><Eye className="h-3 w-3 mr-1" />View</>
                            )}
                          </Button>
                        </a>
                        <a href={file.url} download>
                          <Button size="sm" variant="ghost" className="text-xs h-7">
                            <Download className="h-3 w-3 mr-1" />Download
                          </Button>
                        </a>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    );
  };

  const renderMeetingsContent = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Meetings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {meetings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No upcoming meetings scheduled
            </p>
          ) : (
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <Card key={meeting._id} className="border-l-4 border-l-green-500">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{meeting.title}</h3>
                        {meeting.description && (
                          <p className="text-muted-foreground mb-2">{meeting.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(meeting.scheduledDate)}
                          </span>
                          <span>Duration: {meeting.duration} minutes</span>
                          {meeting.venue && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {meeting.venue}
                            </span>
                          )}
                        </div>
                        {meeting.agenda && meeting.agenda.length > 0 && (
                          <div className="mt-3">
                            <strong className="text-sm">Agenda:</strong>
                            <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                              {meeting.agenda.slice(0, 3).map((item, index) => (
                                <li key={index}>{item.item}</li>
                              ))}
                              {meeting.agenda.length > 3 && (
                                <li>... and {meeting.agenda.length - 3} more items</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge className="bg-green-100 text-green-800">
                          {meeting.meetingType}
                        </Badge>
                        <Badge className="bg-blue-100 text-blue-800 ml-2">
                          {meeting.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderNotificationsContent = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{notification.title}</h4>
                            <p className="text-muted-foreground mt-1">{notification.message}</p>
                          </div>
                          <div className="text-right">
                            <Badge className={`${notification.priority === 'high' ? 'bg-red-100 text-red-800' : 
                              notification.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-gray-100 text-gray-800'}`}>
                              {notification.priority}
                            </Badge>
                            <Badge className="bg-blue-100 text-blue-800 ml-2">
                              {notification.type}
                            </Badge>
                          </div>
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
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
    <PageShell contentClassName="pb-40">
      <PageHero
        title={`Welcome, ${profile.profile.name}`}
        subtitle={`${profile.profile.group.name} • ${profile.profile.district.name}`}
        eyebrow="Member Portal"
        icon={<Home className="h-6 w-6" />}
        actions={
          <Button variant="outline" onClick={() => setShowLogoutConfirm(true)}>
            Logout
          </Button>
        }
        details={
          <>
            <div className="data-strip space-y-1 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</p>
              <p className="text-sm font-semibold text-foreground">{profile.profile.status || "Member"}</p>
            </div>
            <div className="data-strip space-y-1 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Joined</p>
              <p className="text-sm font-semibold text-foreground">{formatDate(profile.profile.joinedDate)}</p>
            </div>
            <div className="data-strip space-y-1 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Current View</p>
              <p className="text-sm font-semibold text-foreground">{activeViewLabel}</p>
            </div>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard title="Targets" value={String(targets.length)} icon={Target} tone="primary" />
        <MetricCard title="Upcoming Meetings" value={String(meetings.length)} icon={Calendar} tone="success" />
        <MetricCard title="Unread Alerts" value={String(unreadNotificationCount)} icon={Bell} tone="warning" />
      </div>

      <SectionCard
        title={`${activeViewLabel} Workspace`}
        description="Use the bottom tabs to move between member sections while keeping the existing dashboard actions unchanged."
      >
        <div className="space-y-4">
          {renderContent()}
        </div>
      </SectionCard>

      <div className="fixed bottom-4 left-4 right-4 z-30">
        <div className="mx-auto flex max-w-md items-center justify-around rounded-[1.6rem] border border-border/70 bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                aria-pressed={isActive}
                className={`flex min-w-0 flex-col items-center space-y-1 rounded-2xl px-3 py-2 transition-colors ${
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