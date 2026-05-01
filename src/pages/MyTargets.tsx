import { ArrowLeft, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
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
        subtitle="Track recurring and personal targets from a single member-focused workspace."
        eyebrow="Targets"
        icon={<Target className="h-6 w-6" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate(getHomeRouteByRole(userRole))}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      <SectionCard title="Target Progress" description="Review your target list, recurring cadence, and progress updates.">
        <div className="mx-auto max-w-3xl">
          <UserTargetsSection />
        </div>
      </SectionCard>

      <BottomNav />
    </PageShell>
  );
};

export default MyTargets;
