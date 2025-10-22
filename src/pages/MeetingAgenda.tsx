import { ArrowLeft, Plus, Calendar, Clock, Users, MapPin, MoreVertical, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useMeetings, useDeleteMeeting } from "@/hooks/useMeetings";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const MeetingAgenda = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: meetingsResponse, isLoading, error } = useMeetings();
  const deleteMeeting = useDeleteMeeting();

  const meetings = meetingsResponse?.data || [];

  const handleDeleteMeeting = async (meetingId: string, meetingTitle: string) => {
    if (window.confirm(`Are you sure you want to delete "${meetingTitle}"?`)) {
      try {
        await deleteMeeting.mutateAsync(meetingId);
        toast({
          title: "Success",
          description: "Meeting deleted successfully",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete meeting",
          variant: "destructive",
        });
      }
    }
  };

  const getStatusColor = (status: string) => {
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
      case 'group_admins': return 'Group Admins';
      case 'district_admins': return 'District Admins';
      case 'specific_groups': return `${meeting.targetGroups?.length || 0} Groups`;
      case 'specific_districts': return `${meeting.targetDistricts?.length || 0} Districts`;
      default: return meeting.targetAudience;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/state-admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Meeting Agenda</h1>
          </div>
        </header>
        <main className="p-4">
          <div className="text-center py-8">Loading meetings...</div>
        </main>
      </div>
    );
  }

  if (error) {
    const isAuthError = error instanceof Error && (
      error.message.includes('Access denied') || 
      error.message.includes('token') ||
      error.message.includes('401') ||
      error.message.includes('403')
    );

    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/state-admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Meeting Agenda</h1>
          </div>
        </header>
        <main className="p-4 space-y-4">
          <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => navigate("/state-admin/create-meeting")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Meeting Agenda
          </Button>
          <Card className="p-8 text-center shadow-sm">
            <h2 className="font-semibold text-lg mb-2 text-red-600">
              {isAuthError ? "Authentication Required" : "Error Loading Meetings"}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {isAuthError 
                ? "Please log in again to access meetings."
                : (error instanceof Error ? error.message : "Failed to load meetings. Please try again later.")
              }
            </p>
            <div className="flex gap-2 justify-center">
              {isAuthError ? (
                <Button onClick={() => navigate("/login")}>
                  Go to Login
                </Button>
              ) : (
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              )}
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/state-admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Meeting Agenda</h1>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => navigate("/state-admin/create-meeting")}>
          <Plus className="h-4 w-4 mr-2" />
          Create Meeting Agenda
        </Button>

        {meetings.length === 0 ? (
          <Card className="p-8 text-center shadow-sm">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="font-semibold text-lg mb-2">No Meetings Scheduled</h2>
            <p className="text-sm text-muted-foreground">
              Create a meeting agenda to notify all members.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {meetings.map((meeting) => (
              <Card key={meeting._id} className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{meeting.title}</h3>
                      {meeting.description && (
                        <p className="text-sm text-muted-foreground mb-2">{meeting.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {format(new Date(meeting.scheduledDate), 'MMM dd, yyyy • h:mm a')}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {getTargetAudienceText(meeting)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(meeting.status)}>
                        {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/state-admin/meeting/${meeting._id}`)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteMeeting(meeting._id, meeting.title)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">
                        Duration: {meeting.duration} minutes
                      </span>
                      <span className="text-muted-foreground">
                        Type: {meeting.meetingType.charAt(0).toUpperCase() + meeting.meetingType.slice(1)}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      Created by {meeting.createdBy.name}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MeetingAgenda;
