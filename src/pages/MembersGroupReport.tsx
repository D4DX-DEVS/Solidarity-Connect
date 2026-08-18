import { Users, Download, TrendingUp, Loader2, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import PageSizeInput from "@/components/app/PageSizeInput";
import { useState, useEffect, useRef, useCallback } from "react";
import { reportsAPI, districtsAPI } from "@/utils/api";

interface UnitStats {
  _id: string;
  groupName: string;
  groupCode: string;
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  abroadMembers: number;
  applicantMembers: number;
  totalBaithulMaal: number;
}

interface DistrictStats {
  _id: string;
  districtName: string;
  districtCode: string;
  unitCount: number;
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  abroadMembers: number;
  applicantMembers: number;
  totalBaithulMaal: number;
}

interface CensusSummary {
  districtCount: number;
  unitCount: number;
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  abroadMembers: number;
  applicantMembers: number;
  totalBaithulMaal: number;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalDocs: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface DistrictOption {
  _id: string;
  name: string;
  code: string;
}

// ponytail: in-memory cache only, 5 min TTL — a page reload is the refresh button.
const CACHE_TTL_MS = 5 * 60 * 1000;

const EMPTY_SUMMARY: CensusSummary = {
  districtCount: 0, unitCount: 0, totalMembers: 0, activeMembers: 0,
  inactiveMembers: 0, abroadMembers: 0, applicantMembers: 0, totalBaithulMaal: 0,
};

const MembersGroupReport = () => {
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [loading, setLoading] = useState(true);
  const [paginationLoading, setPaginationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [districtOptions, setDistrictOptions] = useState<DistrictOption[]>([]);
  const [rows, setRows] = useState<DistrictStats[]>([]);
  const [summary, setSummary] = useState<CensusSummary>(EMPTY_SUMMARY);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [openDistricts, setOpenDistricts] = useState<string[]>([]);
  const [units, setUnits] = useState<Record<string, UnitStats[]>>({});
  const [unitLoading, setUnitLoading] = useState<Record<string, boolean>>({});

  const cache = useRef(new Map<string, { ts: number; data: any }>());

  const readCache = (key: string) => {
    const hit = cache.current.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
    if (hit) cache.current.delete(key);
    return null;
  };
  const writeCache = (key: string, data: any) => cache.current.set(key, { ts: Date.now(), data });

  // District list for the filter
  useEffect(() => {
    districtsAPI.getDistricts()
      .then((res) => { if (res.success) setDistrictOptions(res.data || []); })
      .catch((err) => console.error("Error fetching districts:", err));
  }, []);

  // District census — server-side paginated, cached per page
  useEffect(() => {
    let cancelled = false;
    const key = `census|${selectedDistrict}|${currentPage}|${pageSize}`;

    const apply = (payload: any) => {
      setRows(payload.data.districts || []);
      setSummary(payload.data.summary || EMPTY_SUMMARY);
      setPagination(payload.pagination || null);
    };

    const cached = readCache(key);
    if (cached) {
      apply(cached);
      setLoading(false);
      setError(null);
      return;
    }

    const load = async () => {
      if (currentPage > 1) setPaginationLoading(true); else setLoading(true);
      setError(null);
      try {
        const params: Record<string, any> = { page: currentPage, limit: pageSize };
        if (selectedDistrict) params.district = selectedDistrict;
        const res = await reportsAPI.getDistrictCensus(params);
        if (cancelled) return;
        if (!res.success) throw new Error(res.message || "Failed to load report");
        writeCache(key, res);
        apply(res);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to fetch report");
      } finally {
        if (!cancelled) { setLoading(false); setPaginationLoading(false); }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedDistrict, currentPage, pageSize]);

  // Units are fetched only when a district row is expanded, then cached.
  const loadUnits = useCallback(async (districtId: string) => {
    const key = `units|${districtId}`;
    const cached = readCache(key);
    if (cached) { setUnits((u) => ({ ...u, [districtId]: cached })); return; }

    setUnitLoading((s) => ({ ...s, [districtId]: true }));
    try {
      const res = await reportsAPI.getDistrictUnits(districtId);
      if (res.success) {
        writeCache(key, res.data || []);
        setUnits((u) => ({ ...u, [districtId]: res.data || [] }));
      }
    } catch (err) {
      console.error("Error fetching units:", err);
    } finally {
      setUnitLoading((s) => ({ ...s, [districtId]: false }));
    }
  }, []);

  const handleOpenChange = (values: string[]) => {
    setOpenDistricts(values);
    values.filter((id) => !units[id] && !unitLoading[id]).forEach(loadUnits);
  };

  const handleDistrictChange = (districtId: string) => {
    setSelectedDistrict(districtId);
    setOpenDistricts([]);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setOpenDistricts([]);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Export always rebuilds server-side from the whole filtered set, never from this page.
  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedDistrict) params.append("district", selectedDistrict);

      const token = localStorage.getItem("token");
      const apiUrl = import.meta.env.VITE_API_URL || "https://solidarity-app-api-erv6h.ondigitalocean.app/api";
      const response = await fetch(`${apiUrl}/reports/export/members?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `group-reports-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export data. Please try again.");
    }
  };

  return (
    <PageShell contentClassName="pb-24">
      <PageHero
        title="Group Reports"
        subtitle="District and unit member census with Baithul Maal coverage."
        eyebrow="Reports"
        icon={<Users className="h-6 w-6" />}
        actions={
          <Button size="sm" variant="outline" onClick={handleExport} disabled={loading}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        }
      />

      {loading && (
        <SectionCard title="Preparing Report" description="Loading district statistics.">
          <ListSkeleton rows={5} />
        </SectionCard>
      )}

      {error && !loading && (
        <SectionCard title="Report Error" description="The report could not be loaded with the current filters.">
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => handlePageChange(currentPage)}>
              Retry
            </Button>
          </div>
        </SectionCard>
      )}

      {!loading && !error && (
        <>
          {/* Summary is the whole filtered set, never just this page */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
            <MetricCard title="Total" value={String(summary.totalMembers)} icon={Users} tone="primary" />
            <MetricCard title="Active" value={String(summary.activeMembers)} icon={TrendingUp} tone="success" />
            <MetricCard title="Inactive" value={String(summary.inactiveMembers)} icon={Users} tone="neutral" className="hidden sm:block" />
            <MetricCard title="Abroad" value={String(summary.abroadMembers)} icon={Users} tone="warning" />
            <MetricCard title="Applicant" value={String(summary.applicantMembers)} icon={Users} tone="danger" />
          </div>

          <SectionCard
            title="District Census"
            description={`${summary.districtCount} districts · ${summary.unitCount} units. Expand a district to see its units.`}
            contentClassName="px-0 pb-0 pt-3 sm:px-0 sm:pb-0 sm:pt-4"
            action={
              <Select
                value={selectedDistrict || "all"}
                onValueChange={(val) => handleDistrictChange(val === "all" ? "" : val)}
              >
                <SelectTrigger className="h-9 w-[140px] px-2 text-xs sm:w-[200px] sm:text-sm">
                  <SelectValue placeholder="All Districts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {districtOptions.map((d) => (
                    <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          >
            <div className="hidden grid-cols-[1fr_repeat(4,72px)] gap-2 border-b px-4 pb-2 text-xs font-medium text-muted-foreground sm:grid sm:px-6">
              <span>District</span>
              <span className="text-right">Units</span>
              <span className="text-right">Total</span>
              <span className="text-right">Active</span>
              <span className="text-right">Abroad</span>
            </div>

            <Accordion type="multiple" value={openDistricts} onValueChange={handleOpenChange}>
              {rows.map((district) => (
                <AccordionItem key={district._id} value={district._id} className="border-b last:border-b-0">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
                    <div className="grid w-full grid-cols-[1fr_auto] items-center gap-2 pr-2 text-left sm:grid-cols-[1fr_repeat(4,72px)]">
                      <span className="flex min-w-0 items-center gap-2">
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-semibold">{district.districtName}</span>
                      </span>
                      <span className="hidden text-right text-sm text-muted-foreground sm:block">{district.unitCount}</span>
                      <span className="text-right text-sm font-semibold text-primary">{district.totalMembers}</span>
                      <span className="hidden text-right text-sm font-semibold text-green-600 sm:block">{district.activeMembers}</span>
                      <span className="hidden text-right text-sm font-semibold text-blue-600 sm:block">{district.abroadMembers}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-muted/30 pb-0">
                    {!units[district._id] && unitLoading[district._id] ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading units…
                      </div>
                    ) : units[district._id]?.length ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Unit</TableHead>
                              <TableHead>Code</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead className="text-right">Active</TableHead>
                              <TableHead className="text-right">Inactive</TableHead>
                              <TableHead className="text-right">Abroad</TableHead>
                              <TableHead className="text-right">Applicant</TableHead>
                              <TableHead className="text-right">Baithul Maal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {units[district._id].map((unit) => (
                              <TableRow key={unit._id}>
                                <TableCell className="font-medium">{unit.groupName}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{unit.groupCode}</TableCell>
                                <TableCell className="text-right font-semibold text-primary">{unit.totalMembers}</TableCell>
                                <TableCell className="text-right font-semibold text-green-600">{unit.activeMembers}</TableCell>
                                <TableCell className="text-right font-semibold text-gray-600">{unit.inactiveMembers}</TableCell>
                                <TableCell className="text-right font-semibold text-blue-600">{unit.abroadMembers}</TableCell>
                                <TableCell className="text-right font-semibold text-orange-600">{unit.applicantMembers}</TableCell>
                                <TableCell className="text-right font-semibold text-purple-600">
                                  ₹{unit.totalBaithulMaal.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-background font-semibold">
                              <TableCell colSpan={2}>District total</TableCell>
                              <TableCell className="text-right text-primary">{district.totalMembers}</TableCell>
                              <TableCell className="text-right text-green-600">{district.activeMembers}</TableCell>
                              <TableCell className="text-right text-gray-600">{district.inactiveMembers}</TableCell>
                              <TableCell className="text-right text-blue-600">{district.abroadMembers}</TableCell>
                              <TableCell className="text-right text-orange-600">{district.applicantMembers}</TableCell>
                              <TableCell className="text-right text-purple-600">
                                ₹{district.totalBaithulMaal.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="py-6 text-center text-sm text-muted-foreground">No units in this district.</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {rows.length === 0 && (
              <p className="px-6 py-8 text-center text-muted-foreground">No districts match the selected filter.</p>
            )}

            {pagination && pagination.totalDocs > 0 && (
              <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <span className="text-xs text-muted-foreground sm:text-sm">
                    Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to{" "}
                    {Math.min(pagination.currentPage * pagination.limit, pagination.totalDocs)} of{" "}
                    {pagination.totalDocs} districts
                  </span>

                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <PageSizeInput value={pageSize} onChange={handlePageSizeChange} />
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.currentPage - 1)}
                        disabled={!pagination.hasPrevPage || paginationLoading}
                      >
                        {paginationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronLeft className="h-4 w-4" />}
                      </Button>
                      <span className="whitespace-nowrap px-2 py-1 text-xs sm:px-3 sm:text-sm">
                        {pagination.currentPage} of {pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.currentPage + 1)}
                        disabled={!pagination.hasNextPage || paginationLoading}
                      >
                        {paginationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </PageShell>
  );
};

export default MembersGroupReport;
