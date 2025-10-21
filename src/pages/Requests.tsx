import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import BottomNav from "@/components/BottomNav";

const Requests = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <FileText className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">Requests</h1>
        </div>
      </header>

      <main className="p-4">
        <Card className="p-8 shadow-sm text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="font-semibold text-lg mb-2">No Pending Requests</h2>
          <p className="text-sm text-muted-foreground">
            Transfer and edit requests will appear here for approval.
          </p>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default Requests;
