import { ArrowLeft, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero, PageShell } from "@/components/app/AppShell";
import { useNavigate } from "react-router-dom";
import UserTargetsSection from "@/components/UserTargetsSection";import { getHomeRouteByRole } from "@/lib/roleRoutes";
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
      />

      <div className="mx-auto w-full max-w-5xl">
        <UserTargetsSection />
      </div>    </PageShell>
  );
};

export default MyTargets;
