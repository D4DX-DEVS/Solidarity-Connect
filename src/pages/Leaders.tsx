import { useState, useEffect, useCallback } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Star, Search, ChevronLeft, ChevronRight, Users, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { leadersAPI, districtsAPI, groupsAPI } from "@/utils/api";

// ponytail: no separate Murabi/Coordinator entries — the Area filter includes them server-side
const ROLE_TYPES = [
  { value: "all", label: "All" },
  { value: "state", label: "State" },
  { value: "district", label: "District" },
  { value: "area", label: "Area" },
  { value: "unit", label: "Unit" },
];

const ROLE_TYPE_COLORS: Record<string, string> = {
  state: "bg-purple-100 text-purple-800",
  district: "bg-blue-100 text-blue-800",
  area: "bg-green-100 text-green-800",
  unit: "bg-orange-100 text-orange-800",
  murabi: "bg-teal-100 text-teal-800",
  coordinator: "bg-indigo-100 text-indigo-800",
};

const ADMIN_ROLE_LABELS: Record<string, string> = {
  state_admin: "State Admin",
  district_admin: "District Admin",
  group_admin: "Area Admin",
  member: "Member",
};

interface Leader {
  _id: string;
  name: string;
  phone: string;
  role: string;
  isLeader: boolean;
  roleTag?: { type?: string; name?: string; areaId?: { _id?: string; name: string; code?: string }; roleDescription?: string; listingOrder?: number | null };
  district?: { _id?: string; name: string; code?: string };
  group?: { _id?: string; name: string; code?: string };
}

interface FilterOption {
  id: string;
  label: string;
}

const Leaders = ({ embedded = false }: { embedded?: boolean }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRole } = useAuth();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Hierarchy-first: every role opens on State leaders, then narrows via the dropdown
  const [activeTab, setActiveTab] = useState("state");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [districtOptions, setDistrictOptions] = useState<FilterOption[]>([]);
  const [areaOptions, setAreaOptions] = useState<FilterOption[]>([]);
  const [unitOptions, setUnitOptions] = useState<string[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");

  // Members are server-scoped to state leaders + their own district/area,
  // so the district/area/unit cascade filters are hidden for them.
  const isMember = userRole === "member";
  const requiresDistrict = !isMember && (activeTab === "district" || activeTab === "area" || activeTab === "unit");
  const requiresArea = !isMember && (activeTab === "area" || activeTab === "unit");
  const requiresUnit = !isMember && activeTab === "unit";

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, activeTab]);

  // Reset cascading filters when role type changes
  useEffect(() => {
    if (!requiresDistrict) {
      setSelectedDistrictId("");
      setSelectedAreaId("");
      setSelectedUnit("");
      return;
    }

    if (!requiresArea) {
      setSelectedAreaId("");
      setSelectedUnit("");
      return;
    }

    if (!requiresUnit) {
      setSelectedUnit("");
    }
  }, [activeTab, requiresDistrict, requiresArea, requiresUnit]);

  useEffect(() => {
    setSelectedAreaId("");
    setSelectedUnit("");
  }, [selectedDistrictId]);

  useEffect(() => {
    setSelectedUnit("");
  }, [selectedAreaId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDistrictId, selectedAreaId, selectedUnit]);

  const loadDistrictOptions = useCallback(async () => {
    if (!requiresDistrict) {
      setDistrictOptions([]);
      setAreaOptions([]);
      setUnitOptions([]);
      return;
    }

    try {
      // requiresDistrict is false for members, so this loader only runs for admins
      const districtsResult = await districtsAPI.getDistricts({ limit: 100, sort: "name" });
      const districts = districtsResult.data || [];
      const normalized = districts
        .filter((district: any) => district?._id && district?.name)
        .map((district: any) => ({ id: district._id, label: district.name }));
      setDistrictOptions(normalized);
    } catch {
      setDistrictOptions([]);
    }
  }, [requiresDistrict, userRole]);

  useEffect(() => {
    loadDistrictOptions();
  }, [loadDistrictOptions]);

  useEffect(() => {
    if (!requiresArea) {
      setAreaOptions([]);
      return;
    }

    const loadAreaOptions = async () => {
      try {
        // directory=true: read-only area picker, unscoped for every admin role
        const params: Record<string, any> = selectedDistrictId ? { district: selectedDistrictId } : {};
        const groupsResult = await groupsAPI.getGroups({ limit: 500, sort: "name", directory: true, ...params });
        const groups = groupsResult.data || [];
        const normalized = groups
          .filter((group: any) => group?._id && group?.name)
          .map((group: any) => ({ id: group._id, label: group.name }));
        setAreaOptions(normalized);
      } catch {
        setAreaOptions([]);
      }
    };

    loadAreaOptions();
  }, [requiresArea, selectedDistrictId, userRole]);

  useEffect(() => {
    if (!requiresUnit) {
      setUnitOptions([]);
      return;
    }

    const loadUnitOptions = async () => {
      try {
        const params: Record<string, any> = {
          page: 1,
          limit: 500,
          roleType: "unit",
        };
        if (selectedDistrictId) params.districtId = selectedDistrictId;
        if (selectedAreaId) params.groupId = selectedAreaId;

        const result = await leadersAPI.getLeaders(params);

        const names = new Set<string>();
        (result.data || []).forEach((leader: Leader) => {
          const unitName = leader.roleTag?.name?.trim();
          if (unitName) names.add(unitName);
        });

        setUnitOptions(Array.from(names).sort((a, b) => a.localeCompare(b)));
      } catch {
        setUnitOptions([]);
      }
    };

    loadUnitOptions();
  }, [requiresUnit, selectedDistrictId, selectedAreaId, userRole]);

  // ponytail: the list is cached; the cascading filter-option loaders above stay as-is —
  // two effects share areaOptions, and untangling that buys no user-visible speed.
  const leaderParams: Record<string, any> = {
    page: currentPage,
    limit: 10,
    ...(activeTab !== "all" ? { roleType: activeTab } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(requiresDistrict && selectedDistrictId ? { districtId: selectedDistrictId } : {}),
    ...(requiresArea && selectedAreaId ? { groupId: selectedAreaId } : {}),
    ...(requiresUnit && selectedUnit ? { unitName: selectedUnit } : {}),
  };

  const { data: leadersResult, isPending: loading, isError: leadersError } = useQuery({
    queryKey: ['leaders', 'list', userRole, leaderParams],
    queryFn: () =>
      userRole === "member"
        ? leadersAPI.getMemberLeaders(leaderParams)
        : leadersAPI.getLeaders(leaderParams),
    placeholderData: keepPreviousData,
  });

  const leaders: Leader[] = leadersResult?.data || [];

  useEffect(() => {
    if (leadersError) {
      toast({ title: "Error", description: "Failed to load leaders", variant: "destructive" });
    }
  }, [leadersError, toast]);

  useEffect(() => {
    const p = leadersResult?.pagination;
    if (!p) return;
    setTotalPages(p.totalPages || 1);
    setTotalDocs(p.totalDocs || 0);
    setHasNextPage(p.hasNextPage || false);
    setHasPrevPage(p.hasPrevPage || false);
  }, [leadersResult]);

  const content = (
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-[7.5rem] shrink-0" aria-label="Filter by role type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_TYPES.map((tab) => (
                <SelectItem key={tab.value} value={tab.value}>{tab.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hierarchy filters */}
        {requiresDistrict && (
          <Card className="shadow-sm">
            <CardContent className="p-3 space-y-3">
              <Select value={selectedDistrictId || "all"} onValueChange={(value) => setSelectedDistrictId(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {districtOptions.map((district) => (
                    <SelectItem key={district.id} value={district.id}>{district.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {requiresArea && (
                <Select value={selectedAreaId || "all"} onValueChange={(value) => setSelectedAreaId(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Areas</SelectItem>
                    {areaOptions.map((area) => (
                      <SelectItem key={area.id} value={area.id}>{area.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {requiresUnit && (
                <Select value={selectedUnit || "all"} onValueChange={(value) => setSelectedUnit(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Unit Sections</SelectItem>
                    {unitOptions.map((unit) => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        )}

        {/* Leader count */}
        {!loading && (
          <p className="px-1 text-xs text-muted-foreground">
            {totalDocs} leader{totalDocs !== 1 ? "s" : ""} found
          </p>
        )}

        {/* Leaders list */}
        {loading ? (
          <ListSkeleton rows={5} />
        ) : leaders.length === 0 ? (
          <Card className="surface-card">
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No leaders found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {leaders.map((leader) => {
              // Fallback for admins never given a role tag in Role Management:
              // derive the type chip + area name from their role/group instead of showing nothing
              const tagType =
                leader.roleTag?.type ||
                ({ state_admin: "state", district_admin: "district", group_admin: "area" } as Record<string, string>)[leader.role];
              const tagName =
                leader.roleTag?.name ||
                (leader.role === "group_admin" ? leader.group?.name : leader.role === "district_admin" ? leader.district?.name : undefined);
              return (
              <Card key={leader._id} className="surface-card">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2.5">
                    {userRole === "state_admin" && typeof leader.roleTag?.listingOrder === "number" && (
                      <span className="mt-0.5 text-[11px] font-semibold bg-primary/10 text-primary rounded-full w-5 h-5 inline-flex items-center justify-center flex-shrink-0">
                        {leader.roleTag.listingOrder}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{leader.name}</p>
                        {tagType && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                              ROLE_TYPE_COLORS[tagType] || "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {tagType.charAt(0).toUpperCase() + tagType.slice(1)}
                          </span>
                        )}
                      </div>

                      {tagName && (
                        <p className="text-xs font-medium text-primary">{tagName}</p>
                      )}

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <a href={`tel:${leader.phone}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {leader.phone}
                        </a>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {ADMIN_ROLE_LABELS[leader.role] || leader.role}
                        </Badge>
                        {leader.district && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {leader.district.name}
                          </Badge>
                        )}
                        {leader.group && leader.group.name !== leader.district?.name && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {leader.group.name}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Star className="h-4 w-4 text-primary fill-primary flex-shrink-0 mt-0.5" />
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => p - 1)} disabled={!hasPrevPage || loading} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-14 text-center text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => p + 1)} disabled={!hasNextPage || loading} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="app-page">
      <div className="app-page-orb app-page-orb-primary" aria-hidden />
      <div className="app-page-orb app-page-orb-secondary" aria-hidden />
      <HeaderWithLogout
        icon={<Star className="h-6 w-6 text-primary-foreground" />}
        title="Leaders"
        subtitle="All designated leaders"
      />

      <main className="app-main pt-4 pb-28 lg:pb-8 space-y-3">
        {content}
      </main>
    </div>
  );
};

export default Leaders;
