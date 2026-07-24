import { Calendar, Clock, Users, AlertCircle, CheckCircle, UserPlus, Play, MoreVertical, ArrowLeft, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { MeetingAttendance } from "@/components/MeetingAttendance";
import { SectionCard } from "@/components/app/AppShell";
import { useMeetings } from "@/hooks/useMeetings";
import { useBulkSessionActions, useCompleteSession } from "@/hooks/useSessionManagement";
import { meetingsApi } from "@/lib/meetings";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const Meetings = () => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: meetingsResponse, isLoading, error, refetch } = useMeetings(
    debouncedSearch ? { search: debouncedSearch } : undefined
  );
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [expandedMeetings, setExpandedMeetings] = useState<Record<string, boolean>>({});

  const meetings = meetingsResponse?.data || [];
  
  // Get user info from auth context
  const userInfo = { role: user?.role };
  const userGroup = user?.group || null;

  const bulkSessionActions = useBulkSessionActions();
  const completeSession = useCompleteSession();

  const handleInitializeAttendance = async (meetingId: string) => {
    try {
      setLoadingActions(prev => ({ ...prev, [`init-${meetingId}`]: true }));
      await bulkSessionActions.mutateAsync({
        meetingId,
        action: 'initialize_attendance'
      });
      toast({
        title: "Success",
        description: "Attendance initialized for all sessions"
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initialize attendance",
        variant: "destructive"
      });
    } finally {
      setLoadingActions(prev => ({ ...prev, [`init-${meetingId}`]: false }));
    }
  };

  const handleCompleteSession = async (meetingId: string, sessionId: string) => {
    try {
      setLoadingActions(prev => ({ ...prev, [`complete-${sessionId}`]: true }));
      await completeSession.mutateAsync({
        meetingId,
        sessionId
      });
      toast({
        title: "Success",
        description: "Session marked as completed"
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to complete session",
        variant: "destructive"
      });
    } finally {
      setLoadingActions(prev => ({ ...prev, [`complete-${sessionId}`]: false }));
    }
  };

  const handleAddGuest = async (meetingId: string) => {
    // For now, we'll show a simple prompt. In a real app, you'd want a proper modal
    const guestName = prompt("Enter guest name:");
    if (!guestName) return;

    const guestPhone = prompt("Enter guest phone (optional):");
    const guestOrganization = prompt("Enter guest organization (optional):");

    try {
      setLoadingActions(prev => ({ ...prev, [`guest-${meetingId}`]: true }));
      await meetingsApi.addMeetingGuest(meetingId, {
        name: guestName,
        phone: guestPhone || undefined,
        organization: guestOrganization || undefined,
        status: 'present'
      });
      toast({
        title: "Success",
        description: "Guest added successfully"
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add guest",
        variant: "destructive"
      });
    } finally {
      setLoadingActions(prev => ({ ...prev, [`guest-${meetingId}`]: false }));
    }
  };

  const handleViewSessions = (meeting: any) => {
    // Set the selected meeting to show detailed view
    setSelectedMeeting(meeting);
  };

  // If a meeting is selected, show detailed attendance view
  if (selectedMeeting) {
    return (
      <div className="app-page pb-20">
        <HeaderWithLogout
          icon={<Calendar className="h-6 w-6 text-primary-foreground" />}
          title={selectedMeeting.title}
          leftAction={
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSelectedMeeting(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          }
        />

        <main className="app-main space-y-4">
          {/* Meeting Info */}
          <Card className="surface-card p-4">
            <div className="flex justify-between items-start mb-2">
              <h2 className="font-semibold text-lg">{selectedMeeting.title}</h2>
              <Badge variant={selectedMeeting.status === 'scheduled' ? 'default' : 'secondary'}>
                {selectedMeeting.status}
              </Badge>
            </div>
            
            {selectedMeeting.description && (
              <p className="text-sm text-muted-foreground mb-3">
                {selectedMeeting.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(selectedMeeting.scheduledDate), 'MMM dd, yyyy')}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {selectedMeeting.duration} min
              </div>
            </div>
          </Card>

          {/* Attendance Management */}
          {userInfo?.role === 'group_admin' && userGroup && (
            <MeetingAttendance 
              meeting={selectedMeeting}
              userGroup={userGroup}
              onRefresh={() => {
                refetch();
                // Update selected meeting with fresh data
                const updatedMeeting = meetings.find(m => m._id === selectedMeeting._id);
                if (updatedMeeting) {
                  setSelectedMeeting(updatedMeeting);
                }
              }}
            />
          )}
        </main>

        <BottomNav />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="app-page pb-20">
        <HeaderWithLogout
          icon={<Calendar className="h-6 w-6 text-primary-foreground" />}
          title="Meetings"
        />
        <main className="app-main space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="surface-card p-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-2" />
              <Skeleton className="h-4 w-1/4" />
            </Card>
          ))}
        </main>
        <BottomNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-page pb-20">
        <HeaderWithLogout
          icon={<Calendar className="h-6 w-6 text-primary-foreground" />}
          title="Meetings"
        />
        <main className="app-main">
          <Card className="surface-card p-8 shadow-sm text-center">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
            <h2 className="font-semibold text-lg mb-2">Error Loading Meetings</h2>
            <p className="text-sm text-muted-foreground">
              {error.message || "Failed to load meetings. Please try again."}
            </p>
          </Card>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="app-page pb-20">
        <HeaderWithLogout
          icon={<Calendar className="h-6 w-6 text-primary-foreground" />}
          title="Meetings"
        />
        <main className="app-main">
          <Card className="surface-card p-8 shadow-sm text-center">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="font-semibold text-lg mb-2">No Meetings Scheduled</h2>
            <p className="text-sm text-muted-foreground">
              State admin will create meeting agendas that will appear here.
            </p>
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
        title="Meetings"
      />

      <main className="app-main space-y-4">
        {/* Search */}
        <SectionCard title="Search Meetings" description="Filter the meeting list by title or details.">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search meetings…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </SectionCard>

        {meetings.map((meeting) => {
          // Calculate attendance status - check if any attendance has been recorded
          const hasAttendanceData = meeting.sessionInfo?.totalMembersAcrossSessions > 0 || 
                                   meeting.sessionInfo?.totalGuestsAcrossSessions > 0 ||
                                   (meeting.sessionInfo?.sessions && meeting.sessionInfo.sessions.some((s: any) => 
                                     s.attendance?.overall?.total > 0 || s.attendance?.members?.total > 0 || s.attendance?.guests?.total > 0
                                   ));
          
          const attendanceRate = parseFloat(meeting.sessionInfo?.overallAttendanceRate) || 0;
          const totalParticipants = (meeting.sessionInfo?.totalMembersAcrossSessions || 0) + (meeting.sessionInfo?.totalGuestsAcrossSessions || 0);
          const totalSessions = meeting.sessionInfo?.totalSessions || 0;
          const completedSessions = meeting.sessionInfo?.completedSessions || 0;

          return (
            <Card key={meeting._id} className="surface-card overflow-hidden transition-shadow hover:shadow-md">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value={meeting._id} className="border-none">
                  <AccordionTrigger className="px-4 pt-4 pb-2 hover:no-underline">
                    <div className="flex-1 text-left">
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <h3 className="font-semibold text-base sm:text-lg">{meeting.title}</h3>
                        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                          <Badge 
                            variant={
                              meeting.status === 'scheduled' ? 'default' :
                              meeting.status === 'completed' ? 'secondary' :
                              meeting.status === 'ongoing' ? 'destructive' : 'outline'
                            }
                          >
                            {meeting.status}
                          </Badge>
                          
                          {/* Attendance Status Badge */}
                          {userInfo?.role === 'group_admin' && (
                            <Badge 
                              variant={hasAttendanceData ? 'default' : 'outline'}
                              className={`text-xs ${
                                hasAttendanceData 
                                  ? attendanceRate >= 80 ? 'bg-green-500 hover:bg-green-600 text-white' :
                                    attendanceRate >= 60 ? 'bg-yellow-500 hover:bg-yellow-600 text-white' :
                                    attendanceRate >= 0 ? 'bg-red-500 hover:bg-red-600 text-white' :
                                    'bg-gray-500 hover:bg-gray-600 text-white'
                                  : 'text-gray-500 border-gray-300'
                              }`}
                            >
                              <Users className="h-3 w-3 mr-1" />
                              {hasAttendanceData 
                                ? `${attendanceRate.toFixed(0)}% Attendance` 
                                : totalParticipants > 0 
                                  ? 'Attendance Pending'
                                  : 'No Data Yet'
                              }
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {meeting.description && (
                        <p className="mb-2 line-clamp-2 text-xs text-muted-foreground sm:mb-3 sm:text-sm">
                          {meeting.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:gap-4 sm:text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          {format(new Date(meeting.scheduledDate), 'MMM dd, yyyy')}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          {meeting.duration} min
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          {meeting.targetAudience.replace('_', ' ')}
                        </div>
                      </div>

                      {/* Quick Stats */}
                      {meeting.meetingType === 'monthly_series' && meeting.sessionInfo && (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground sm:mt-3">
                          <span>Sessions: {completedSessions}/{totalSessions}</span>
                          {totalParticipants > 0 && (
                            <span>Participants: {totalParticipants}</span>
                          )}
                          {hasAttendanceData && (
                            <span className={`font-medium ${
                              attendanceRate >= 80 ? 'text-green-600' :
                              attendanceRate >= 60 ? 'text-yellow-600' :
                              attendanceRate >= 0 ? 'text-red-600' :
                              'text-gray-600'
                            }`}>
                              Attendance: {attendanceRate.toFixed(0)}%
                            </span>
                          )}
                          {!hasAttendanceData && totalParticipants > 0 && (
                            <span className="font-medium text-orange-600">
                              Attendance: Pending
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="px-4 pb-4">
                    {/* Detailed Session Information */}
                    {meeting.meetingType === 'monthly_series' && meeting.sessionInfo && (
                      <div className="space-y-4">
                        {/* Session Progress */}
                        <div className="data-strip p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Session Progress</span>
                            <span className="text-xs text-muted-foreground">
                              {completedSessions}/{totalSessions} completed
                            </span>
                          </div>
                          
                          <Progress 
                            value={parseFloat(meeting.sessionInfo.completionRate)} 
                            className="mb-2" 
                          />
                          
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Completion: {meeting.sessionInfo.completionRate}%</span>
                            {hasAttendanceData && (
                              <span>Attendance: {attendanceRate}%</span>
                            )}
                          </div>
                        </div>

                        {/* Attendance Summary */}
                        {hasAttendanceData && userInfo?.role === 'group_admin' && (
                          <div className="data-strip border-blue-200 bg-blue-50 p-3">
                            <h4 className="mb-2 text-sm font-medium text-blue-800">
                              Attendance Summary
                            </h4>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="text-center">
                                <div className="font-semibold text-blue-700">
                                  {totalParticipants}
                                </div>
                                <div className="text-blue-600">Total</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-green-700">
                                  {Math.round((attendanceRate / 100) * totalParticipants)}
                                </div>
                                <div className="text-green-600">Present</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-red-700">
                                  {Math.max(0, totalParticipants - Math.round((attendanceRate / 100) * totalParticipants))}
                                </div>
                                <div className="text-red-600">Absent</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Action Button */}
                        {userInfo?.role === 'group_admin' && (
                          <div className="flex justify-center">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMeeting(meeting);
                              }}
                              className="w-full"
                            >
                              <Users className="h-4 w-4 mr-2" />
                              Manage Attendance
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Non-monthly series meetings */}
                    {meeting.meetingType !== 'monthly_series' && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <Badge variant="outline" className="text-xs">
                            {meeting.meetingType.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            by {meeting.createdBy.name}
                          </span>
                        </div>
                        
                        {userInfo?.role === 'group_admin' && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMeeting(meeting);
                            }}
                            className="w-full"
                          >
                            <Users className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        )}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          );
        })}
      </main>

      <BottomNav />
    </div>
  );
};

export default Meetings;
