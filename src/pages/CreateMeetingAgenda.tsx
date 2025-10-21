import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

const CreateMeetingAgenda = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
    agenda: "",
    targetAudience: "all",
    district: "",
    group: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Meeting created:", formData);
    toast({
      title: "Meeting Agenda Created",
      description: "All members have been notified about the meeting.",
    });
    navigate("/state-admin/meeting-agenda");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Create Meeting Agenda</h1>
        </div>
      </header>

      <main className="p-4">
        <Card className="p-4 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Meeting Title</label>
              <Input
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Monthly General Meeting"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-2 block">Date</label>
                <Input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Time</label>
                <Input
                  type="time"
                  required
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Location</label>
              <Input
                required
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Meeting location"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Agenda Details</label>
              <Textarea
                required
                value={formData.agenda}
                onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                placeholder="Meeting agenda and topics to be discussed"
                rows={4}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Target Participants</label>
              <select
                required
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={formData.targetAudience}
                onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
              >
                <option value="all">All Members</option>
                <option value="district">Specific District</option>
                <option value="group">Specific Group</option>
                <option value="admins">All Admins Only</option>
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
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                <Calendar className="h-4 w-4 mr-2" />
                Create Meeting
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default CreateMeetingAgenda;
