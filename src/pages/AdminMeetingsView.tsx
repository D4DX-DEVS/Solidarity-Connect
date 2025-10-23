import { useState, useEffect } from "react";
import { Calendar, Clock, Users, AlertCircle, CheckCircle, Eye, Filter, Search, ArrowLeft, BarChart3, MapPin, Building2, ChevronLeft, ChevronRight } from "lucide-react";
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
import { meetingsAPI, districtsAPI } from "@/utils/api";

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
  activeMembers?: number;
  inactiveMembers?: number;
  abroadMembersFromDB?: number; // Members with 'Abroad' status in database
  totalGuests: number;
  presentMembers?: number;
  presentGuests?: number;
  absentMembers?: number;
  abroadMembers?: number; // Members marked as abroad in attendance
  attendanceRecorded: boolean;
  programConducted?: boolean;
  conductedDate?: string;
  lastActivity?: string;
  attendanceRate?: string;
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

interface District {
  _id: string;
  name: string;
  code: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalDocs: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const AdminMeetingsView = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingData | null>(null);
  const [viewMode, setViewMode] = useState<'quick' | 'detailed'>('quick');
  const [districts, setDistricts] = useState<District[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalDocs: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    completionStatus: '',
    page: 1,
    limit: 10,
    sort: '-scheduledDate'
  });

  // Detail view filters (for selected meeting)
  const [detailFilters, setDetailFilters] = useState({
    groupStatus: '',
    district: ''
  });

  // Group pagination for detail view
  const [groupPagination, setGroupPagination] = useState({
    currentPage: 1,
    itemsPerPage: 5
  });

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString());
      });

      const result = await meetingsAPI.getAdminOverview(Object.fromEntries(queryParams));
      setMeetings(result.data);
      setSummaryStats(result.summaryStats);
      setPagination(result.pagination);
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

  const fetchDistricts = async () => {
    try {
      const result = await districtsAPI.getDistricts();
      setDistricts(result.data || []);
    } catch (error) {
      console.error('Error fetching districts:', error);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [filters]);

  useEffect(() => {
    fetchDistricts();
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ 
      ...prev, 
      [key]: value,
      page: key !== 'page' ? 1 : value // Reset to page 1 when changing filters except page
    }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      completionStatus: '',
      page: 1,
      limit: 10,
      sort: '-scheduledDate'
    });
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleDetailFilterChange = (key: string, value: string) => {
    setDetailFilters(prev => ({ ...prev, [key]: value }));
    // Reset to first page when filters change
    setGroupPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleGroupPageChange = (newPage: number) => {
    setGroupPagination(prev => ({ ...prev, currentPage: newPage }));
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
                  <p className="font-medium">{selectedMeeting.createdBy?.name || 'Unknown'}</p>
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
              {/* Group Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{selectedMeeting.overallProgress.totalGroups}</p>
                  <p className="text-sm text-muted-foreground">Total Groups</p>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{selectedMeeting.overallProgress.programsConducted}</p>
                  <p className="text-sm text-muted-foreground">Programs Conducted</p>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{selectedMeeting.overallProgress.programsNotConducted}</p>
                  <p className="text-sm text-muted-foreground">Not Conducted</p>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{selectedMeeting.overallProgress.completedGroups}</p>
                  <p className="text-sm text-muted-foreground">Fully Completed</p>
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

          {/* Group Progress Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Group Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select value={detailFilters.groupStatus || "all"} onValueChange={(value) => handleDetailFilterChange('groupStatus', value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={detailFilters.district || "all"} onValueChange={(value) => handleDetailFilterChange('district', value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by District" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Districts</SelectItem>
                    {districts.length > 0 ? districts.map((district) => (
                      <SelectItem key={district._id} value={district._id}>
                        {district.name} ({district.code})
                      </SelectItem>
                    )) : (
                      <SelectItem value="loading" disabled>Loading districts...</SelectItem>
                    )}
                  </SelectContent>
                </Select>

                <Select value={groupPagination.itemsPerPage.toString()} onValueChange={(value) => setGroupPagination(prev => ({ ...prev, itemsPerPage: parseInt(value), currentPage: 1 }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Groups per page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 per page</SelectItem>
                    <SelectItem value="5">5 per page</SelectItem>
                    <SelectItem value="10">10 per page</SelectItem>
                    <SelectItem value="20">20 per page</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={() => setDetailFilters({ groupStatus: '', district: '' })}>
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Group Progress Details */}
          <Card>
            <CardHeader>
              <CardTitle>Group Progress ({(() => {
                const filteredGroups = selectedMeeting.groupProgress.filter(group => {
                  if (detailFilters.groupStatus && group.status !== detailFilters.groupStatus) return false;
                  if (detailFilters.district && group.district?._id !== detailFilters.district) return false;
                  return true;
                });
                return filteredGroups.length;
              })()} groups)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(() => {
                  const filteredGroups = selectedMeeting.groupProgress.filter(group => {
                    if (detailFilters.groupStatus && group.status !== detailFilters.groupStatus) return false;
                    if (detailFilters.district && group.district?._id !== detailFilters.district) return false;
                    return true;
                  });
                  
                  const startIndex = (groupPagination.currentPage - 1) * groupPagination.itemsPerPage;
                  const endIndex = startIndex + groupPagination.itemsPerPage;
                  const paginatedGroups = filteredGroups.slice(startIndex, endIndex);
                  
                  return paginatedGroups.map((group, index) => (
                  <div key={startIndex + index} className="border rounded-lg p-4 bg-card">
                    {/* Group Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-lg">{group.groupName || 'Unknown Group'}</h4>
                        <Badge variant="outline" className="text-xs">
                          {group.groupCode || 'N/A'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(group.status)}>
                          {group.status.replace('_', ' ')}
                        </Badge>
                        {group.programConducted && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Program Conducted
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* District Info */}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
                      <MapPin className="h-4 w-4" />
                      <span>{group.district?.name || 'Unknown District'} ({group.district?.code || 'N/A'})</span>
                    </div>
                    
                    {/* Member Statistics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {/* Total Members */}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{group.totalMembers || 0}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">Total Members</p>
                      </div>
                      
                      {/* Present Members */}
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-300">{group.presentMembers || 0}</p>
                        <p className="text-xs text-green-600 dark:text-green-400">Present</p>
                      </div>
                      
                      {/* Absent Members */}
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        </div>
                        <p className="text-2xl font-bold text-red-700 dark:text-red-300">{group.absentMembers || 0}</p>
                        <p className="text-xs text-red-600 dark:text-red-400">Absent</p>
                      </div>
                      
                      {/* Abroad Members */}
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Clock className="h-4 w-4 text-yellow-600" />
                        </div>
                        <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{group.abroadMembers || 0}</p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">Abroad</p>
                      </div>
                    </div>

                    {/* Guest Statistics (if any) */}
                    {(group.totalGuests > 0 || group.presentGuests !== undefined) && (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Users className="h-4 w-4 text-purple-600" />
                          </div>
                          <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{group.totalGuests || 0}</p>
                          <p className="text-xs text-purple-600 dark:text-purple-400">Total Guests</p>
                        </div>
                        
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <CheckCircle className="h-4 w-4 text-indigo-600" />
                          </div>
                          <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">{group.presentGuests || 0}</p>
                          <p className="text-xs text-indigo-600 dark:text-indigo-400">Guests Present</p>
                        </div>
                      </div>
                    )}

                    {/* Summary Row */}
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg mb-3">
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="font-medium">Total Participants: </span>
                          <span className="text-blue-600 font-bold">{(group.totalMembers || 0) + (group.totalGuests || 0)}</span>
                        </div>
                        <div>
                          <span className="font-medium">Total Present: </span>
                          <span className="text-green-600 font-bold">{(group.presentMembers || 0) + (group.presentGuests || 0)}</span>
                        </div>
                      </div>
                      {group.attendanceRate && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Attendance Rate</p>
                          <p className={`text-lg font-bold ${getProgressColor(parseFloat(group.attendanceRate))}`}>
                            {group.attendanceRate}%
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Additional Information */}
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {group.totalSessions && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>Sessions: {group.completedSessions}/{group.totalSessions}</span>
                          {group.totalSessions > 0 && (
                            <span className="text-blue-600 font-medium">
                              ({((group.completedSessions / group.totalSessions) * 100).toFixed(0)}% complete)
                            </span>
                          )}
                        </div>
                      )}
                      
                      {group.lastActivity && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>Last activity: {format(new Date(group.lastActivity), 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                      
                      {group.conductedDate && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span>Program conducted: {format(new Date(group.conductedDate), 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  ));
                })()}
                
                {/* Group Pagination */}
                {(() => {
                  const filteredGroups = selectedMeeting.groupProgress.filter(group => {
                    if (detailFilters.groupStatus && group.status !== detailFilters.groupStatus) return false;
                    if (detailFilters.district && group.district?._id !== detailFilters.district) return false;
                    return true;
                  });
                  
                  const totalPages = Math.ceil(filteredGroups.length / groupPagination.itemsPerPage);
                  
                  if (totalPages <= 1) return null;
                  
                  return (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Showing {((groupPagination.currentPage - 1) * groupPagination.itemsPerPage) + 1} to {Math.min(groupPagination.currentPage * groupPagination.itemsPerPage, filteredGroups.length)} of {filteredGroups.length} groups
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGroupPageChange(groupPagination.currentPage - 1)}
                          disabled={groupPagination.currentPage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const pageNum = Math.max(1, groupPagination.currentPage - 2) + i;
                            if (pageNum > totalPages) return null;
                            return (
                              <Button
                                key={pageNum}
                                variant={pageNum === groupPagination.currentPage ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleGroupPageChange(pageNum)}
                                className="w-8 h-8 p-0"
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGroupPageChange(groupPagination.currentPage + 1)}
                          disabled={groupPagination.currentPage >= totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })()}
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

                      <div className="space-y-3 mb-3">
                        {/* Group Statistics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Date</p>
                            <p className="font-medium">{format(new Date(meeting.scheduledDate), 'MMM dd')}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Groups</p>
                            <p className="font-medium">{meeting.overallProgress.totalGroups}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Conducted</p>
                            <p className="font-medium text-green-600">{meeting.overallProgress.programsConducted}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Pending</p>
                            <p className="font-medium text-red-600">{meeting.overallProgress.programsNotConducted}</p>
                          </div>
                        </div>


                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex-1 mr-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Program Conduction</span>
                            <span className={`font-medium ${getProgressColor(parseFloat(meeting.overallProgress.conductionRate))}`}>
                              {meeting.overallProgress.conductionRate}%
                            </span>
                          </div>
                          <Progress value={parseFloat(meeting.overallProgress.conductionRate)} className="h-2" />
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
                          <p className="font-medium">{meeting.createdBy?.name || 'Unknown'}</p>
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
                            <p className="text-xl font-bold text-green-600">{meeting.overallProgress.programsConducted}</p>
                            <p className="text-xs text-muted-foreground">Conducted</p>
                          </div>
                          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p className="text-xl font-bold text-blue-600">{meeting.overallProgress.completedGroups}</p>
                            <p className="text-xs text-muted-foreground">Completed</p>
                          </div>
                          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <p className="text-xl font-bold text-red-600">{meeting.overallProgress.programsNotConducted}</p>
                            <p className="text-xs text-muted-foreground">Pending</p>
                          </div>
                        </div>
                        <Progress value={parseFloat(meeting.overallProgress.conductionRate)} className="mb-2" />
                        <p className="text-sm text-center text-muted-foreground">
                          {meeting.overallProgress.conductionRate}% Programs Conducted
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

        {/* Pagination */}
        {!loading && meetings.length > 0 && pagination.totalPages > 1 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to {Math.min(pagination.currentPage * pagination.limit, pagination.totalDocs)} of {pagination.totalDocs} meetings
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevPage || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, pagination.currentPage - 2) + i;
                      if (pageNum > pagination.totalPages) return null;
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === pagination.currentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          disabled={loading}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage || loading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default AdminMeetingsView;