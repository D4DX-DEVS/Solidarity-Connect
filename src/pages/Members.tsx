import { useState, useEffect } from "react";
import { Search, Users, Edit, ArrowRightLeft, Wallet, Clock, Plus, ChevronLeft, ChevronRight, Phone, Mail, MapPin, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard, SectionCard } from "@/components/app/AppShell";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import TransferMemberDialog from "@/components/TransferMemberDialog";
import BaithulMaalDialog from "@/components/BaithulMaalDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { membersAPI, districtsAPI, groupsAPI } from "@/utils/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Member {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  group: {
    _id: string;
    name: string;
    code: string;
  };
  district: {
    _id: string;
    name: string;
    code: string;
  };
  isApproved: boolean;
  createdAt: string;
  transferRequest?: {
    status: 'pending' | 'approved';
    targetDistrict: string;
    targetGroup: string;
  } | null;
}

interface District {
  _id: string;
  name: string;
  code: string;
}

interface Group {
  _id: string;
  name: string;
  code: string;
}

const Members = () => {
  const navigate = useNavigate();
  const { userRole, userDistrict, userGroup, user } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<Member[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    abroad: 0,
    applicant: 0,
    ageOver: 0,
    dismissed: 0,
    approved: 0,
    pending: 0
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showBaithul, setShowBaithul] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const itemsPerPage = 20;
  const [approvingMemberId, setApprovingMemberId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Debounced search state
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedDistrict, selectedGroup, selectedStatus]);

  // Fetch districts and groups ONCE on mount (not on every page change)
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        if (userRole === 'state_admin') {
          const districtsResult = await districtsAPI.getDistricts({ limit: 100 });
          setDistricts(districtsResult.data || []);
        }
        if (userRole === 'state_admin' || userRole === 'district_admin') {
          const groupParams: any = { limit: 100 };
          if (userRole === 'district_admin' && userDistrict) {
            groupParams.district = user?.district?._id;
          }
          const groupsResult = await groupsAPI.getGroups(groupParams);
          setGroups(groupsResult.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch filter data:', error);
      }
    };
    fetchFilters();
  }, [userRole, userDistrict]);

  // Fetch members and related data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (debouncedSearchQuery) params.append('search', debouncedSearchQuery);
        if (selectedDistrict) params.append('district', selectedDistrict);
        if (selectedGroup) params.append('group', selectedGroup);
        if (selectedStatus === 'pending_approval') {
          params.append('isApproved', 'false');
        } else if (selectedStatus) {
          params.append('status', selectedStatus);
        }
        params.append('page', currentPage.toString());
        params.append('limit', itemsPerPage.toString());
        params.append('sort', '-createdAt');
        // Skip heavy stats aggregation on page 2+; keep stats when filters change (page resets to 1)
        if (currentPage > 1) params.append('includeStats', 'false');

        // Fetch members only
        const membersResult = await membersAPI.getMembers(Object.fromEntries(params));

        if (membersResult) {
          setMembers(membersResult.data || []);
          if (membersResult.statistics) {
            setStatistics(membersResult.statistics);
          }

          // Update pagination state
          if (membersResult.pagination) {
            setTotalPages(membersResult.pagination.totalPages);
            setTotalDocs(membersResult.pagination.totalDocs);
            setHasNextPage(membersResult.pagination.hasNextPage);
            setHasPrevPage(membersResult.pagination.hasPrevPage);
          }
        }

      } catch (error) {
        console.error('Failed to fetch members:', error);
        toast({
          title: "Error",
          description: "Failed to load members",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [debouncedSearchQuery, selectedDistrict, selectedGroup, selectedStatus, currentPage, refreshKey, toast]);

  // Reset groups when district changes
  useEffect(() => {
    if (selectedDistrict && (userRole === 'state_admin' || userRole === 'district_admin')) {
      setSelectedGroup(""); // Clear group selection when district changes

      // Fetch groups for the selected district
      const fetchDistrictGroups = async () => {
        try {
          const groupsResult = await groupsAPI.getGroups({
            district: selectedDistrict,
            limit: 100
          });
          setGroups(groupsResult.data || []);
        } catch (error) {
          console.error('Failed to fetch district groups:', error);
        }
      };

      fetchDistrictGroups();
    }
  }, [selectedDistrict, userRole]);

  // Navigate to next page
  const goToNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // Navigate to previous page
  const goToPrevPage = () => {
    if (hasPrevPage) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleApproveAndActivate = async (member: Member) => {
    try {
      setApprovingMemberId(member._id);

      await membersAPI.approveMember(member._id);

      if (member.status !== 'Active') {
        await membersAPI.updateMember(member._id, { status: 'Active' });
      }

      toast({
        title: 'Success',
        description: `${member.name} approved and activated successfully`,
      });

      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to approve and activate member:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve and activate member',
        variant: 'destructive',
      });
    } finally {
      setApprovingMemberId(null);
    }
  };

  // Removed early loading return to prevent search focus loss

  const metricCards = [
    { title: "Total", value: String(statistics.total), icon: Users, tone: "primary" as const },
    { title: "Active", value: String(statistics.active), icon: ShieldCheck, tone: "success" as const },
    { title: "Applicant", value: String(statistics.applicant), icon: Clock, tone: "warning" as const },
    { title: "Inactive", value: String(statistics.inactive), icon: Users, tone: "neutral" as const },
    { title: "Abroad", value: String(statistics.abroad), icon: MapPin, tone: "neutral" as const },
    { title: "Dismissed", value: String(statistics.dismissed), icon: Users, tone: "danger" as const },
  ];

  return (
    <div className="app-page">
      <div className="app-page-orb app-page-orb-primary" aria-hidden />
      <div className="app-page-orb app-page-orb-secondary" aria-hidden />
      <HeaderWithLogout
        icon={<Users className="h-6 w-6 text-primary-foreground" />}
        title="Members"
      />

      <main className="app-main pt-4">
        <SectionCard title="Search & Filters" description="Find members by person, district, group, or status.">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {userRole === "state_admin" && (
                <Select value={selectedDistrict || "all"} onValueChange={(value) => setSelectedDistrict(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Districts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Districts</SelectItem>
                    {districts.map((district) => (
                      <SelectItem key={district._id} value={district._id}>
                        {district.name} ({district.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {(userRole === "state_admin" || userRole === "district_admin") && (
                <Select value={selectedGroup || "all"} onValueChange={(value) => setSelectedGroup(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Groups" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group._id} value={group._id}>
                        {group.name} ({group.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={selectedStatus || "all"} onValueChange={(value) => setSelectedStatus(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {userRole === 'state_admin' && (
                    <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  )}
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Abroad">Abroad</SelectItem>
                  <SelectItem value="Applicant">Applicant</SelectItem>
                  <SelectItem value="Age over">Age over</SelectItem>
                  <SelectItem value="Dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metricCards.map((item) => (
            <MetricCard key={item.title} title={item.title} value={item.value} icon={item.icon} tone={item.tone} />
          ))}
        </div>

        <div className="data-strip text-center text-sm text-muted-foreground">
          Showing {members.length} of {totalDocs} members
          {totalPages > 1 && (
            <span> • Page {currentPage} of {totalPages}</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading members...</p>
            </div>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No members found</p>
            {userRole !== 'group_admin' && (
              <Button
                onClick={() => navigate('/add-member')}
                className="mt-4"
              >
                Add First Member
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3 relative">
          {members.map((member) => (
            <Card key={member._id} className="surface-card cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-32px_hsl(var(--foreground)/0.32)]">
              <div
                className="p-4"
                onClick={() => navigate(`/member/${member._id}`)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">{member.name}</h3>
                  <div className="flex items-center gap-2">
                    {!member.isApproved && (
                      <Badge variant="outline" className="text-orange-600 border-orange-600">
                        Pending
                      </Badge>
                    )}
                    {!member.isApproved && userRole === 'state_admin' && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApproveAndActivate(member);
                        }}
                        disabled={approvingMemberId === member._id}
                      >
                        {approvingMemberId === member._id ? 'Processing...' : 'Approve & Activate'}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                  <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{member.email || "No email"}</span>
                  </div>
                  <a
                    href={`tel:${member.phone}`}
                    className="flex items-center gap-2 rounded-2xl bg-primary/5 px-3 py-2 text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="h-4 w-4" />
                    <span className="truncate">{member.phone}</span>
                  </a>
                  <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2">
                    <Users className="h-4 w-4" />
                    <span className="truncate">{member.group.name} ({member.group.code})</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">{member.district.name} ({member.district.code})</span>
                  </div>
                </div>

                <div className="mb-3 mt-3 flex flex-wrap items-center gap-2">
                  {member.status === "Active" ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                      <span>{member.status}</span>
                    </div>
                  ) : (
                    <Badge
                      variant="secondary"
                      className={
                        member.status === "Applicant"
                          ? "bg-orange-100 text-orange-800"
                          : member.status === "Abroad"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                      }
                    >
                      {member.status}
                    </Badge>
                  )}
                  {member.transferRequest && (
                    <Badge
                      variant="outline"
                      className={
                        member.transferRequest.status === 'pending'
                          ? "bg-yellow-100 text-yellow-800 border-yellow-300 flex items-center gap-1"
                          : "bg-green-100 text-green-800 border-green-300 flex items-center gap-1"
                      }
                    >
                      <Clock className="h-3 w-3" />
                      Transfer {member.transferRequest.status === 'pending' ? 'Pending' : 'Approved'}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-16 flex-col gap-1 py-3 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/member/${member._id}/edit`);
                    }}
                  >
                    <Edit className="h-5 w-5 text-primary" />
                    <span className="text-xs text-center leading-tight">Edit</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-16 flex-col gap-1 py-3 px-2"
                    disabled={!!member.transferRequest}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMember(member);
                      setShowTransfer(true);
                    }}
                  >
                    <ArrowRightLeft className={`h-5 w-5 ${member.transferRequest ? 'text-muted-foreground' : 'text-success'}`} />
                    <span className="text-xs text-center leading-tight">Transfer</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-16 flex-col gap-1 py-3 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMember(member);
                      setShowBaithul(true);
                    }}
                  >
                    <Wallet className="h-5 w-5 text-primary" />
                    <span className="text-xs text-center leading-tight">Baithul</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-16 flex-col gap-1 py-3 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/member/${member._id}`);
                    }}
                  >
                    <Users className="h-5 w-5 text-blue-600" />
                    <span className="text-xs text-center leading-tight">Details</span>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="data-strip flex justify-between items-center py-4 px-4">
            <Button
              onClick={goToPrevPage}
              disabled={!hasPrevPage}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>

            <Button
              onClick={goToNextPage}
              disabled={!hasNextPage}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>

      <TransferMemberDialog
        open={showTransfer}
        onOpenChange={setShowTransfer}
        member={selectedMember}
      />
      <BaithulMaalDialog
        open={showBaithul}
        onOpenChange={setShowBaithul}
        member={selectedMember}
      />

      {/* Floating Add Member Button */}
      {userRole !== 'group_admin' && (
        <Button
          onClick={() => navigate('/add-member')}
          className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 z-50"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      <BottomNav />
    </div>
  );
};

export default Members;
