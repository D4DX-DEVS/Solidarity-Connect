import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { FormSkeleton } from "@/components/ui/loading-skeletons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { notificationService, type Notification } from "@/services/notificationService";

const EditNotification = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    targetAudience: "all",
  });

  useEffect(() => {
    if (id) {
      fetchNotification();
    }
  }, [id]);

  const fetchNotification = async () => {
    if (!id) return;

    try {
      setFetchLoading(true);
      const data = await notificationService.getNotificationById(id);
      setNotification(data);
      setFormData({
        title: data.title || "",
        message: data.message || "",
        targetAudience: data.targetAudience || "all",
      });
    } catch (error) {
      console.error('Failed to fetch notification:', error);
      toast({
        title: "Error",
        description: "Failed to load notification",
        variant: "destructive",
      });
      navigate("/notifications");
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) return;

    if (!formData.title.trim() || !formData.message.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await notificationService.updateNotification(id, {
        title: formData.title.trim(),
        message: formData.message.trim(),
        targetAudience: formData.targetAudience,
      });

      toast({
        title: "Success",
        description: "Notification updated successfully",
      });
      navigate("/notifications");
    } catch (error) {
      console.error('Failed to update notification:', error);
      toast({
        title: "Error",
        description: "Failed to update notification",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <PageShell>
        <PageHero
          title="Edit Notification"
          subtitle="Update the content and audience for this notification draft."
          eyebrow="Alerts"
          icon={<Bell className="h-6 w-6" />}
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate("/notifications")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          }
        />
        <SectionCard title="Loading" description="Fetching notification details.">
          <FormSkeleton fields={3} />
        </SectionCard>
      </PageShell>
    );
  }

  if (!notification) {
    return (
      <PageShell>
        <PageHero
          title="Edit Notification"
          subtitle="Update the content and audience for this notification draft."
          eyebrow="Alerts"
          icon={<Bell className="h-6 w-6" />}
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate("/notifications")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          }
        />
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
      <PageHero
        title="Edit Notification"
        subtitle="Update the content and audience for this notification draft."
        eyebrow="Alerts"
        icon={<Bell className="h-6 w-6" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/notifications")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        }
      />

      <SectionCard title="Notification Details" description="Edit the draft message and target audience.">
        {notification.status === 'sent' && (
          <div className="data-strip mb-4 border-orange-200 bg-orange-50 text-sm text-orange-800">
            <strong>Warning:</strong> This notification has already been sent to recipients. Editing will not affect the messages that were already delivered.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Title</label>
            <Input
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Notification title"
              maxLength={200}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Message</label>
            <Textarea
              required
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Notification message"
              rows={4}
              maxLength={1000}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Target Audience</label>
            <Select
              value={formData.targetAudience}
              onValueChange={(value) => setFormData({ ...formData, targetAudience: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                <SelectItem value="members">Members Only</SelectItem>
                <SelectItem value="group_admins">Area Admins Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/notifications")}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </SectionCard>
    </PageShell>
  );
};

export default EditNotification;