import { ArrowLeft, Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const MeetingAgenda = () => {
  const navigate = useNavigate();

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
          <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="font-semibold text-lg mb-2">No Meetings Scheduled</h2>
          <p className="text-sm text-muted-foreground">
            Create a meeting agenda to notify all members.
          </p>
        </Card>
      </main>
    </div>
  );
};

export default MeetingAgenda;
