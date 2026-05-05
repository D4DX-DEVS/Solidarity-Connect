import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { notificationService } from "@/services/notificationService";

const SendNotification = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    targetAudience: "all",
  });

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

    try {
      setLoading(true);
      await notificationService.createNotification({
        title: formData.title.trim(),
        message: formData.message.trim(),
        targetAudience: formData.targetAudience,
      });
      
      toast({
        title: "Success",
        description: "Notification created successfully as draft",
      });
      navigate("/notifications");
    } catch (error) {
      console.error('Failed to create notification:', error);
      toast({
        title: "Error",
        description: "Failed to create notification. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <PageHero
        title="Send Notification"
        subtitle="Create a notification draft for the selected audience."
        eyebrow="Alerts"
        icon={<Send className="h-6 w-6" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/state-admin")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        }
      />

      <SectionCard title="Notification Draft" description="Compose the message and choose who should receive it.">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Title</label>
              <Input
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Notification title"
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
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Target Audience</label>
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
              <Button 
                type="submit" 
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {loading ? "Creating..." : "Create Notification"}
              </Button>
            </div>
          </form>
      </SectionCard>
    </PageShell>
  );
};

export default SendNotification;
