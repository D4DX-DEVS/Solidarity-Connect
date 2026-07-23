import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero, PageShell, SectionCard } from "@/components/app/AppShell";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <PageShell>
      <PageHero
        title="Page Not Found"
        subtitle={`The route ${location.pathname} does not exist or is no longer available.`}
        eyebrow="404"
        icon={<AlertCircle className="h-6 w-6" />}
      />
      <SectionCard title="Route Missing" description="Use the main dashboard to continue navigating the app.">
        <div className="rounded-2xl border border-border/60 bg-card p-10 text-center shadow-sm">
          <p className="mb-2 text-5xl font-semibold tracking-tight text-foreground">404</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            This page could not be found. It may have moved, been removed, or the link may be outdated.
          </p>
          <div className="mt-6 flex justify-center">
            <Button onClick={() => window.location.assign("/") }>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Home
            </Button>
          </div>
        </div>
      </SectionCard>
    </PageShell>
  );
};

export default NotFound;
