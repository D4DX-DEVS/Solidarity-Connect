import { useState, useEffect } from "react";
import { Calendar, Clock, Users, AlertCircle, CheckCircle, Eye, Filter, Search, ArrowLeft, BarChart3, MapPin, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
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
  programConducted?: boolean;
  conductedDate?: string;
  lastActivity?: string;
  status: 'pending' | 'completed';
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
  groupProgress: GroupProgress[];
  overallProgress: {
    totalGroups: number;
    completedGroups: number;
    pendingGroups: number;
    programsConducted: number;
    programsNotConducted: number;
    completionRate: string;
    conductionRate: string;
    status: string;
  };
  sessionSummary?: {
    totalSessions: number;
    completedSessions: number;
    pendingSessions: number;
    completionRate: string;
  };
}

interface SummaryStats {
  totalMeetings: number;
  completedMeetings: number;
  pendingMeetings: number;
  totalGroups: number;
  totalProgramsConducted: number;
  totalProgramsNotConducted: number;
  averageCompletionRate: string;
  averageConductionRate: string;
}

const AdminMeetingsView = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingData | null>(null);
  const [viewMode, setViewMode] = useState<'quick' | 'detailed'>('quick');
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    completionStatus: ''
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

      const result = await meetingsAPI.getAdminOverview(Object.fromEntries(queryParams));
      setMeetings(result.data);
      setSummaryStats(result.summaryStats);
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
      completionStatus: ''
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500 text-white';
      case 'pending': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getProgressColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Detailed view for selected meeting
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
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
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
                <Badge className={getStatusColor(selectedMeeting.overallProgress.status)}>
                  {selectedMeeting.overallProgress.status.replace('_', ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Created By</p>
                  <p className="font-medium">{selectedMeeting.createdBy.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{format(new Date(selectedMeeting.scheduledDate), 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium">{selectedMeeting.meetingType.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Target</p>
                  <p className="font-medium">{selectedMeeting.targetAudience.replace('_', ' ')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overall Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Overall Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{selectedMeeting.overallProgress.totalGroups}</p>
                  <p className="text-sm text-muted-foreground">Total Groups</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{selectedMeeting.overallProgress.programsConducted}</p>
                  <p className="text-sm text-muted-foreground">Programs Conducted</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{selectedMeeting.overallProgress.programsNotConducted}</p>
                  <p className="text-sm text-muted-foreground">Not Conducted</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{selectedMeeting.overallProgress.completedGroups}</p>
                  <p className="text-sm text-muted-foreground">Fully Completed</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Program Conduction Rate</span>
                    <span className={`font-medium ${getProgressColor(parseFloat(selectedMeeting.overallProgress.conductionRate))}`}>
                      {selectedMeeting.overallProgress.conductionRate}%
                    </span>
                  </div>
                  <Progress value={parseFloat(selectedMeeting.overallProgress.conductionRate)} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Groups that have conducted the program (recorded attendance)
                  </p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Completion Rate</span>
                    <span className={`font-medium ${getProgressColor(parseFloat(selectedMeeting.overallProgress.completionRate))}`}>
                      {selectedMeeting.overallProgress.completionRate}%
                    </span>
                  </div>
                  <Progress value={parseFloat(selectedMeeting.overallProgress.completionRate)} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Groups that have fully completed all requirements
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Session Summary (for monthly series) */}
          {selectedMeeting.sessionSummary && (
            <Card>
              <CardHeader>
                <CardTitle>Session Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-xl font-bold">{selectedMeeting.sessionSummary.totalSessions}</p>
                    <p className="text-sm text-muted-foreground">Total Sessions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-green-600">{selectedMeeting.sessionSummary.completedSessions}</p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-red-600">{selectedMeeting.sessionSummary.pendingSessions}</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                </div>
                <Progress value={parseFloat(selectedMeeting.sessionSummary.completionRate)} />
              </CardContent>
            </Card>
          )}

          {/* Group Progress Details */}
          <Card>
            <CardHeader>
              <CardTitle>Group Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedMeeting.groupProgress.map((group, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{group.groupName}</p>
                        <Badge variant="outline" className="text-xs">
                          {group.groupCode}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {group.district.name}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {group.totalMembers} members
                        </div>
                        {group.totalGuests > 0 && (
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {group.totalGuests} guests
                          </div>
                        )}
                      </div>
                      {group.totalSessions && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Sessions: {group.completedSessions}/{group.totalSessions}
                        </p>
                      )}
                      {group.lastActivity && (
                        <p className="text-xs text-muted-foreground">
                          Last activity: {format(new Date(group.lastActivity), 'MMM dd, yyyy')}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(group.status)}>
                        {group.status.replace('_', ' ')}
                      </Badge>
                      {group.programConducted && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          Program Conducted
                        </div>
                      )}
                      {group.attendanceRecorded && !group.programConducted && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
                          <CheckCircle className="h-3 w-3" />
                          Attendance Recorded
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeaderWithLogout
        icon={<Calendar className="h-6 w-6 text-primary-foreground" />}
        title="Admin Meetings View"
      />

      <main className="p-4 space-y-4">
        {/* Summary Statistics */}
        {summaryStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{summaryStats.totalMeetings}</p>
                  <p className="text-sm text-muted-foreground">Total Meetings</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{summaryStats.completedMeetings}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>

                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{summaryStats.pendingMeetings}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t space-y-3">
                <div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Avg Program Conduction</span>
                    <span className={`font-bold ${getProgressColor(parseFloat(summaryStats.averageConductionRate))}`}>
                      {summaryStats.averageConductionRate}%
                    </span>
                  </div>
                  <Progress value={parseFloat(summaryStats.averageConductionRate)} className="mt-1 h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {summaryStats.totalProgramsConducted} programs conducted, {summaryStats.totalProgramsNotConducted} pending
                  </p>
                </div>
                <div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Avg Completion Rate</span>
                    <span className={`font-bold ${getProgressColor(parseFloat(summaryStats.averageCompletionRate))}`}>
                      {summaryStats.averageCompletionRate}%
                    </span>
                  </div>
                  <Progress value={parseFloat(summaryStats.averageCompletionRate)} className="mt-1 h-2" />
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <SelectValue placeholder="Meeting Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
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

              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* View Mode Tabs */}
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'quick' | 'detailed')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick">Quick View</TabsTrigger>
            <TabsTrigger value="detailed">Detailed View</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="space-y-4">
            {/* Quick View - Compact Cards */}
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
                  <Card key={meeting._id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{meeting.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{meeting.description}</p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Badge className={getStatusColor(meeting.overallProgress.status)}>
                            {meeting.overallProgress.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <p className="text-muted-foreground">Date</p>
                          <p className="font-medium">{format(new Date(meeting.scheduledDate), 'MMM dd')}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Groups</p>
                          <p className="font-medium">{meeting.overallProgress.totalGroups}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Completed</p>
                          <p className="font-medium text-green-600">{meeting.overallProgress.completedGroups}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Pending</p>
                          <p className="font-medium text-red-600">{meeting.overallProgress.pendingGroups}</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex-1 mr-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Progress</span>
                            <span className={`font-medium ${getProgressColor(parseFloat(meeting.overallProgress.completionRate))}`}>
                              {meeting.overallProgress.completionRate}%
                            </span>
                          </div>
                          <Progress value={parseFloat(meeting.overallProgress.completionRate)} className="h-2" />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMeeting(meeting)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="detailed" className="space-y-4">
            {/* Detailed View - Expanded Cards */}
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-8 w-3/4 mb-4" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3 mb-4" />
                      <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((j) => (
                          <Skeleton key={j} className="h-16 w-full" />
                        ))}
                      </div>
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
              <div className="space-y-6">
                {meetings.map((meeting) => (
                  <Card key={meeting._id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-xl">{meeting.title}</CardTitle>
                          <p className="text-muted-foreground mt-1">{meeting.description}</p>
                        </div>
                        <Badge className={getStatusColor(meeting.overallProgress.status)}>
                          {meeting.overallProgress.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Meeting Info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
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

                      {/* Progress Overview */}
                      <div className="mb-6">
                        <h4 className="font-medium mb-3">Group Progress Overview</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <p className="text-xl font-bold text-primary">{meeting.overallProgress.totalGroups}</p>
                            <p className="text-xs text-muted-foreground">Total</p>
                          </div>
                          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <p className="text-xl font-bold text-green-600">{meeting.overallProgress.completedGroups}</p>
                            <p className="text-xs text-muted-foreground">Completed</p>
                          </div>
                          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                            <p className="text-xl font-bold text-yellow-600">{meeting.overallProgress.inProgressGroups}</p>
                            <p className="text-xs text-muted-foreground">In Progress</p>
                          </div>
                          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <p className="text-xl font-bold text-red-600">{meeting.overallProgress.pendingGroups}</p>
                            <p className="text-xs text-muted-foreground">Pending</p>
                          </div>
                        </div>
                        <Progress value={parseFloat(meeting.overallProgress.completionRate)} className="mb-2" />
                        <p className="text-sm text-center text-muted-foreground">
                          {meeting.overallProgress.completionRate}% Complete
                        </p>
                      </div>

                      {/* Group Details Preview */}
                      <div className="mb-4">
                        <h4 className="font-medium mb-3">Group Status ({meeting.groupProgress.length} groups)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {meeting.groupProgress.slice(0, 4).map((group, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                              <div>
                                <span className="font-medium">{group.groupName}</span>
                                <span className="text-muted-foreground ml-2">({group.groupCode})</span>
                              </div>
                              <Badge variant="outline" className={`text-xs ${
                                group.status === 'completed' ? 'border-green-500 text-green-700' :
                                'border-red-500 text-red-700'
                              }`}>
                                {group.status.replace('_', ' ')}
                              </Badge>
                            </div>
                          ))}
                          {meeting.groupProgress.length > 4 && (
                            <div className="col-span-full text-center text-sm text-muted-foreground">
                              +{meeting.groupProgress.length - 4} more groups
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="flex justify-end">
                        <Button
                          onClick={() => setSelectedMeeting(meeting)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Full Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
    </div>
  );
};

export default AdminMeetingsView;