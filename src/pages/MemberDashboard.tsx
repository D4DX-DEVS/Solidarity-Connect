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
import LogoutConfirmDialog from "@/components/LogoutConfirmDialog";
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
import { memberAuthAPI } from "@/utils/api";
import { MemberAreaReport } from "@/components/reports/MemberAreaReport";
import { downloadFile } from "@/utils/downloadFile";
import { useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getHomeRouteByRole } from "@/lib/roleRoutes";
import { FEATURES } from "@/lib/features";
import { confirmAction } from "@/lib/confirm";
import { undoableDelete, type UndoHandle } from "@/lib/undoDelete";
import Leaders from "@/pages/Leaders";
import MemberDirectory from "@/pages/MemberDirectory";
import {
  User,
  CreditCard,
  Calendar,
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
  Clock,
  ChevronDown,
  ChevronUp,
  Upload,
  Trash2,
  X,
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
} from "lucide-react";

interface MemberProfile {
  profile: {
    id: string;
    name: string;
    phone: string;
    avatar?: string | null;
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

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MemberDashboard = () => {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get("view") || "overview";
  // Baithul Maal is switched off (lib/features): old ?view=baithul links show the overview.
  // Meetings likewise hidden: ?view=meetings falls back to the overview.
  // The area report lives on the overview, so old ?view=report links land there.
  const activeView =
    (requestedView === "baithul" && !FEATURES.baithulMaal) || (requestedView === "meetings" && !FEATURES.meetings) || requestedView === "report"
      ? "overview"
      : requestedView;
  const setActiveView = (view: string) =>
    setSearchParams(view === "overview" ? {} : { view }, { replace: true });
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
  // A photo removal still inside its undo window; a new upload cancels it
  const pendingAvatarRemoval = useRef<UndoHandle | null>(null);
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

  const { token, logout, availableAccounts, switchAccount } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [baithulPayments, setBaithulPayments] = useState<BaithulPayment[]>([]);
  const [baithulLoading, setBaithulLoading] = useState(false);
  const [baithulFetched, setBaithulFetched] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch profile
        const profileData = await memberAuthAPI.getProfile();
        setProfile(profileData.data);

        // Fetch upcoming meetings
        if (FEATURES.meetings) {
          const meetingsData = await memberAuthAPI.getMeetings({
            status: 'scheduled',
            limit: '5'
          });
          setMeetings(meetingsData.data.meetings);
        }

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
  }, [activeView, orgFilesCategory, orgFilesDebouncedSearch, toast]);

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
          showTitleOnMobile
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

  const menuItems = [
    { id: "overview", label: "Home", icon: Home },
    ...(FEATURES.meetings ? [{ id: "meetings", label: "Meetings", icon: Calendar }] : []),
    { id: "members", label: "Members", icon: Users },
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
      case "members":
        return <MemberDirectory embedded />;
      default:
        return renderOverviewContent();
    }
  };

  const renderOverviewContent = () => (
    <div className="space-y-4">
      {/* Compact stat strip — only meetings feed it, so it shows only when meetings are on */}
      {FEATURES.meetings ? <div className="grid grid-cols-2 gap-2">
        {[
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
      </div> : null}

      {/* Baithul Maal summary — opens Baithul Maal view */}
      {FEATURES.baithulMaal && <Card
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
      </Card>}

      <MemberAreaReport />

    </div>
  );

  const uploadAvatar = async (file: File) => {
    // The new photo replaces the old one anyway — don't let a waiting removal clear it later
    pendingAvatarRemoval.current?.discard();
    pendingAvatarRemoval.current = null;
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

  const removeAvatar = async () => {
    const previous = profile?.profile.avatar;
    if (!previous) return;
    const confirmed = await confirmAction({
      title: "Remove your profile photo?",
      description: "Your initials show in its place.",
      confirmLabel: "Remove",
      undoable: true,
    });
    if (!confirmed) return;
    setProfile(prev => prev ? { ...prev, profile: { ...prev.profile, avatar: null } } : prev);
    pendingAvatarRemoval.current = undoableDelete({
      title: "Photo removed",
      commit: () => memberAuthAPI.updateProfile({ avatar: null }, { keepalive: true }),
      // Only put it back if no new photo was uploaded meanwhile
      onRestore: () => setProfile(prev => prev && !prev.profile.avatar ? { ...prev, profile: { ...prev.profile, avatar: previous } } : prev),
    });
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
    } catch (error: unknown) {
      toast({ title: "Error", description: (error instanceof Error && error.message) || "Failed to send request", variant: "destructive" });
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
      const payload: Record<string, string | number> = { ...editProfileForm };
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
    } catch (error: unknown) {
      toast({ title: "Error", description: (error instanceof Error && error.message) || "Failed to update profile", variant: "destructive" });
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
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" disabled={avatarUploading} onClick={() => avatarFileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {avatarUploading ? "Uploading..." : "Change Photo"}
                </Button>
                {profile.profile.avatar && (
                  <Button size="sm" variant="outline" disabled={avatarUploading} onClick={removeAvatar}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
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
                <div className="text-lg flex items-center">
                  <Badge className={`${profile.profile.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                    {profile.profile.status}
                  </Badge>
                </div>
              </div>
              {profile.profile.address && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Unit</label>
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
                <label htmlFor="member-profile-address" className="text-sm font-medium">Unit</label>
                <Input
                  id="member-profile-address"
                  value={editProfileForm.address}
                  onChange={e => setEditProfileForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="e.g. Vaduthala"
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

      {FEATURES.baithulMaal && baithulDetailsCard}
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
                    <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto mt-1.5">
                      <Badge variant="outline" className="text-xs capitalize shrink-0">
                        {orgCategoryLabels[file.category] || file.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground shrink-0">{formatOrgFileSize(file.size)}</span>
                      {file.category === "link" && file.link ? (
                        <a href={file.link} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <Button size="sm" variant="outline" className="text-xs h-7">
                            <Link2 className="h-3 w-3 mr-1" />Open Link
                          </Button>
                        </a>
                      ) : file.url ? (
                        <>
                          <Button size="sm" variant="outline" className="text-xs h-7 shrink-0" onClick={() => setViewerFile(file)}>
                            <Eye className="h-3 w-3 mr-1" />View
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs h-7 shrink-0" onClick={() => downloadFile(file.url, file.originalName || file.title)}>
                            <Download className="h-3 w-3 mr-1" />Download
                          </Button>
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
      {/* ponytail: like every other role, mobile shows the header only on the dashboard view */}
      <header className={`hero-card ${activeView === "overview" ? "" : "max-lg:hidden"}`}>
        <div className="flex items-center gap-3">
          {/* ponytail: brand logo on mobile only — desktop sidebar already shows it */}
          <img src="/logo-icon.png" alt="Solidarity Connect logo" className="h-10 w-10 shrink-0 rounded-xl border-2 border-primary bg-white object-contain p-0.5 lg:hidden" />
          {activeView === "overview" ? (
            <>
              {profile.profile.avatar ? (
                <img
                  src={profile.profile.avatar}
                  alt={profile.profile.name}
                  className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-border"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {profile.profile.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold leading-tight">{profile.profile.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {profile.profile.group.name === profile.profile.district.name
                    ? profile.profile.district.name
                    : `${profile.profile.group.name} • ${profile.profile.district.name}`}
                </p>
              </div>
            </>
          ) : (
            <p className="min-w-0 flex-1 truncate text-base font-bold">
              {{ profile: "My Profile", meetings: "Meetings", baithul: "Baithul Maal", orgfiles: "Files", notifications: "Notifications", leaders: "Leaders", members: "Members" }[activeView] || ""}
            </p>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="relative shrink-0 border border-border bg-card text-foreground hover:bg-muted"
            onClick={() => setActiveView("notifications")}
            aria-label={`Notifications${unreadNotificationCount > 0 ? `, ${unreadNotificationCount} unread` : ""}`}
          >
            <Bell className="h-5 w-5" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unreadNotificationCount}
              </span>
            )}
          </Button>
        </div>
      </header>

      {renderContent()}

      {/* ponytail: same shape as BottomNav — tabs plus a "More" menu, no header hamburger */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-3 pb-safe lg:hidden">
        <nav className="pointer-events-auto w-full max-w-md rounded-2xl border border-border/70 bg-background/95 px-2 py-2 shadow-lg">
          <div className={`grid h-[4.6rem] items-center gap-1 ${menuItems.length + 1 >= 6 ? "grid-cols-6" : "grid-cols-5"}`}>
            {menuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  aria-pressed={isActive}
                  className={`flex h-full flex-col items-center justify-center rounded-xl px-1 transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  <IconComponent className="h-5 w-5" />
                  <span className="mt-1 text-[10px] font-semibold tracking-wide">{item.label}</span>
                </button>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-full flex-col items-center justify-center rounded-xl px-1 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground data-[state=open]:bg-primary/10 data-[state=open]:text-primary">
                  <Menu className="h-5 w-5" />
                  <span className="mt-1 text-[10px] font-semibold tracking-wide">More</span>
                </button>
              </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" sideOffset={12} className="glass w-64 rounded-xl border-border/50 p-1.5 shadow-2xl">
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
                  {availableAccounts.filter((account) => account.type !== "member").length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-3 pt-1.5 pb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Switch account
                      </div>
                      {/* Account-based: Area/Murabi/Coordinator admin share role 'group_admin',
                          so a role-name list would collapse them into one entry. */}
                      {availableAccounts.filter((account) => account.type !== "member").map((account) => (
                        <DropdownMenuItem
                          key={account.id}
                          onClick={async () => {
                            try {
                              await switchAccount(account);
                              navigate(getHomeRouteByRole(account.role));
                            } catch {
                              toast({ title: "Switch failed", description: "Could not switch account.", variant: "destructive" });
                            }
                          }}
                        >
                          <Link2 className="mr-2 h-4 w-4" />
                          {account.label}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveView("notifications")}>
                  <Bell className="mr-2 h-4 w-4" />Notifications
                  {unreadNotificationCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {unreadNotificationCount}
                    </span>
                  )}
                </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveView("profile")}>
                    <User className="mr-2 h-4 w-4" />My Profile
                  </DropdownMenuItem>
                  {/* ponytail: Leaders removed — it's a tab in the bottom bar already */}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowLogoutConfirm(true)} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
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

    <LogoutConfirmDialog
      open={showLogoutConfirm}
      onOpenChange={setShowLogoutConfirm}
      onConfirm={() => { logout(); navigate("/login"); }}
    />
    </>
  );
};

export default MemberDashboard;