import { ArrowLeft, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero, PageShell } from "@/components/app/AppShell";
import { useNavigate } from "react-router-dom";
import UserTargetsSection from "@/components/UserTargetsSection";
import BottomNav from "@/components/BottomNav";
import { getHomeRouteByRole } from "@/lib/roleRoutes";
import { useAuth } from "@/contexts/AuthContext";

const MyTargets = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();

  return (
    <PageShell contentClassName="pb-28">
      <PageHero
        title="My Targets"
        subtitle="Track and mark your targets."
        eyebrow="Targets"
        icon={<Target className="h-6 w-6" />}
        actions={
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => navigate(getHomeRouteByRole(userRole))}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-5xl">
        <UserTargetsSection />
      </div>

      <BottomNav />
    </PageShell>
  );
};

export default MyTargets;
