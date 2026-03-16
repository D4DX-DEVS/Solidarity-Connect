import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, Users, MapPin, Edit, Save, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMeeting, useUpdateMeeting } from "@/hooks/useMeetings";
import { format } from "date-fns";

const MeetingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: meetingResponse, isLoading, error } = useMeeting(id!);
  const updateMeeting = useUpdateMeeting();

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: "",
    description: "",
    scheduledDate: "",
    duration: 60,
    venue: "",
    status: "scheduled"
  });

  const meeting = meetingResponse?.data;

  useEffect(() => {
    if (meeting) {
      setEditData({
        title: meeting.title || "",
        description: meeting.description || "",
        scheduledDate: meeting.scheduledDate ? new Date(meeting.scheduledDate).toISOString().slice(0, 16) : "",
        duration: meeting.duration || 60,
        venue: meeting.venue || "",
        status: meeting.status || "scheduled"
      });
    }
  }, [meeting]);

  const handleSave = async () => {
    if (!editData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Meeting title is required",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateMeeting.mutateAsync({
        id: id!,
        data: {
          ...editData,
          scheduledDate: new Date(editData.scheduledDate).toISOString(),
        }
      });

      toast({
        title: "Success",
        description: "Meeting updated successfully",
      });
      setIsEditing(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update meeting",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    if (meeting) {
      setEditData({
        title: meeting.title || "",
        description: meeting.description || "",
        scheduledDate: meeting.scheduledDate ? new Date(meeting.scheduledDate).toISOString().slice(0, 16) : "",
        duration: meeting.duration || 60,
        venue: meeting.venue || "",
        status: meeting.status || "scheduled"
      });
    }
    setIsEditing(false);
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

  const getTargetAudienceText = (targetAudience: string) => {
    switch (targetAudience) {
      case 'all': return 'All Members';
      case 'state_admins': return 'State Administrators';
      case 'district_admins': return 'District Administrators';
      case 'group_admins': return 'Area Administrators';
      case 'specific_groups': return 'Specific Groups';
      case 'specific_districts': return 'Specific Districts';
      default: return targetAudience;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading meeting details...</p>
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <Calendar className="h-12 w-12 mx-auto mb-2" />
            <h2 className="text-lg font-semibold">Meeting Not Found</h2>
            <p className="text-sm text-muted-foreground mt-2">
              {error?.message || "The meeting you're looking for doesn't exist or you don't have permission to view it."}
            </p>
          </div>
          <Button onClick={() => navigate("/state-admin/meeting-agenda")}>
            Back to Meetings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="bg-card border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/state-admin/meeting-agenda")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">
              {isEditing ? "Edit Meeting" : "Meeting Details"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateMeeting.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateMeeting.isPending ? "Saving..." : "Save"}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="p-4">
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Meeting Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Title *</label>
                    <Input
                      value={editData.title}
                      onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Meeting title"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <Textarea
                      value={editData.description}
                      onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Meeting description"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Scheduled Date & Time *</label>
                      <Input
                        type="datetime-local"
                        value={editData.scheduledDate}
                        onChange={(e) => setEditData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Duration (minutes)</label>
                      <Input
                        type="number"
                        min="15"
                        max="480"
                        value={editData.duration}
                        onChange={(e) => setEditData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Venue</label>
                    <Input
                      value={editData.venue}
                      onChange={(e) => setEditData(prev => ({ ...prev, venue: e.target.value }))}
                      placeholder="Meeting venue"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select
                      value={editData.status}
                      onValueChange={(value) => setEditData(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="ongoing">Ongoing</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="postponed">Postponed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h2 className="text-2xl font-bold mb-2">{meeting.title}</h2>
                    {meeting.description && (
                      <p className="text-muted-foreground">{meeting.description}</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {format(new Date(meeting.scheduledDate), 'EEEE, MMMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {format(new Date(meeting.scheduledDate), 'h:mm a')} ({meeting.duration} min)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{getTargetAudienceText(meeting.targetAudience)}</span>
                    </div>
                    {meeting.venue && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{meeting.venue}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge className={getStatusColor(meeting.status)}>
                      {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Monthly Series Information */}
          {meeting.meetingType === 'monthly_series' && meeting.monthlyDetails && (
            <Card>
              <CardHeader>
                <CardTitle>Monthly Series Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium">Month:</span>
                    <p className="text-sm text-muted-foreground">
                      {new Date(2024, meeting.monthlyDetails.month - 1).toLocaleString('default', { month: 'long' })} {meeting.monthlyDetails.year}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Total Sessions:</span>
                    <p className="text-sm text-muted-foreground">{meeting.monthlyDetails.totalSessions}</p>
                  </div>
                </div>
                {meeting.monthlyDetails.synopsis && (
                  <div className="mt-4">
                    <span className="text-sm font-medium">Synopsis:</span>
                    <p className="text-sm text-muted-foreground mt-1">{meeting.monthlyDetails.synopsis}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sessions (if monthly series) */}
          {meeting.meetingType === 'monthly_series' && meeting.sessions && (
            <Card>
              <CardHeader>
                <CardTitle>Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                {meeting.sessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No sessions added yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {meeting.sessions.map((session: any, index: number) => (
                      <Card key={session._id} className="border-l-4 border-l-primary">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">Session {session.sessionNumber}: {session.title}</h4>
                            <Badge className={getStatusColor(session.sessionStatus || 'scheduled')}>
                              {(session.sessionStatus || 'scheduled').charAt(0).toUpperCase() + (session.sessionStatus || 'scheduled').slice(1)}
                            </Badge>
                          </div>
                          {session.description && (
                            <p className="text-sm text-muted-foreground mb-2">{session.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {session.duration} minutes
                            </div>
                            {session.scheduledDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(session.scheduledDate), 'MMM dd, yyyy')}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Meeting Details */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Meeting Type:</span>
                  <p className="text-muted-foreground capitalize">{meeting.meetingType.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="font-medium">Created By:</span>
                  <p className="text-muted-foreground">{meeting.createdBy?.name}</p>
                </div>
                <div>
                  <span className="font-medium">Created At:</span>
                  <p className="text-muted-foreground">
                    {format(new Date(meeting.createdAt), 'MMM dd, yyyy h:mm a')}
                  </p>
                </div>
                {meeting.updatedAt && meeting.updatedAt !== meeting.createdAt && (
                  <div>
                    <span className="font-medium">Last Updated:</span>
                    <p className="text-muted-foreground">
                      {format(new Date(meeting.updatedAt), 'MMM dd, yyyy h:mm a')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default MeetingDetail;