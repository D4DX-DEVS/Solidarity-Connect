import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { memberAuthAPI } from "@/utils/api";
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
  X
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
  };
  currentProgress: number;
  targetValue: number;
  progressPercentage: number;
  status: string;
  completedAt?: string;
  feedback?: string;
  fileAttachment?: FileAttachment | null;
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
  const { token, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Use the common API utility

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

      } catch (error) {
        console.error('Error fetching data:', error);
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
  }, [token, toast, logout]);

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Failed to load profile data</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

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
    { id: "leaders", label: "Leaders", icon: Star },
    { id: "notifications", label: "Notifications", icon: Bell }
  ];

  const handleLeadersClick = () => navigate("/leaders");

  const renderContent = () => {
    switch (activeView) {
      case "overview":
        return renderOverviewContent();
      case "profile":
        return renderProfileContent();
      case "targets":
        return renderTargetsContent();
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
              This month
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

  const renderProfileContent = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Badge className="bg-green-100 text-green-800">
                {profile.profile.status}
              </Badge>
            </div>
          </div>
          {profile.profile.address && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Address</label>
              <p className="text-lg">{profile.profile.address}</p>
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

  const renderTargetsContent = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Personal Targets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {targets.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No targets available</p>
          ) : (
            <div className="space-y-3">
              {targets.map((target) => {
                const targetId = target.personalTarget._id;
                const isExpanded = expandedTargetId === targetId;
                const isSaving = targetSaving === targetId;
                const isUploading = targetUploading === targetId;
                const attachment = uploadedTargetAttachments[targetId];
                const pendingFile = pendingTargetFiles[targetId];

                return (
                  <Card key={target._id ?? target.personalTarget._id} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-3 pb-3">
                      {/* Header row */}
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
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.min(100, target.progressPercentage)}%` }}
                        />
                      </div>

                      {/* Expanded section */}
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

                          {/* Feedback */}
                          <div>
                            <label className="text-xs font-medium flex items-center gap-1 mb-1">
                              <MessageSquare className="h-3 w-3" /> Feedback
                            </label>
                            <textarea
                              className="w-full text-xs border rounded p-2 min-h-[60px] bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                              placeholder="Add your feedback..."
                              value={targetFeedback[targetId] || ''}
                              onChange={(e) => setTargetFeedback(prev => ({ ...prev, [targetId]: e.target.value }))}
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

                          {/* Action buttons */}
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
                            <p className="text-xs text-green-600">
                              Completed on {formatDate(target.completedAt)}
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

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
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome, {profile.profile.name}
            </h1>
            <p className="text-muted-foreground">
              {profile.profile.group.name} • {profile.profile.district.name}
            </p>
          </div>
          <Button variant="outline" onClick={logout}>
            Logout
          </Button>
        </div>

        {/* Content Area */}
        <div className="space-y-4">
          {renderContent()}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex justify-around items-center max-w-md mx-auto">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => item.id === "leaders" ? navigate("/leaders") : setActiveView(item.id)}
                className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors ${
                  isActive 
                    ? 'text-blue-600 bg-blue-50' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <IconComponent className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-600'}`} />
                <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MemberDashboard;