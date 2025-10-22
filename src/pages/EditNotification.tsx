import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
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
        title: data.title,
        message: data.message,
        targetAudience: data.targetAudience,
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
    
    if (!formData.title.trim() || !formData.message.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!id) return;

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
        description: "Failed to update notification. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/notifications")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Edit Notification</h1>
          </div>
        </header>
        <main className="p-4">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-muted-foreground">Loading notification...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/notifications")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Edit Notification</h1>
          </div>
        </header>
        <main className="p-4">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Notification not found</p>
          </div>
        </main>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/notifications")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Edit Notification</h1>
        </div>
      </header>

      <main className="p-4">
        {notification.status === 'sent' && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-orange-800 text-sm">
              ⚠️ <strong>Warning:</strong> This notification has already been sent to recipients. 
              Editing will not affect the messages that were already delivered.
            </p>
          </div>
        )}
        
        <Card className="p-4 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Title</label>
              <Input
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Notification title"
                maxLength={200}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Message</label>
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
              <label className="text-sm font-medium mb-2 block">Target Audience</label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={formData.targetAudience}
                onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
              >
                <option value="all">All Members</option>
                <option value="members">Members Only</option>
                <option value="group_admins">Group Admins Only</option>
              </select>
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
              <Button 
                type="submit" 
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default EditNotification;