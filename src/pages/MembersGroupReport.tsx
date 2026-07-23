import { Users, ArrowLeft, Download, TrendingUp, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import PageSizeInput from "@/components/app/PageSizeInput";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { reportsAPI, districtsAPI } from "@/utils/api";

interface GroupStats {
  _id: string;
  groupName: string;
  groupCode: string;
  totalMembers: number;
  activeMembers: number;
  inactiveMembers?: number;
  abroadMembers?: number;
  applicantMembers?: number;
  totalBaithulMaal: number;
}

interface StatusStats {
  _id: string;
  count: number;
  totalBaithulMaal: number;
}

interface ReportsData {
  statusStatistics: StatusStats[];
  groupStatistics: GroupStats[];
  ageDistribution: any[];
  registrationTrend: any[];
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalDocs: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface District {
  _id: string;
  name: string;
  code: string;
}

const MembersGroupReport = () => {
  const navigate = useNavigate();
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportsData, setReportsData] = useState<ReportsData | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [groups, setGroups] = useState<GroupStats[]>([]);
  const [allGroups, setAllGroups] = useState<GroupStats[]>([]);
  const [districtGroups, setDistrictGroups] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [paginationLoading, setPaginationLoading] = useState(false);

  // Fetch districts on mount
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const districtsResponse = await districtsAPI.getDistricts();
        if (districtsResponse.success) {
          setDistricts(districtsResponse.data || []);
        }
      } catch (err) {
        console.error('Error fetching districts:', err);
      }
    };
    fetchDistricts();
  }, []);

  // Fetch reports data when filters or pagination changes
  useEffect(() => {
    const fetchReportsData = async () => {
      try {
        // Use pagination loading for page changes only
        if (currentPage > 1 && !selectedDistrict && !selectedGroup) {
          setPaginationLoading(true);
        } else {
          setLoading(true);
        }
        setError(null);

        // Build query parameters
        const params: Record<string, any> = {
          page: currentPage,
          limit: pageSize
        };
        if (selectedDistrict) params.district = selectedDistrict;
        if (selectedGroup) params.group = selectedGroup;

        // Fetch reports data
        const reportsResponse = await reportsAPI.getMembers(params);
        if (reportsResponse.success) {
          setReportsData(reportsResponse.data);
          setGroups(reportsResponse.data.groupStatistics || []);
          if (reportsResponse.pagination) {
            setPagination(reportsResponse.pagination);
          }
        }

        // If district is selected, fetch groups for that district
        if (selectedDistrict && !selectedGroup) {
          try {
            const districtGroupsResponse = await districtsAPI.getDistrictGroups(selectedDistrict);
            if (districtGroupsResponse.success) {
              setDistrictGroups(districtGroupsResponse.data || []);
            }
          } catch (err) {
            console.error('Error fetching district groups:', err);
          }
        }
      } catch (err) {
        console.error('Error fetching reports data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch reports data');
      } finally {
        setLoading(false);
        setPaginationLoading(false);
      }
    };

    fetchReportsData();
  }, [selectedDistrict, selectedGroup, currentPage, pageSize]);

  // Reset group selection when district changes
  useEffect(() => {
    if (selectedDistrict) {
      setSelectedGroup("");
    }
  }, [selectedDistrict]);

  // Handle district selection change
  const handleDistrictChange = (districtId: string) => {
    setSelectedDistrict(districtId);
    setSelectedGroup(""); // Reset group selection
    setDistrictGroups([]); // Clear district groups
    setCurrentPage(1); // Reset to first page
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle page size change
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedDistrict("");
    setSelectedGroup("");
    setCurrentPage(1);
    setDistrictGroups([]);
  };

  // Calculate statistics from API data
  const getStatusCount = (status: string): number => {
    if (!reportsData?.statusStatistics) return 0;
    const stat = reportsData.statusStatistics.find(s => s._id === status);
    return stat?.count || 0;
  };

  const totalMembers = reportsData?.groupStatistics?.reduce((sum, group) => sum + group.totalMembers, 0) || 0;
  const totalActive = getStatusCount('Active');
  const totalInactive = getStatusCount('Inactive');
  const totalAbroad = getStatusCount('Abroad');
  const totalApplicant = getStatusCount('Applicant');

  // Filter groups based on selection
  const filteredGroups = groups.filter(group => {
    if (selectedGroup && group._id !== selectedGroup) return false;
    return true;
  });

  // Group by district for display
  const groupsByDistrict = filteredGroups.reduce((acc, group) => {
    // For now, we'll group all under "All Districts" since we don't have district info in group stats
    const districtName = selectedDistrict ? 
      districts.find(d => d._id === selectedDistrict)?.name || "Unknown District" : 
      "All Districts";
    
    if (!acc[districtName]) {
      acc[districtName] = [];
    }
    acc[districtName].push(group);
    return acc;
  }, {} as Record<string, GroupStats[]>);

  // Export functionality
  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedDistrict) params.append('district', selectedDistrict);
      if (selectedGroup) params.append('group', selectedGroup);
      // Don't add pagination params for export - we want all data

      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || 'https://solidarity-app-api-erv6h.ondigitalocean.app/api';
      
      const response = await fetch(`${apiUrl}/reports/export/members?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `group-reports-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  return (
    <PageShell contentClassName="pb-24">
      <PageHero
        title="Group Reports"
        subtitle="Analyze member totals, status distribution, and Baithul Maal coverage across groups."
        eyebrow="Reports"
        icon={<Users className="h-6 w-6" />}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/state-admin")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={loading}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        }
      />

        {/* Loading State */}
        {loading && (
          <SectionCard title="Preparing Report" description="Loading group statistics and active filter options.">
            <ListSkeleton rows={5} />
          </SectionCard>
        )}

        {/* Error State */}
        {error && (
          <SectionCard title="Report Error" description="The report could not be loaded with the current filters.">
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-center">
              <p className="text-destructive text-center">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          </SectionCard>
        )}

        {/* Filters */}
        {!loading && !error && (
          <SectionCard title="Report Filters" description="Limit the report to a district, group, or different page size.">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={selectedDistrict || "all"}
                  onValueChange={(val) => handleDistrictChange(val === "all" ? "" : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Districts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Districts</SelectItem>
                    {districts.map((district) => (
                      <SelectItem key={district._id} value={district._id}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedGroup || "all"}
                  onValueChange={(val) => setSelectedGroup(val === "all" ? "" : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Groups" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {selectedDistrict ? (
                      districtGroups.map((group) => (
                        <SelectItem key={group._id} value={group._id}>
                          {group.name} ({group.code})
                        </SelectItem>
                      ))
                    ) : (
                      groups.map((group) => (
                        <SelectItem key={group._id} value={group._id}>
                          {group.groupName} ({group.groupCode})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {(selectedDistrict || selectedGroup) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </SectionCard>
        )}

        {/* Summary Cards - Status Based Statistics */}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <MetricCard title="Total" value={String(totalMembers)} icon={Users} tone="primary" />
            <MetricCard title="Active" value={String(totalActive)} icon={TrendingUp} tone="success" />
            <MetricCard title="Inactive" value={String(totalInactive)} icon={Users} tone="neutral" />
            <MetricCard title="Abroad" value={String(totalAbroad)} icon={Users} tone="warning" />
            <MetricCard title="Applicant" value={String(totalApplicant)} icon={Users} tone="danger" />
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && !error && pagination && pagination.totalDocs > 0 && (
          <Card className="surface-card border-border/70">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to{" "}
                    {Math.min(pagination.currentPage * pagination.limit, pagination.totalDocs)} of{" "}
                    {pagination.totalDocs} groups
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
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
                    
                    <span className="px-3 py-1 text-sm">
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
            </CardContent>
          </Card>
        )}

        {/* District-wise Reports - Table View */}
        {!loading && !error && (
          <>
            {Object.entries(groupsByDistrict).map(([districtName, districtGroups]) => (
              <SectionCard key={districtName} title={districtName} description="Group-level totals and contribution data for the current selection.">
                <Card className="surface-card border-border/70">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Group Name</TableHead>
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
                        {districtGroups.map((group) => {
                          return (
                            <TableRow key={group._id}>
                              <TableCell className="font-medium">{group.groupName}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{group.groupCode}</TableCell>
                              <TableCell className="text-right font-semibold text-primary">
                                {group.totalMembers}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                {group.activeMembers || 0}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-gray-600">
                                {group.inactiveMembers || 0}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-blue-600">
                                {group.abroadMembers || 0}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-orange-600">
                                {group.applicantMembers || 0}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-purple-600">
                                ₹{group.totalBaithulMaal.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </SectionCard>
            ))}
            {Object.keys(groupsByDistrict).length === 0 && (
              <Card className="surface-card border-border/70">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No groups found matching the selected filters.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Bottom Pagination */}
        {!loading && !error && pagination && pagination.totalPages > 1 && (
          <Card className="surface-card border-border/70">
            <CardContent className="p-3">
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.currentPage === 1}
                >
                  First
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrevPage}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {/* Show page numbers */}
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.currentPage >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === pagination.currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  Last
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      <BottomNav />
    </PageShell>
  );
};

export default MembersGroupReport;
