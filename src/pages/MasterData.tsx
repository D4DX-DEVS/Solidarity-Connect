import { Building2, MapPin, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricCard, PageHero, PageShell } from "@/components/app/AppShell";
import { useSearchParams } from "react-router-dom";
import DistrictsPanel from "@/components/master-data/DistrictsPanel";
import AreasPanel from "@/components/master-data/AreasPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useDistricts } from "@/hooks/useDistricts";

/**
 * One home for districts and areas. State admins get both tabs; district admins
 * get only their own district's areas (the API scopes the list to it).
 */
const MasterData = () => {
  const { user } = useAuth();
  const isStateAdmin = user?.role === "state_admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "areas" ? "areas" : "districts";
  const handleTabChange = (tab: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === "areas") next.set("tab", "areas");
        else next.delete("tab");
        return next;
      },
      { replace: true },
    );
  };

  // Every district, unfiltered — feeds the metric cards, the area filter and the area dialog
  const { data: allDistrictsResponse } = useDistricts({ sort: 'name', isActive: true, limit: 100 });
  const allDistricts = allDistrictsResponse?.data || [];
  const scopedDistricts = isStateAdmin
    ? allDistricts
    : allDistricts.filter((district) => district._id === user?.district?._id);

  const totalDistricts = allDistrictsResponse?.pagination?.totalDocs ?? allDistricts.length;
  const totalGroups = scopedDistricts.reduce((sum, d) => sum + (d.statistics?.totalGroups || 0), 0);
  const totalMembers = scopedDistricts.reduce((sum, d) => sum + (d.statistics?.totalMembers || 0), 0);
  const districtName = scopedDistricts[0]?.name || user?.district?.name || "—";

  return (
    <PageShell>
      <PageHero
        title="Master Data"
        subtitle={
          isStateAdmin
            ? "Manage districts and areas — the organizational backbone of the system."
            : `Manage the areas in ${districtName} district.`
        }
        eyebrow={isStateAdmin ? "State Admin" : "District Admin"}
        icon={<Building2 className="h-6 w-6" />}
      />

      {/* District admins: the district name sits in the area list title, which mobile still shows */}
      <div className={`grid gap-1.5 sm:gap-3 ${isStateAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
        {isStateAdmin && (
          <MetricCard title="Districts" value={String(totalDistricts)} icon={Building2} tone="primary" />
        )}
        <MetricCard title="Areas" value={String(totalGroups)} icon={MapPin} tone="warning" />
        <MetricCard title="Total Members" value={String(totalMembers)} icon={Users} tone="success" />
      </div>

      {isStateAdmin ? (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="districts" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Districts
            </TabsTrigger>
            <TabsTrigger value="areas" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Areas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="districts" className="space-y-4 mt-4">
            <DistrictsPanel />
          </TabsContent>

          <TabsContent value="areas" className="space-y-4 mt-4">
            <AreasPanel districts={allDistricts} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          <AreasPanel districts={scopedDistricts} districtLocked />
        </div>
      )}
    </PageShell>
  );
};

export default MasterData;
