import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface Session {
  id: string;
  title: string;
  description: string;
  pdfFile: File | null;
}

const CreateMeetingAgenda = () => {
  const navigate = useNavigate();
  const [month, setMonth] = useState("");
  const [sessions, setSessions] = useState<Session[]>([
    { id: "1", title: "", description: "", pdfFile: null },
  ]);

  const handleAddSession = () => {
    const newSession: Session = {
      id: Date.now().toString(),
      title: "",
      description: "",
      pdfFile: null,
    };
    setSessions([...sessions, newSession]);
  };

  const handleRemoveSession = (id: string) => {
    if (sessions.length === 1) {
      toast({
        title: "Cannot Remove",
        description: "At least one session is required.",
        variant: "destructive",
      });
      return;
    }
    setSessions(sessions.filter((s) => s.id !== id));
  };

  const handleSessionChange = (id: string, field: keyof Session, value: any) => {
    setSessions(
      sessions.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleFileChange = (id: string, file: File | null) => {
    if (file && file.type !== "application/pdf") {
      toast({
        title: "Invalid File",
        description: "Please upload a PDF file only.",
        variant: "destructive",
      });
      return;
    }
    handleSessionChange(id, "pdfFile", file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!month) {
      toast({
        title: "Month Required",
        description: "Please select a month for the meeting.",
        variant: "destructive",
      });
      return;
    }

    const hasEmptySessions = sessions.some((s) => !s.title || !s.description);
    if (hasEmptySessions) {
      toast({
        title: "Incomplete Sessions",
        description: "Please fill in all session titles and descriptions.",
        variant: "destructive",
      });
      return;
    }

    console.log("Meeting created:", { month, sessions });
    toast({
      title: "Meeting Agenda Created",
      description: "All members have been notified about the meeting sessions.",
    });
    navigate("/state-admin/meeting-agenda");
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="bg-card border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Create Meeting Agenda</h1>
        </div>
      </header>

      <main className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <label className="text-sm font-medium mb-2 block">Meeting Month</label>
              <Input
                type="month"
                required
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full"
              />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Meeting Sessions</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddSession}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Session
            </Button>
          </div>

          <div className="space-y-4">
            {sessions.map((session, index) => (
              <Card key={session.id} className="shadow-sm">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Session {index + 1}</h3>
                    {sessions.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveSession(session.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Session Title
                    </label>
                    <Input
                      required
                      value={session.title}
                      onChange={(e) =>
                        handleSessionChange(session.id, "title", e.target.value)
                      }
                      placeholder="e.g. Opening Ceremony, Main Discussion"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Session Description
                    </label>
                    <Textarea
                      required
                      value={session.description}
                      onChange={(e) =>
                        handleSessionChange(session.id, "description", e.target.value)
                      }
                      placeholder="Details about this session"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Upload PDF (Optional)
                    </label>
                    <div className="border-2 border-dashed rounded-lg p-4">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) =>
                          handleFileChange(
                            session.id,
                            e.target.files ? e.target.files[0] : null
                          )
                        }
                        className="hidden"
                        id={`pdf-${session.id}`}
                      />
                      <label
                        htmlFor={`pdf-${session.id}`}
                        className="flex flex-col items-center cursor-pointer"
                      >
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-primary hover:underline">
                          Click to upload PDF
                        </span>
                        {session.pdfFile && (
                          <span className="text-xs text-muted-foreground mt-2">
                            Selected: {session.pdfFile.name}
                          </span>
                        )}
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
              <Calendar className="h-4 w-4 mr-2" />
              Create Meeting
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default CreateMeetingAgenda;
