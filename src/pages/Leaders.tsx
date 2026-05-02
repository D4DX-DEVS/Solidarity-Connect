import { useState, useEffect, useCallback } from "react";
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
import { SectionCard } from "@/components/app/AppShell";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { leadersAPI, districtsAPI, groupsAPI, memberAuthAPI } from "@/utils/api";

const ROLE_TYPES = [
  { value: "all", label: "All" },
  { value: "state", label: "State" },
  { value: "district", label: "District" },
  { value: "area", label: "Area" },
  { value: "unit", label: "Unit" },
  { value: "murabi", label: "Murabi" },
  { value: "coordinator", label: "Coordinator" },
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
  group_admin: "Group Admin",
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

const Leaders = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRole } = useAuth();

  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
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
  const [selectedMurabiAreaId, setSelectedMurabiAreaId] = useState("");

  const requiresDistrict = activeTab === "district" || activeTab === "area" || activeTab === "unit";
  const requiresArea = activeTab === "area" || activeTab === "unit";
  const requiresUnit = activeTab === "unit";
  const requiresMurabiArea = activeTab === "murabi";

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
  }, [selectedDistrictId, selectedAreaId, selectedUnit, selectedMurabiAreaId]);

  // Load all area groups for murabi filter
  useEffect(() => {
    if (!requiresMurabiArea) {
      setSelectedMurabiAreaId("");
      return;
    }
    const loadMurabiAreas = async () => {
      try {
        const groupsResult = userRole === "member"
          ? await memberAuthAPI.getGroups({})
          : await groupsAPI.getGroups({ limit: 100, sort: "name" });
        const groups = groupsResult.data || [];
        setAreaOptions(
          groups
            .filter((g: any) => g?._id && g?.name)
            .map((g: any) => ({ id: g._id, label: g.name }))
        );
      } catch {
        setAreaOptions([]);
      }
    };
    loadMurabiAreas();
  }, [requiresMurabiArea, userRole]);

  const loadDistrictOptions = useCallback(async () => {
    if (!requiresDistrict) {
      setDistrictOptions([]);
      setAreaOptions([]);
      setUnitOptions([]);
      return;
    }

    try {
      const districtsResult = userRole === "member"
        ? await memberAuthAPI.getDistricts()
        : await districtsAPI.getDistricts({ limit: 100, sort: "name" });
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
        const params: Record<string, any> = selectedDistrictId ? { district: selectedDistrictId } : {};
        const groupsResult = userRole === "member"
          ? await memberAuthAPI.getGroups(params)
          : await groupsAPI.getGroups({ limit: 100, sort: "name", ...params });
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

        const result =
          userRole === "member"
            ? await leadersAPI.getMemberLeaders(params)
            : await leadersAPI.getLeaders(params);

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

  const fetchLeaders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: currentPage, limit: 20 };
      if (activeTab !== "all") params.roleType = activeTab;
      if (debouncedSearch) params.search = debouncedSearch;
      if (requiresDistrict && selectedDistrictId) params.districtId = selectedDistrictId;
      if (requiresArea && selectedAreaId) params.groupId = selectedAreaId;
      if (requiresUnit && selectedUnit) params.unitName = selectedUnit;
      if (requiresMurabiArea && selectedMurabiAreaId) params.groupId = selectedMurabiAreaId;

      const result =
        userRole === "member"
          ? await leadersAPI.getMemberLeaders(params)
          : await leadersAPI.getLeaders(params);

      setLeaders(result.data || []);
      if (result.pagination) {
        setTotalPages(result.pagination.totalPages || 1);
        setTotalDocs(result.pagination.totalDocs || 0);
        setHasNextPage(result.pagination.hasNextPage || false);
        setHasPrevPage(result.pagination.hasPrevPage || false);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load leaders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    activeTab,
    debouncedSearch,
    userRole,
    toast,
    requiresDistrict,
    requiresArea,
    requiresUnit,
    requiresMurabiArea,
    selectedDistrictId,
    selectedAreaId,
    selectedUnit,
    selectedMurabiAreaId,
  ]);

  useEffect(() => {
    fetchLeaders();
  }, [fetchLeaders]);

  return (
    <div className="app-page">
      <div className="app-page-orb app-page-orb-primary" aria-hidden />
      <div className="app-page-orb app-page-orb-secondary" aria-hidden />
      <HeaderWithLogout
        icon={<Star className="h-6 w-6 text-primary-foreground" />}
        title="Leaders"
        subtitle="All designated leaders"
        leftAction={
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
        }
      />

      <main className="app-main pt-4 space-y-4">
        <SectionCard title="Search & Filters" description="Browse leaders by role type, district, area, or unit.">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone or role name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Role type tabs */}
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1">
          {ROLE_TYPES.map((tab) => (
            <Button
              key={tab.value}
              size="sm"
              variant={activeTab === tab.value ? "default" : "outline"}
              className="flex-shrink-0"
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
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

        {/* Murabi area filter */}
        {requiresMurabiArea && (
          <div>
              <Select value={selectedMurabiAreaId || "all"} onValueChange={(value) => setSelectedMurabiAreaId(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Area (Group)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  {areaOptions.map((area) => (
                    <SelectItem key={area.id} value={area.id}>{area.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
          </div>
        )}
        </SectionCard>

        {/* Leader count */}
        {!loading && (
          <div className="data-strip text-sm text-muted-foreground">
            {totalDocs} leader{totalDocs !== 1 ? "s" : ""} found
          </div>
        )}

        {/* Leaders list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : leaders.length === 0 ? (
          <Card className="surface-card">
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No leaders found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {leaders.map((leader) => (
              <Card key={leader._id} className="surface-card transition-all hover:-translate-y-0.5">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {typeof leader.roleTag?.listingOrder === "number" && (
                          <span className="text-[11px] font-semibold bg-primary/10 text-primary rounded-full w-6 h-6 inline-flex items-center justify-center flex-shrink-0">
                            {leader.roleTag.listingOrder}
                          </span>
                        )}
                        <p className="font-semibold truncate">{leader.name}</p>
                        {leader.roleTag?.type && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                              ROLE_TYPE_COLORS[leader.roleTag.type] || "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {leader.roleTag.type.charAt(0).toUpperCase() + leader.roleTag.type.slice(1)}
                          </span>
                        )}
                      </div>

                      {leader.roleTag?.name && (
                        <p className="text-sm font-medium text-primary mt-0.5">
                          {leader.roleTag.name}
                        </p>
                      )}

                      {leader.roleTag?.roleDescription && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">
                          {leader.roleTag.roleDescription}
                        </p>
                      )}

                      <div className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {leader.phone}
                      </div>

                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {ADMIN_ROLE_LABELS[leader.role] || leader.role}
                        </Badge>
                        {leader.district && (
                          <Badge variant="secondary" className="text-xs">
                            {leader.district.name}
                          </Badge>
                        )}
                        {leader.group && (
                          <Badge variant="secondary" className="text-xs">
                            {leader.group.name}
                          </Badge>
                        )}
                        {leader.roleTag?.areaId && (
                          <Badge variant="secondary" className="text-xs bg-teal-100 text-teal-800">
                            Area: {leader.roleTag.areaId.name}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="bg-primary/10 p-2 rounded-full flex-shrink-0">
                      <Star className="h-5 w-5 text-primary fill-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="data-strip flex items-center justify-between py-4">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={!hasPrevPage || loading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!hasNextPage || loading}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Leaders;
