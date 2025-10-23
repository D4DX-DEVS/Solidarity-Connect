import { useState, useEffect } from "react";
import { Calendar, Clock, Users, AlertCircle, CheckCircle, Filter, Search, Download, Eye, BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { format } from "date-fns";
import { meetingsAPI } from "@/utils/api";

interface GroupProgress {
  groupId: string;
  groupName: string;
  groupCode: string;
  district: {
    name: string;
    code: string;
  };
  totalSessions?: number;
  completedSessions?: number;
  totalMembers: number;
  totalGuests: number;
  attendanceRecorded: boolean;
  lastActivity?: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface MeetingData {
  _id: string;
  title: string;
  description: string;
  meetingType: string;
  status: string;
  targetAudience: string;
  scheduledDate: string;
  duration: number;
  createdBy: {
    name: string;
    role: string;
  };
  targetGroups?: Array<{
    name: string;
    code: string;
    district: { name: string; code: string };
  }>;
  targetDistricts?: Array<{
    name: string;
    code: string;
  }>;
  groupProgress?: GroupProgress[];
  overallProgress?: {
    totalGroups: number;
    completedGroups: number;
    inProgressGroups: number;
    pendingGroups: number;
    completionRate: string;
    status: string;
  };
  sessionSummary?: {
    totalSessions: number;
    completedSessions: number;
    pendingSessions: number;
    completionRate: string;
  };
  sessionInfo?: {
    totalSessions: number;
    completedSessions: number;
    upcomingSessions: number;
    pendingSessions: number;
    completionRate: string;
    overallAttendanceRate: string;
    totalParticipants: number;
    totalPresent: number;
    groupWiseStats: Array<{
      groupName: string;
      totalMembers: number;
      presentMembers: number;
      attendanceRate: string;
      sessions: number;
    }>;
    districtWiseStats: Array<{
      districtName: string;
      totalMembers: number;
      presentMembers: number;
      attendanceRate: string;
      sessions: number;
    }>;
  };
  completionStatus?: string;
  reviewFlags?: {
    needsAttention: boolean;
    lowAttendance: boolean;
    incompleteData: boolean;
    issues: string[];
  };
}

interface SummaryStats {
  totalMeetings: number;
  monthlySeriesMeetings: number;
  completedMeetings: number;
  pendingMeetings: number;
  notStartedMeetings: number;
  meetingsNeedingAttention: number;
  lowAttendanceMeetings: number;
  averageAttendanceRate: string;
  averageCompletionRate: string;
  totalParticipants: number;
  totalSessions: number;
  completedSessions: number;
  totalGroups: number;
}

const StateAdminMeetings = () => {
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingData | null>(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    meetingType: '',
    targetAudience: '',
    completionStatus: '',
    attendanceRate: '',
    dateFrom: '',
    dateTo: ''
  });

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      // Fetch both admin overview and detailed review data
      const [overviewResult, reviewResult] = await Promise.all([
        meetingsAPI.getAdminOverview(Object.fromEntries(queryParams)),
        meetingsAPI.getAdminReview(Object.fromEntries(queryParams))
      ]);
      
      if (overviewResult && reviewResult) {
        // Combine the data - use overview for group progress, review for detailed analytics
        const combinedMeetings = overviewResult.data.map((overviewMeeting: any) => {
          const reviewMeeting = reviewResult.data.find((rm: any) => rm._id === overviewMeeting._id);
          return {
            ...overviewMeeting,
            ...reviewMeeting,
            // Keep both group progress and session info
            groupProgress: overviewMeeting.groupProgress,
            overallProgress: overviewMeeting.overallProgress,
            sessionSummary: overviewMeeting.sessionSummary
          };
        });

        // Combine summary stats
        const combinedStats = {
          ...overviewResult.summaryStats,
          ...reviewResult.summaryStats,
          averageCompletionRate: overviewResult.summaryStats.averageCompletionRate || '0'
        };

        setMeetings(combinedMeetings);
        setSummaryStats(combinedStats);
      } else {
        throw new Error('Failed to fetch meetings');
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast({
        title: "Error",
        description: "Failed to load meetings data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      meetingType: '',
      targetAudience: '',
      completionStatus: '',
      attendanceRate: '',
      dateFrom: '',
      dateTo: ''
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'ongoing': return 'bg-yellow-500';
      case 'cancelled': return 'bg-red-500';
      case 'postponed': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getCompletionStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'in_progress': return 'text-yellow-600';
      case 'not_started': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getAttendanceRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (selectedMeeting) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <HeaderWithLogout
          icon={<Eye className="h-6 w-6 text-primary-foreground" />}
          title="Meeting Details"
          leftAction={
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSelectedMeeting(null)}
            >
              ← Back
            </Button>
          }
        />

        <main className="p-4 space-y-4">
          {/* Meeting Header */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{selectedMeeting.title}</CardTitle>
                  <p className="text-muted-foreground mt-1">{selectedMeeting.description}</p>
                </div>
                <div className="flex gap-2">
                  <Badge className={getStatusColor(selectedMeeting.status)}>
                    {selectedMeeting.status}
                  </Badge>
                  {selectedMeeting.reviewFlags?.needsAttention && (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Needs Attention
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Created By</p>
                  <p className="font-medium">{selectedMeeting.createdBy.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedMeeting.createdBy.role}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{format(new Date(selectedMeeting.scheduledDate), 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="font-medium">{selectedMeeting.duration} min</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Target</p>
                  <p className="font-medium">{selectedMeeting.targetAudience.replace('_', ' ')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Session Information */}
          {selectedMeeting.sessionInfo && (
            <>
              {/* Session Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Session Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{selectedMeeting.sessionInfo.totalSessions}</p>
                      <p className="text-sm text-muted-foreground">Total Sessions</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{selectedMeeting.sessionInfo.completedSessions}</p>
                      <p className="text-sm text-muted-foreground">Completed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-600">{selectedMeeting.sessionInfo.pendingSessions}</p>
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{selectedMeeting.sessionInfo.totalParticipants}</p>
                      <p className="text-sm text-muted-foreground">Total Participants</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Completion Rate</span>
                        <span className="font-medium">{selectedMeeting.sessionInfo.completionRate}%</span>
                      </div>
                      <Progress value={parseFloat(selectedMeeting.sessionInfo.completionRate)} />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Attendance Rate</span>
                        <span className={`font-medium ${getAttendanceRateColor(parseFloat(selectedMeeting.sessionInfo.overallAttendanceRate))}`}>
                          {selectedMeeting.sessionInfo.overallAttendanceRate}%
                        </span>
                      </div>
                      <Progress value={parseFloat(selectedMeeting.sessionInfo.overallAttendanceRate)} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Group-wise Statistics */}
              {selectedMeeting.sessionInfo.groupWiseStats.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Group-wise Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedMeeting.sessionInfo.groupWiseStats.map((group, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{group.groupName}</p>
                            <p className="text-sm text-muted-foreground">
                              {group.presentMembers}/{group.totalMembers} members attended
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${getAttendanceRateColor(parseFloat(group.attendanceRate))}`}>
                              {group.attendanceRate}%
                            </p>
                            <p className="text-xs text-muted-foreground">{group.sessions} sessions</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* District-wise Statistics */}
              {selectedMeeting.sessionInfo.districtWiseStats.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>District-wise Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedMeeting.sessionInfo.districtWiseStats.map((district, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{district.districtName}</p>
                            <p className="text-sm text-muted-foreground">
                              {district.presentMembers}/{district.totalMembers} members attended
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${getAttendanceRateColor(parseFloat(district.attendanceRate))}`}>
                              {district.attendanceRate}%
                            </p>
                            <p className="text-xs text-muted-foreground">{district.sessions} sessions</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Issues and Recommendations */}
          {selectedMeeting.reviewFlags?.issues && selectedMeeting.reviewFlags.issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  Issues Identified
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedMeeting.reviewFlags.issues.map((issue, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm">{issue}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </main>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeaderWithLogout
        icon={<Calendar className="h-6 w-6 text-primary-foreground" />}
        title="Meetings Review"
      />

      <main className="p-4 space-y-4">
        {/* Summary Statistics */}
        {summaryStats && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-4 w-4" />
                Monthly Meetings Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="text-center p-2 bg-muted/50 rounded-lg">
                  <p className="text-lg font-bold text-primary">{summaryStats.totalMeetings}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-lg font-bold text-green-600">{summaryStats.completedMeetings}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>

                <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-lg font-bold text-red-600">{summaryStats.pendingMeetings}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-lg font-bold text-blue-600">{summaryStats.totalGroups}</p>
                  <p className="text-xs text-muted-foreground">Groups</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Group Completion</span>
                    <span className={`font-medium ${getAttendanceRateColor(parseFloat(summaryStats.averageCompletionRate))}`}>
                      {summaryStats.averageCompletionRate}%
                    </span>
                  </div>
                  <Progress value={parseFloat(summaryStats.averageCompletionRate)} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Attendance Rate</span>
                    <span className={`font-medium ${getAttendanceRateColor(parseFloat(summaryStats.averageAttendanceRate))}`}>
                      {summaryStats.averageAttendanceRate}%
                    </span>
                  </div>
                  <Progress value={parseFloat(summaryStats.averageAttendanceRate)} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search meetings..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filters.status || "all"} onValueChange={(value) => handleFilterChange('status', value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="postponed">Postponed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.meetingType || "all"} onValueChange={(value) => handleFilterChange('meetingType', value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Meeting Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="monthly_series">Monthly Series</SelectItem>
                  <SelectItem value="one_time">One Time</SelectItem>
                  <SelectItem value="special">Special</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.completionStatus || "all"} onValueChange={(value) => handleFilterChange('completionStatus', value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Completion Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Completion</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.attendanceRate || "any"} onValueChange={(value) => handleFilterChange('attendanceRate', value === "any" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Min Attendance Rate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Rate</SelectItem>
                  <SelectItem value="80">80% and above</SelectItem>
                  <SelectItem value="60">60% and above</SelectItem>
                  <SelectItem value="40">40% and above</SelectItem>
                  <SelectItem value="20">20% and above</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Meetings List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-1/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-lg mb-2">No Meetings Found</h3>
              <p className="text-muted-foreground">No meetings match your current filters.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {meetings.map((meeting) => (
              <Card key={meeting._id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedMeeting(meeting)}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{meeting.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{meeting.description}</p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Badge className={getStatusColor(meeting.status)}>
                        {meeting.status}
                      </Badge>
                      {meeting.reviewFlags?.needsAttention && (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Attention
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                    <div>
                      <p className="text-muted-foreground">Created By</p>
                      <p className="font-medium">{meeting.createdBy.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date</p>
                      <p className="font-medium">{format(new Date(meeting.scheduledDate), 'MMM dd, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="font-medium">{meeting.meetingType.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Target</p>
                      <p className="font-medium">{meeting.targetAudience.replace('_', ' ')}</p>
                    </div>
                  </div>

                  {meeting.sessionInfo && (
                    <div className="border-t pt-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Sessions</p>
                          <p className="font-medium">
                            {meeting.sessionInfo.completedSessions}/{meeting.sessionInfo.totalSessions}
                            <span className={`ml-2 ${getCompletionStatusColor(meeting.completionStatus || '')}`}>
                              ({meeting.sessionInfo.completionRate}%)
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Participants</p>
                          <p className="font-medium">{meeting.sessionInfo.totalParticipants}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Attendance</p>
                          <p className={`font-medium ${getAttendanceRateColor(parseFloat(meeting.sessionInfo.overallAttendanceRate))}`}>
                            {meeting.sessionInfo.overallAttendanceRate}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <p className={`font-medium ${getCompletionStatusColor(meeting.completionStatus || '')}`}>
                            {meeting.completionStatus?.replace('_', ' ')}
                          </p>
                        </div>
                      </div>

                      {meeting.sessionInfo.overallAttendanceRate && (
                        <div className="mt-3">
                          <Progress value={parseFloat(meeting.sessionInfo.overallAttendanceRate)} className="h-2" />
                        </div>
                      )}
                    </div>
                  )}

                  {meeting.reviewFlags?.issues && meeting.reviewFlags.issues.length > 0 && (
                    <div className="border-t pt-3 mt-3">
                      <div className="flex flex-wrap gap-1">
                        {meeting.reviewFlags.issues.map((issue, index) => (
                          <Badge key={index} variant="outline" className="text-xs text-red-600 border-red-200">
                            {issue}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default StateAdminMeetings;