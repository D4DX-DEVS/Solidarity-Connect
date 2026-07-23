import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit, Send, Trash2, Users, Paperclip, FileText, Image, Film, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { DetailSkeleton } from "@/components/ui/loading-skeletons";
import { toast } from "@/hooks/use-toast";
import { notificationService, type Notification } from "@/services/notificationService";
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

const NotificationDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchNotification();
    }
  }, [id]);

  const fetchNotification = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const data = await notificationService.getNotificationById(id);
      setNotification(data);
    } catch (error) {
      console.error('Failed to fetch notification:', error);
      toast({
        title: "Error",
        description: "Failed to load notification",
        variant: "destructive",
      });
      navigate("/notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    try {
      setActionLoading(true);
      await notificationService.deleteNotification(id);
      toast({
        title: "Success",
        description: "Notification deleted successfully",
      });
      navigate("/notifications");
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSend = async () => {
    if (!id) return;

    try {
      setActionLoading(true);
      await notificationService.sendNotification(id);
      toast({
        title: "Success",
        description: "Notification sent successfully",
      });
      fetchNotification();
    } catch (error) {
      console.error('Failed to send notification:', error);
      toast({
        title: "Error",
        description: "Failed to send notification",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <PageShell>
        <PageHero title="Notification Details" subtitle="Review content, status, audience, and attachments." eyebrow="Alerts" icon={<Bell className="h-6 w-6" />} actions={<Button variant="outline" size="sm" onClick={() => navigate("/notifications")}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />
        <SectionCard title="Loading" description="Fetching notification details.">
          <DetailSkeleton />
        </SectionCard>
      </PageShell>
    );
  }

  if (!notification) {
    return (
      <PageShell>
        <PageHero title="Notification Details" subtitle="Review content, status, audience, and attachments." eyebrow="Alerts" icon={<Bell className="h-6 w-6" />} actions={<Button variant="outline" size="sm" onClick={() => navigate("/notifications")}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />
        <SectionCard title="Notification Not Found" description="The requested notification could not be loaded.">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Notification not found</p>
          </div>
        </SectionCard>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero title="Notification Details" subtitle="Review content, status, audience, and attachments." eyebrow="Alerts" icon={<Bell className="h-6 w-6" />} actions={<Button variant="outline" size="sm" onClick={() => navigate("/notifications")}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>} />

      <Card className="surface-card">
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg">{notification.title}</CardTitle>
            <Badge className={getStatusColor(notification.status)}>
              {notification.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="mb-2 font-medium">Message</h4>
            <p className="text-muted-foreground">{notification.message}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Created by:</span>
              <p className="text-muted-foreground">{notification.createdBy?.name || 'System'}</p>
            </div>
            <div>
              <span className="font-medium">Target Audience:</span>
              <p className="text-muted-foreground capitalize">{notification.targetAudience.replace('_', ' ')}</p>
            </div>
            <div>
              <span className="font-medium">Created:</span>
              <p className="text-muted-foreground">{formatDate(notification.createdAt)}</p>
            </div>
            {notification.sentAt && (
              <div>
                <span className="font-medium">Sent:</span>
                <p className="text-muted-foreground">{formatDate(notification.sentAt)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Notification Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Type:</span>
              <p className="text-muted-foreground capitalize">{notification.type}</p>
            </div>
            <div>
              <span className="font-medium">Status:</span>
              <p className="text-muted-foreground capitalize">{notification.status}</p>
            </div>
            <div>
              <span className="font-medium">Target:</span>
              <p className="text-muted-foreground capitalize">{notification.targetAudience.replace('_', ' ')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {notification.attachments && notification.attachments.length > 0 && (
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Attachments ({notification.attachments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notification.attachments.map((att, index) => {
              const mime = att.mimetype || '';
              const Icon = mime.startsWith('image/') ? Image : mime.startsWith('video/') ? Film : FileText;
              return (
                <a
                  key={index}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-2xl p-3 text-primary transition-colors hover:bg-accent"
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm truncate">{att.originalName || `File ${index + 1}`}</span>
                </a>
              );
            })}
          </CardContent>
        </Card>
      )}

      <SectionCard title="Actions" description="Edit, send, or remove this notification.">
        <div className="flex gap-3">
          <Button
            onClick={() => navigate(`/state-admin/edit-notification/${notification._id}`)}
            variant="outline"
            className="flex-1"
            disabled={actionLoading}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>

          {notification.status === 'draft' && (
            <Button onClick={handleSend} className="flex-1" disabled={actionLoading}>
              {actionLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {actionLoading ? "Sending..." : "Send Now"}
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={actionLoading}>
                <Trash2 className="h-4 w-4 mr-2" />
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
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SectionCard>
    </PageShell>
  );
};

export default NotificationDetail;