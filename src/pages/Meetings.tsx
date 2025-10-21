import { Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";

const Meetings = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <HeaderWithLogout
        icon={<Calendar className="h-6 w-6 text-primary-foreground" />}
        title="Meetings"
      />

      <main className="p-4">
        <Card className="p-8 shadow-sm text-center">
          <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="font-semibold text-lg mb-2">No Meetings Scheduled</h2>
          <p className="text-sm text-muted-foreground">
            State admin will create meeting agendas that will appear here.
          </p>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default Meetings;
