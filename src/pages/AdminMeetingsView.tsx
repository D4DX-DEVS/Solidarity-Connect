import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, Users, Eye, Search, ArrowLeft, BarChart3, MapPin, ChevronLeft, ChevronRight, Plus, MoreVertical, Edit, Trash2, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import PageSizeInput from "@/components/app/PageSizeInput";import HeaderWithLogout from "@/components/HeaderWithLogout";
import { SectionCard } from "@/components/app/AppShell";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminMeetingsOverview, useMeetings, useDeleteMeeting } from "@/hooks/useMeetings";
import { useDistricts } from "@/hooks/useDistricts";

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
  const navigate = useNavigate();
  useAuth();
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingData | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const { data: overview, isPending: loading } = useAdminMeetingsOverview(filters);
  const meetings: MeetingData[] = overview?.data ?? [];
  const summaryStats: SummaryStats | null = overview?.summaryStats ?? null;
  const pagination: PaginationInfo = overview?.pagination ?? {
    currentPage: 1,
    totalPages: 1,
    totalDocs: 0,
    limit: 20,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const { data: districtsResponse } = useDistricts();
  const districts: District[] = (districtsResponse?.data as District[]) ?? [];

  // Agendas tab: full list + edit/delete
  const { data: agendaResponse, isPending: agendasLoading } = useMeetings();
  const agendas = agendaResponse?.data || [];
  const deleteMeeting = useDeleteMeeting();

  const handleDeleteMeeting = async (meetingId: string, meetingTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${meetingTitle}"?`)) return;
    try {
      await deleteMeeting.mutateAsync(meetingId);
      toast({ title: "Success", description: "Meeting deleted successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to delete meeting", variant: "destructive" });
    }
  };

  const getAgendaStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'ongoing': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'postponed': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTargetAudienceText = (meeting: any) => {
    switch (meeting.targetAudience) {
      case 'all': return 'All Members';
      case 'group_admins': return 'Area Admins';
      case 'district_admins': return 'District Admins';
      case 'specific_groups': return `${meeting.targetGroups?.length || 0} Groups`;
      case 'specific_districts': return `${meeting.targetDistricts?.length || 0} Districts`;
      default: return meeting.targetAudience || 'Unknown';
    }
  };

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
              size="icon"
              aria-label="Back"
              className="shrink-0 text-white hover:bg-white/15 hover:text-white"
              onClick={() => setSelectedMeeting(null)}
            >
              <ArrowLeft className="h-5 w-5" />
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
                  <p className="font-medium">{format(new Date(selectedMeeting.scheduledDate), 'MMM dd, yyyy • h:mm a')}</p>
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
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
                <Select value={detailFilters.groupStatus || "all"} onValueChange={(value) => handleDetailFilterChange('groupStatus', value === "all" ? "" : value)}>
                  <SelectTrigger className="h-9 px-2 text-xs gap-1 sm:h-11 sm:px-4 sm:text-sm">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={detailFilters.district || "all"} onValueChange={(value) => handleDetailFilterChange('district', value === "all" ? "" : value)}>
                  <SelectTrigger className="h-9 px-2 text-xs gap-1 sm:h-11 sm:px-4 sm:text-sm">
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

                <Button variant="outline" className="h-9 px-2 text-xs sm:h-11 sm:px-4 sm:text-sm" onClick={() => setDetailFilters({ groupStatus: '', district: '' })}>
                  <span className="sm:hidden">Clear</span>
                  <span className="hidden sm:inline">Clear Filters</span>
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
              <div>
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
                    <>
                    {/* Mobile: card list — no horizontal scroll */}
                    <div className="space-y-2 p-3 md:hidden">
                      {paginatedGroups.map((group, index) => (
                        <div key={startIndex + index} className="rounded-2xl border border-border bg-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-sm">{group.groupName || 'Unknown Group'}</p>
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {group.district?.name || 'Unknown'} • {group.groupCode || 'N/A'}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <Badge className={getStatusColor(group.status)}>
                                {group.status.replace('_', ' ')}
                              </Badge>
                              {group.programConducted && (
                                <Badge variant="outline" className="text-[10px] text-green-600 border-green-600">
                                  Conducted
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-5 gap-1 text-center">
                            <div className="rounded-lg bg-muted/60 px-0.5 py-1">
                              <p className="text-sm font-bold text-blue-600">{group.totalMembers || 0}</p>
                              <p className="text-[10px] text-muted-foreground">Total</p>
                            </div>
                            <div className="rounded-lg bg-muted/60 px-0.5 py-1">
                              <p className="text-sm font-bold text-green-600">{group.presentMembers || 0}</p>
                              <p className="text-[10px] text-muted-foreground">Present</p>
                            </div>
                            <div className="rounded-lg bg-muted/60 px-0.5 py-1">
                              <p className="text-sm font-bold text-red-600">{group.absentMembers || 0}</p>
                              <p className="text-[10px] text-muted-foreground">Absent</p>
                            </div>
                            <div className="rounded-lg bg-muted/60 px-0.5 py-1">
                              <p className="text-sm font-bold text-yellow-600">{group.abroadMembers || 0}</p>
                              <p className="text-[10px] text-muted-foreground">Abroad</p>
                            </div>
                            <div className="rounded-lg bg-muted/60 px-0.5 py-1">
                              <p className="text-sm font-bold text-purple-600">
                                {group.attendanceRate ? `${group.attendanceRate}%` : '-'}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Attend</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop: table */}
                    <div className="hidden overflow-x-auto md:block">
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
                    </div>
                    </>
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
                    <div className="data-strip flex flex-wrap items-center justify-center gap-2 border-0 pt-4 md:justify-between">
                      <div className="text-xs text-muted-foreground sm:text-sm">
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
                          <span className="hidden sm:inline">Previous</span>
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
                          <span className="hidden sm:inline">Next</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </main>      </div>
    );
  }

  return (
    <div className="app-page pb-20">
      <HeaderWithLogout
        icon={<Calendar className="h-6 w-6 text-primary-foreground" />}
        title="Meetings"
      />

      <main className="app-main space-y-4">
        <Tabs defaultValue="overview" className="space-y-4">
          <div className="flex items-center gap-2">
            <TabsList className="grid flex-1 grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="agendas">Agendas</TabsTrigger>
            </TabsList>
            <Button size="sm" onClick={() => navigate("/state-admin/create-meeting")}>
              <Plus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </div>

          <TabsContent value="overview" className="space-y-4 mt-0">
        {/* Summary Statistics */}
        {summaryStats && (
          <SectionCard title="Overview" description="Track meeting completion and program conduction across all groups.">
              <div className="grid grid-cols-3 gap-2 md:gap-4">
                <div className="data-strip text-center p-2 sm:p-3">
                  <p className="text-xl font-bold text-primary sm:text-2xl">{summaryStats.totalMeetings}</p>
                  <p className="text-[11px] text-muted-foreground sm:text-sm">Total Meetings</p>
                </div>
                <div className="data-strip border-green-200 bg-green-50 text-center p-2 sm:p-3">
                  <p className="text-xl font-bold text-green-600 sm:text-2xl">{summaryStats.completedMeetings}</p>
                  <p className="text-[11px] text-muted-foreground sm:text-sm">Completed</p>
                </div>
                <div className="data-strip border-red-200 bg-red-50 text-center p-2 sm:p-3">
                  <p className="text-xl font-bold text-red-600 sm:text-2xl">{summaryStats.pendingMeetings}</p>
                  <p className="text-[11px] text-muted-foreground sm:text-sm">Pending</p>
                </div>
              </div>
          </SectionCard>
        )}

        {/* Filters */}
        <SectionCard title="Filters" description="Search meetings and narrow the overview by meeting and completion status.">
            <div className="grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-4">
              <div className="relative col-span-3 md:col-span-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search meetings..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={filters.status || "all"} onValueChange={(value) => handleFilterChange('status', value === "all" ? "" : value)}>
                <SelectTrigger className="h-9 px-2 text-xs gap-1 sm:h-11 sm:px-4 sm:text-sm">
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
                <SelectTrigger className="h-9 px-2 text-xs gap-1 sm:h-11 sm:px-4 sm:text-sm">
                  <SelectValue placeholder="Completion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Completion</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" className="h-9 px-2 text-xs sm:h-11 sm:px-4 sm:text-sm" onClick={clearFilters}>
                <span className="sm:hidden">Clear</span>
                <span className="hidden sm:inline">Clear Filters</span>
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
              <>
              {/* Mobile: card list — no horizontal scroll */}
              <div className="space-y-2 p-3 md:hidden">
                {meetings.map((meeting) => (
                  <button
                    key={meeting._id}
                    type="button"
                    onClick={() => setSelectedMeeting(meeting)}
                    className="w-full rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:bg-accent/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-sm">{meeting.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {format(new Date(meeting.scheduledDate), 'MMM dd, yyyy')} • {meeting.meetingType.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <Badge className={`shrink-0 ${getStatusColor(meeting.overallProgress.status)}`}>
                        {meeting.overallProgress.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                      <div className="rounded-lg bg-muted/60 px-1 py-1.5">
                        <p className="text-sm font-bold">{meeting.overallProgress.totalGroups}</p>
                        <p className="text-[10px] text-muted-foreground">Groups</p>
                      </div>
                      <div className="rounded-lg bg-green-50 px-1 py-1.5">
                        <p className="text-sm font-bold text-green-600">{meeting.overallProgress.programsConducted}</p>
                        <p className="text-[10px] text-muted-foreground">Conducted</p>
                      </div>
                      <div className="rounded-lg bg-red-50 px-1 py-1.5">
                        <p className="text-sm font-bold text-red-600">{meeting.overallProgress.programsNotConducted}</p>
                        <p className="text-[10px] text-muted-foreground">Pending</p>
                      </div>
                      <div className="rounded-lg bg-blue-50 px-1 py-1.5">
                        <p className="text-sm font-bold text-blue-600">{meeting.overallProgress.completedGroups}</p>
                        <p className="text-[10px] text-muted-foreground">Completed</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto md:block">
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
              </>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {!loading && meetings.length > 0 && pagination.totalPages > 1 && (
          <Card className="surface-card">
            <CardContent className="p-4">
              <div className="data-strip flex flex-wrap items-center justify-center gap-2 border-0 md:justify-between">
                <div className="text-xs text-muted-foreground sm:text-sm">
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
                    <span className="hidden sm:inline">Previous</span>
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
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
          </TabsContent>

          <TabsContent value="agendas" className="mt-0">
            <SectionCard title="Scheduled Meetings" description="Create, edit, or remove meeting agendas.">
              {agendasLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : agendas.length === 0 ? (
                <Card className="surface-card p-8 text-center shadow-sm">
                  <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="font-semibold text-lg mb-2">No Meetings Scheduled</h2>
                  <p className="text-sm text-muted-foreground">Create a meeting agenda to notify all members.</p>
                </Card>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {agendas.map((meeting: any) => {
                    const isExpanded = expandedId === meeting._id;
                    return (
                      <Card
                        key={meeting._id}
                        className="surface-card cursor-pointer shadow-sm"
                        onClick={() => setExpandedId(isExpanded ? null : meeting._id)}
                      >
                        <CardHeader className="p-3 pb-2 sm:p-4 sm:pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate font-semibold text-base sm:text-lg">{meeting.title || 'Untitled Meeting'}</h3>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:text-sm">
                                <span className="flex items-center gap-1 whitespace-nowrap">
                                  <Clock className="h-3.5 w-3.5 shrink-0" />
                                  {meeting.scheduledDate ? format(new Date(meeting.scheduledDate), 'MMM dd, yyyy • h:mm a') : 'No date set'}
                                </span>
                                <span className="flex items-center gap-1 whitespace-nowrap">
                                  <Users className="h-3.5 w-3.5 shrink-0" />
                                  {getTargetAudienceText(meeting)}
                                </span>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Badge className={getAgendaStatusColor(meeting.status || 'unknown')}>
                                {meeting.status ? meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1) : 'Unknown'}
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => navigate(`/state-admin/meeting/${meeting._id}`)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteMeeting(meeting._id, meeting.title || 'Untitled Meeting')}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                        </CardHeader>
                        {isExpanded && (
                          <CardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
                            {meeting.description && (
                              <p className="mb-2 text-sm text-muted-foreground">{meeting.description}</p>
                            )}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
                              <span>Duration: {meeting.duration || 0} min</span>
                              <span>Type: {meeting.meetingType ? meeting.meetingType.replace(/_/g, ' ') : 'Unknown'}</span>
                              <span>Created by {meeting.createdBy?.name || 'Unknown'}</span>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </TabsContent>
        </Tabs>
      </main>    </div>
  );
};

export default AdminMeetingsView;