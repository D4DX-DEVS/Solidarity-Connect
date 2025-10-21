import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

const SendNotification = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    type: "General",
    targetAudience: "all",
    district: "",
    group: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Notification sent:", formData);
    toast({
      title: "Notification Sent",
      description: "Your notification has been sent successfully.",
    });
    navigate("/notifications");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/state-admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Send Notification</h1>
        </div>
      </header>

      <main className="p-4">
        <Card className="p-4 shadow-sm">
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
              <label className="text-sm font-medium mb-2 block">Type</label>
              <select
                required
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="General">General</option>
                <option value="Meeting">Meeting</option>
                <option value="Payment">Payment</option>
                <option value="Activity">Activity</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Target Audience</label>
              <select
                required
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={formData.targetAudience}
                onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
              >
                <option value="all">All Members</option>
                <option value="district">Specific District</option>
                <option value="group">Specific Group</option>
                <option value="admins">All Admins</option>
              </select>
            </div>

            {formData.targetAudience === "district" && (
              <div>
                <label className="text-sm font-medium mb-2 block">Select District</label>
                <select
                  required
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                >
                  <option value="">Select District</option>
                  <option value="Thrissur">Thrissur</option>
                  <option value="Malappuram">Malappuram</option>
                  <option value="Kozhikode">Kozhikode</option>
                </select>
              </div>
            )}

            {formData.targetAudience === "group" && (
              <div>
                <label className="text-sm font-medium mb-2 block">Select Group</label>
                <select
                  required
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  value={formData.group}
                  onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                >
                  <option value="">Select Group</option>
                  <option value="Varantharappalli">Varantharappalli</option>
                  <option value="Perumpilavu">Perumpilavu</option>
                </select>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/notifications")}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                <Send className="h-4 w-4 mr-2" />
                Send Notification
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default SendNotification;
