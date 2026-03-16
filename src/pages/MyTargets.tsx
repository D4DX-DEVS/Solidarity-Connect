import { ArrowLeft, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import UserTargetsSection from "@/components/UserTargetsSection";
import BottomNav from "@/components/BottomNav";
import { getHomeRouteByRole } from "@/lib/roleRoutes";
import { useAuth } from "@/contexts/AuthContext";

const MyTargets = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-40 bg-card border-b px-4 py-4 flex items-center gap-3 shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => navigate(getHomeRouteByRole(userRole))}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h1 className="font-bold text-lg">My Targets</h1>
        </div>
      </header>
      <main className="p-4 max-w-2xl mx-auto">
        <UserTargetsSection />
      </main>
      <BottomNav />
    </div>
  );
};

export default MyTargets;
