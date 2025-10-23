import { Users, ArrowLeft, Download, TrendingUp, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [viewMode, setViewMode] = useState<"detailed" | "cumulative">("detailed");
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

  // Fetch initial data (districts and reports)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch districts first
        const districtsResponse = await districtsAPI.getDistricts();
        console.log('Districts API response:', districtsResponse);
        if (districtsResponse.success) {
          setDistricts(districtsResponse.data || []);
        }

        // Fetch initial reports data with pagination
        const reportsParams = { page: currentPage, limit: pageSize };
        const reportsResponse = await reportsAPI.getMembers(reportsParams);
        if (reportsResponse.success) {
          setReportsData(reportsResponse.data);
          const groupStats = reportsResponse.data.groupStatistics || [];
          setGroups(groupStats);
          setAllGroups(groupStats);
          if (reportsResponse.pagination) {
            setPagination(reportsResponse.pagination);
          }
        }
      } catch (err) {
        console.error('Error fetching initial data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Fetch filtered data when filters change
  useEffect(() => {
    if (selectedDistrict || selectedGroup || currentPage > 1) {
      const fetchFilteredData = async () => {
        try {
          // Use pagination loading for page changes, full loading for filter changes
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

          // Fetch filtered reports data
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
          console.error('Error fetching filtered data:', err);
          setError(err instanceof Error ? err.message : 'Failed to fetch filtered data');
        } finally {
          setLoading(false);
          setPaginationLoading(false);
        }
      };

      fetchFilteredData();
    }
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

  // Cumulative stats
  const cumulativeStats = {
    totalMembers,
    totalActive,
    totalInactive,
    totalAbroad,
    totalApplicant,
    totalGroups: filteredGroups.length,
  };

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
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/state-admin")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="bg-primary p-2 rounded-lg">
            <Users className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Group Reports</h1>
            <p className="text-sm text-muted-foreground">Member Statistics</p>
          </div>
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleExport}
            disabled={loading}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Loading State */}
        {loading && (
          <Card className="shadow-sm">
            <CardContent className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading group reports...</p>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="shadow-sm border-destructive">
            <CardContent className="p-4">
              <p className="text-destructive text-center">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        {!loading && !error && (
          <Card className="shadow-sm">
            <CardContent className="p-3 space-y-2">
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "detailed" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setViewMode("detailed")}
                >
                  Detailed
                </Button>
                <Button
                  variant={viewMode === "cumulative" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setViewMode("cumulative")}
                >
                  Cumulative
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                  value={selectedDistrict}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                >
                  <option value="">All Districts</option>
                  {districts.map((district) => (
                    <option key={district._id} value={district._id}>
                      {district.name}
                    </option>
                  ))}
                </select>
                <select
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                >
                  <option value="">All Groups</option>
                  {selectedDistrict ? (
                    // Show groups from selected district
                    districtGroups.map((group) => (
                      <option key={group._id} value={group._id}>
                        {group.name} ({group.code})
                      </option>
                    ))
                  ) : (
                    // Show all groups from reports data
                    groups.map((group) => (
                      <option key={group._id} value={group._id}>
                        {group.groupName} ({group.groupCode})
                      </option>
                    ))
                  )}
                </select>
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
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-3">
            <Card className="shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Total Members</p>
                <p className="text-3xl font-bold text-primary">{totalMembers}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Active Members</p>
                <p className="text-3xl font-bold text-success">{totalActive}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && !error && pagination && viewMode === "detailed" && (
          <Card className="shadow-sm">
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
                  <select
                    className="px-2 py-1 border rounded text-sm bg-background"
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  >
                    <option value={5}>5 per page</option>
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                  
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

        {/* District-wise Reports */}
        {!loading && !error && viewMode === "detailed" ? (
          <>
            {Object.entries(groupsByDistrict).map(([districtName, districtGroups]) => (
              <div key={districtName}>
                <h2 className="font-semibold mb-3">{districtName}</h2>
                <div className="space-y-3">
                  {districtGroups.map((group) => {
                    // Calculate inactive, abroad, applicant from total - active
                    const inactiveCount = Math.max(0, group.totalMembers - group.activeMembers);
                    
                    return (
                      <Card key={group._id} className="shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-semibold text-lg">{group.groupName}</h3>
                              <p className="text-xs text-muted-foreground">Code: {group.groupCode}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <TrendingUp className="h-3 w-3 text-primary" />
                                <span className="text-xs text-primary font-medium">₹{group.totalBaithulMaal}/month</span>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-lg font-bold">
                              {group.totalMembers}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center">
                              <p className="text-lg font-bold text-success">{group.activeMembers}</p>
                              <p className="text-xs text-muted-foreground">Active</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-muted-foreground">{inactiveCount}</p>
                              <p className="text-xs text-muted-foreground">Others</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-primary">{group.totalMembers}</p>
                              <p className="text-xs text-muted-foreground">Total</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
            {Object.keys(groupsByDistrict).length === 0 && (
              <Card className="shadow-sm">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No groups found matching the selected filters.</p>
                </CardContent>
              </Card>
            )}
          </>
        ) : !loading && !error ? (
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <h2 className="font-semibold mb-4">Cumulative Statistics</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-primary/10 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{cumulativeStats.totalMembers}</p>
                    <p className="text-sm text-muted-foreground mt-1">Total Members</p>
                  </div>
                  <div className="bg-success/10 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-success">{cumulativeStats.totalActive}</p>
                    <p className="text-sm text-muted-foreground mt-1">Active Members</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-muted-foreground">{cumulativeStats.totalInactive}</p>
                    <p className="text-xs text-muted-foreground mt-1">Inactive</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-blue-500">{cumulativeStats.totalAbroad}</p>
                    <p className="text-xs text-muted-foreground mt-1">Abroad</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-orange-500">{cumulativeStats.totalApplicant}</p>
                    <p className="text-xs text-muted-foreground mt-1">Applicant</p>
                  </div>
                </div>
                <div className="bg-accent/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">{cumulativeStats.totalGroups}</p>
                  <p className="text-sm text-muted-foreground mt-1">Total Groups</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Bottom Pagination */}
        {!loading && !error && pagination && pagination.totalPages > 1 && (
          <Card className="shadow-sm">
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
      </main>

      <BottomNav />
    </div>
  );
};

export default MembersGroupReport;
