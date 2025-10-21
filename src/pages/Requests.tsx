import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";

const Requests = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <HeaderWithLogout
        icon={<FileText className="h-6 w-6 text-primary-foreground" />}
        title="Requests"
      />

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
