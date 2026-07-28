import { useState, useEffect } from "react";
import { Bell, Send, Edit, Trash2, Eye, AlertCircle, FileText, Image, Film, Paperclip } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/app/AppShell";
import { ListSkeleton } from "@/components/ui/loading-skeletons";import HeaderWithLogout from "@/components/HeaderWithLogout";
import AnnouncementsPanel from "@/components/AnnouncementsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { notificationService, type Notification } from "@/services/notificationService";
import { memberAuthAPI } from "@/utils/api";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Notifications = () => {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchNotifications();
  }, [currentPage]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const userType = localStorage.getItem('userType');
      if (userType === 'member') {
        const result = await memberAuthAPI.getNotifications({
          page: currentPage.toString(),
          limit: '10',
          excludeType: 'announcement',
        });
        setNotifications(result.data?.notifications || []);
        if (result.data?.pagination) {
          setTotalPages(result.data.pagination.totalPages);
        }
      } else {
        const result = await notificationService.getNotifications({
          page: currentPage,
          limit: 10
        });
        setNotifications(result.data);
        setTotalPages(result.pagination.totalPages);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError('Failed to load notifications');
      toast({
        title: "Error",
        description: "Failed to load notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationService.deleteNotification(id);
      toast({
        title: "Success",
        description: "Notification deleted successfully",
      });
      fetchNotifications();
    } catch (err) {
      console.error('Failed to delete notification:', err);
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    }
  };

  const handleSend = async (id: string) => {
    try {
      await notificationService.sendNotification(id);
      toast({
        title: "Success",
        description: "Notification sent successfully",
      });
      fetchNotifications();
    } catch (err) {
      console.error('Failed to send notification:', err);
      toast({
        title: "Error",
        description: "Failed to send notification",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'sending': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="app-page">
      <div className="app-page-orb app-page-orb-primary" aria-hidden />
      <div className="app-page-orb app-page-orb-secondary" aria-hidden />
      <HeaderWithLogout
        icon={<Bell className="h-6 w-6 text-primary-foreground" />}
        title="Alerts"
      />

      <main className="app-main pt-4 space-y-4">
        {/* ponytail: notifications + announcements merged into one page for every role */}
        <Tabs defaultValue="notifications" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="mt-0 space-y-4">
        {loading ? (
          <ListSkeleton rows={5} />
        ) : error ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={fetchNotifications} className="mt-2">
                Try Again
              </Button>
            </div>
          </div>
        ) : (
        <>
        <SectionCard
          title="Notifications"
          description={userRole === "state_admin"
            ? "Draft, review, and send notification messages without leaving the main workflow."
            : "Alerts and updates sent to you."}
          action={userRole === "state_admin" ? (
            <Button onClick={() => navigate("/state-admin/send-notification")}>
              <Send className="h-4 w-4 mr-2" />
              Send New Notification
            </Button>
          ) : undefined}
        >
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No notifications found</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <Card key={notification._id} className="surface-card transition-all hover:-translate-y-0.5">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{notification.title}</h3>
                    <Badge className={getStatusColor(notification.status)}>
                      {notification.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span>From: {notification.createdBy?.name || 'System'}</span>
                    <span>{formatDate(notification.createdAt)}</span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground mb-3">
                    Target: {notification.targetAudience.replace('_', ' ')} | 
                    Type: {notification.type}
                  </div>

                  {notification.attachments && notification.attachments.length > 0 && (
                    <div className="mb-3 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Paperclip className="h-3 w-3" /> Attachments:
                      </p>
                      {notification.attachments.map((att, i) => {
                        const mime = att.mimetype || '';
                        const Icon = mime.startsWith('image/') ? Image : mime.startsWith('video/') ? Film : FileText;
                        return (
                          <a
                            key={i}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{att.originalName || `File ${i + 1}`}</span>
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {userRole === "state_admin" && (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/state-admin/notification/${notification._id}`)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/state-admin/edit-notification/${notification._id}`)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      
                      {notification.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => handleSend(notification._id)}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Send
                        </Button>
                      )}
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Notification</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this notification? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(notification._id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
        </SectionCard>

        {totalPages > 1 && (
          <div className="data-strip flex justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span className="flex items-center px-3 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        )}
        </>
        )}
          </TabsContent>

          <TabsContent value="announcements" className="mt-0">
            <AnnouncementsPanel />
          </TabsContent>
        </Tabs>
      </main>    </div>
  );
};

export default Notifications;
