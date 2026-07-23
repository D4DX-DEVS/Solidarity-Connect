import { useState, useEffect } from "react";
import { Calendar, Clock, Users, AlertCircle, CheckCircle, Eye, Search, ArrowLeft, BarChart3, MapPin, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import PageSizeInput from "@/components/app/PageSizeInput";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { SectionCard } from "@/components/app/AppShell";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { meetingsAPI, districtsAPI } from "@/utils/api";

interface GroupProgress {
  groupId: string;
  groupName: string;
  groupCode: string;
  district: {
    _id?: string;
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
  useAuth();
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingData | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalDocs: 0,
    limit: 20,
    hasNextPage: false,
    hasPrevPage: false
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    completionStatus: '',
    page: 1,
    limit: 20,
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
    itemsPerPage: 20
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
      page: key !== 'page' ? 1 : Number(value) // Reset to page 1 when changing filters except page
    }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      completionStatus: '',
      page: 1,
      limit: 20,
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
      <div className="app-page pb-20">
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

        <main className="app-main space-y-4">
          {/* Meeting Header */}
          <Card className="surface-card">
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
          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Overall Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Group Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="data-strip text-center p-3 border-blue-200 bg-blue-50">
                  <p className="text-2xl font-bold text-blue-600">{selectedMeeting.overallProgress.totalGroups}</p>
                  <p className="text-sm text-muted-foreground">Total Groups</p>
                </div>
                <div className="data-strip text-center p-3 border-green-200 bg-green-50">
                  <p className="text-2xl font-bold text-green-600">{selectedMeeting.overallProgress.programsConducted}</p>
                  <p className="text-sm text-muted-foreground">Programs Conducted</p>
                </div>
                <div className="data-strip text-center p-3 border-red-200 bg-red-50">
                  <p className="text-2xl font-bold text-red-600">{selectedMeeting.overallProgress.programsNotConducted}</p>
                  <p className="text-sm text-muted-foreground">Not Conducted</p>
                </div>
                <div className="data-strip text-center p-3">
                  <p className="text-2xl font-bold text-purple-600">{selectedMeeting.overallProgress.completedGroups}</p>
                  <p className="text-sm text-muted-foreground">Fully Completed</p>
                </div>
              </div>


              

            </CardContent>
          </Card>

          {/* Group Progress Filters */}
          <SectionCard title="Group Filters" description="Narrow the meeting progress table by status, district, and page size.">
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

                <PageSizeInput
                  value={groupPagination.itemsPerPage}
                  onChange={(size) => setGroupPagination(prev => ({ ...prev, itemsPerPage: size, currentPage: 1 }))}
                />

                <Button variant="outline" onClick={() => setDetailFilters({ groupStatus: '', district: '' })}>
                  Clear Filters
                </Button>
              </div>
          </SectionCard>

          {/* Group Progress Details Table */}
          <Card className="surface-card">
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
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                {(() => {
                  const filteredGroups = selectedMeeting.groupProgress.filter(group => {
                    if (detailFilters.groupStatus && group.status !== detailFilters.groupStatus) return false;
                    if (detailFilters.district && group.district?._id !== detailFilters.district) return false;
                    return true;
                  });
                  
                  const startIndex = (groupPagination.currentPage - 1) * groupPagination.itemsPerPage;
                  const endIndex = startIndex + groupPagination.itemsPerPage;
                  const paginatedGroups = filteredGroups.slice(startIndex, endIndex);
                  
                  return (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Group</TableHead>
                          <TableHead>District</TableHead>
                          <TableHead className="text-center">Total Members</TableHead>
                          <TableHead className="text-center">Present</TableHead>
                          <TableHead className="text-center">Absent</TableHead>
                          <TableHead className="text-center">Abroad</TableHead>
                          <TableHead className="text-center">Guests</TableHead>
                          <TableHead className="text-center">Attendance %</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedGroups.map((group, index) => (
                          <TableRow key={startIndex + index} className="hover:bg-muted/50">
                            <TableCell>
                              <div>
                                <p className="font-medium">{group.groupName || 'Unknown Group'}</p>
                                <p className="text-xs text-muted-foreground">{group.groupCode || 'N/A'}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{group.district?.name || 'Unknown'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-blue-600">{group.totalMembers || 0}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-green-600">{group.presentMembers || 0}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-red-600">{group.absentMembers || 0}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-yellow-600">{group.abroadMembers || 0}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="text-sm">
                                <span className="font-semibold text-purple-600">{group.presentGuests || 0}</span>
                                <span className="text-muted-foreground">/{group.totalGuests || 0}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {group.attendanceRate ? (
                                <span className={`font-semibold ${getProgressColor(parseFloat(group.attendanceRate))}`}>
                                  {group.attendanceRate}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col gap-1 items-center">
                                <Badge className={getStatusColor(group.status)}>
                                  {group.status.replace('_', ' ')}
                                </Badge>
                                {group.programConducted && (
                                  <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                                    Conducted
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  );
                })()}
              </div>
              
              {/* Group Pagination */}
              <div className="border-t p-4">
                {(() => {
                  const filteredGroups = selectedMeeting.groupProgress.filter(group => {
                    if (detailFilters.groupStatus && group.status !== detailFilters.groupStatus) return false;
                    if (detailFilters.district && group.district?._id !== detailFilters.district) return false;
                    return true;
                  });
                  
                  const totalPages = Math.ceil(filteredGroups.length / groupPagination.itemsPerPage);
                  
                  if (totalPages <= 1) return null;
                  
                  return (
                    <div className="data-strip flex items-center justify-between pt-4 border-0">
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
    <div className="app-page pb-20">
      <HeaderWithLogout
        icon={<Calendar className="h-6 w-6 text-primary-foreground" />}
        title="Admin Meetings View"
      />

      <main className="app-main space-y-4">
        {/* Summary Statistics */}
        {summaryStats && (
          <SectionCard title="Overview" description="Track meeting completion and program conduction across all groups.">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="data-strip text-center p-3">
                  <p className="text-2xl font-bold text-primary">{summaryStats.totalMeetings}</p>
                  <p className="text-sm text-muted-foreground">Total Meetings</p>
                </div>
                <div className="data-strip border-green-200 bg-green-50 text-center p-3">
                  <p className="text-2xl font-bold text-green-600">{summaryStats.completedMeetings}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
                <div className="data-strip border-red-200 bg-red-50 text-center p-3">
                  <p className="text-2xl font-bold text-red-600">{summaryStats.pendingMeetings}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
          </SectionCard>
        )}

        {/* Filters */}
        <SectionCard title="Filters" description="Search meetings and narrow the overview by meeting and completion status.">
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
        </SectionCard>

        {/* Meetings Table */}
        <Card className="surface-card">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : meetings.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold text-lg mb-2">No Meetings Found</h3>
                <p className="text-muted-foreground">No meetings match your current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Meeting</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">Total Groups</TableHead>
                      <TableHead className="text-center">Conducted</TableHead>
                      <TableHead className="text-center">Pending</TableHead>
                      <TableHead className="text-center">Completed</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meetings.map((meeting) => (
                      <TableRow key={meeting._id} className="hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <p className="font-medium">{meeting.title}</p>
                            <p className="text-xs text-muted-foreground">{meeting.description}</p>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(meeting.scheduledDate), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {meeting.meetingType.replace('_', ' ')}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold">{meeting.overallProgress.totalGroups}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-green-600">{meeting.overallProgress.programsConducted}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-red-600">{meeting.overallProgress.programsNotConducted}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-blue-600">{meeting.overallProgress.completedGroups}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={getStatusColor(meeting.overallProgress.status)}>
                            {meeting.overallProgress.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedMeeting(meeting)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {!loading && meetings.length > 0 && pagination.totalPages > 1 && (
          <Card className="surface-card">
            <CardContent className="p-4">
              <div className="data-strip flex items-center justify-between border-0">
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