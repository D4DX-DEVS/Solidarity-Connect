import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { memberAuthAPI } from "@/utils/api";
import { 
  User, 
  CreditCard, 
  Calendar, 
  Target, 
  Bell, 
  TrendingUp,
  MapPin,
  Users,
  Phone,
  Mail,
  IndianRupee,
  Home
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

interface PersonalTarget {
  _id: string;
  personalTarget: {
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
}

const MemberDashboard = () => {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [targets, setTargets] = useState<PersonalTarget[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("overview");
  const { token, logout } = useAuth();
  const { toast } = useToast();

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

  const menuItems = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "profile", label: "Profile", icon: User },
    { id: "targets", label: "Targets", icon: Target },
    { id: "notifications", label: "Notifications", icon: Bell }
  ];

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
                <div key={target._id} className="flex items-center justify-between p-3 border rounded-lg">
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
                  </div>
                </div>
              ))}
            </div>
          )}
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
            <p className="text-muted-foreground text-center py-8">
              No targets available
            </p>
          ) : (
            <div className="space-y-4">
              {targets.map((target) => (
                <Card key={target._id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-3xl">
                          {getCategoryIcon(target.personalTarget.category)}
                        </span>
                        <div>
                          <h3 className="font-semibold text-lg">{target.personalTarget.title}</h3>
                          <p className="text-muted-foreground mb-2">{target.personalTarget.description}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <span>
                              <strong>Progress:</strong> {target.currentProgress} / {target.targetValue} {target.personalTarget.unit}
                            </span>
                            <span>
                              <strong>Category:</strong> {target.personalTarget.category}
                            </span>
                          </div>
                          {target.personalTarget.instructions && (
                            <div className="mt-2">
                              <strong className="text-sm">Instructions:</strong>
                              <p className="text-sm text-muted-foreground">{target.personalTarget.instructions}</p>
                            </div>
                          )}
                          {target.personalTarget.rewards && (
                            <div className="mt-2">
                              <strong className="text-sm">Rewards:</strong>
                              <p className="text-sm text-muted-foreground">{target.personalTarget.rewards}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(target.status)}>
                          {target.status.replace('_', ' ')}
                        </Badge>
                        <div className="mt-2">
                          <div className="text-2xl font-bold text-blue-600">
                            {target.progressPercentage.toFixed(1)}%
                          </div>
                          <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, target.progressPercentage)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        Period: {new Date(target.personalTarget.startDate).toLocaleDateString()} - {new Date(target.personalTarget.endDate).toLocaleDateString()}
                      </span>
                      {target.completedAt && (
                        <span className="text-green-600">
                          Completed on {formatDate(target.completedAt)}
                        </span>
                      )}
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
                onClick={() => setActiveView(item.id)}
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