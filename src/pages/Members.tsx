import { useState, useEffect } from "react";
import { Search, Users, Edit, ArrowRightLeft, Wallet, Clock, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import TransferMemberDialog from "@/components/TransferMemberDialog";
import BaithulMaalDialog from "@/components/BaithulMaalDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { membersAPI, districtsAPI, groupsAPI } from "@/utils/api";

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
  const { userRole, userDistrict, userGroup } = useAuth();
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

  // Fetch members and related data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Build query parameters for filtering and pagination
        const params = new URLSearchParams();
        if (debouncedSearchQuery) params.append('search', debouncedSearchQuery);
        if (selectedDistrict) params.append('district', selectedDistrict);
        if (selectedGroup) params.append('group', selectedGroup);
        if (selectedStatus) params.append('status', selectedStatus);
        params.append('page', currentPage.toString());
        params.append('limit', itemsPerPage.toString());
        params.append('sort', '-createdAt'); // Sort by newest first
        
        // Fetch members
        const membersResult = await membersAPI.getMembers(Object.fromEntries(params));
        setMembers(membersResult.data || []);
        setStatistics(membersResult.statistics || statistics);
        
        // Update pagination state
        if (membersResult.pagination) {
          setTotalPages(membersResult.pagination.totalPages);
          setTotalDocs(membersResult.pagination.totalDocs);
          setHasNextPage(membersResult.pagination.hasNextPage);
          setHasPrevPage(membersResult.pagination.hasPrevPage);
        }
          toast({
            title: "Error",
            description: "Failed to fetch members",
            variant: "destructive"
          });
        }

        // Fetch districts (for state admin and district admin filters)
        if (userRole === 'state_admin') {
          const districtsResult = await districtsAPI.getDistricts({ limit: 100 });
          setDistricts(districtsResult.data.docs || []);
        }

        // Fetch groups (for filtering)
        if (userRole === 'state_admin' || userRole === 'district_admin') {
          const groupsResult = await groupsAPI.getGroups({ limit: 100 });
          setGroups(groupsResult.data || []);
        }

      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast({
          title: "Error",
          description: "Failed to load data",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [debouncedSearchQuery, selectedDistrict, selectedGroup, selectedStatus, currentPage, userRole, toast]);

  // Load more members function
  const loadMoreMembers = async () => {
    if (!hasNextPage || loadingMore) return;
    
    setLoadingMore(true);
    try {
      const token = localStorage.getItem('token');
      
      // Build query parameters for next page
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append('search', debouncedSearchQuery);
      if (selectedDistrict) params.append('district', selectedDistrict);
      if (selectedGroup) params.append('group', selectedGroup);
      if (selectedStatus) params.append('status', selectedStatus);
      params.append('page', (currentPage + 1).toString());
      params.append('limit', itemsPerPage.toString());
      params.append('sort', '-createdAt');
      
      const result = await membersAPI.getMembers(Object.fromEntries(params));
      setMembers(prev => [...prev, ...(result.data || [])]);
      setCurrentPage(prev => prev + 1);
      setHasNextPage(result.pagination?.hasNextPage || false);
    } catch (error) {
      console.error('Failed to load more members:', error);
      toast({
        title: "Error",
        description: "Failed to load more members",
        variant: "destructive"
      });
    } finally {
      setLoadingMore(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <HeaderWithLogout
          icon={<Users className="h-6 w-6 text-primary-foreground" />}
          title="Members"
        />
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading members...</p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeaderWithLogout
        icon={<Users className="h-6 w-6 text-primary-foreground" />}
        title="Members"
      />

      <div className="p-4 pb-0 bg-card border-b">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="space-y-2 mb-3">
          {userRole === "state_admin" && (
            <select 
              className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
            >
              <option value="">All Districts</option>
              {districts.map((district) => (
                <option key={district._id} value={district._id}>
                  {district.name} ({district.code})
                </option>
              ))}
            </select>
          )}
          
          <div className="grid grid-cols-2 gap-2">
            {(userRole === "state_admin" || userRole === "district_admin") ? (
              <select 
                className="px-3 py-2 border rounded-md text-sm bg-background"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                <option value="">All Groups</option>
                {groups.map((group) => (
                  <option key={group._id} value={group._id}>
                    {group.name} ({group.code})
                  </option>
                ))}
              </select>
            ) : (
              <div></div>
            )}
            <select 
              className="px-3 py-2 border rounded-md text-sm bg-background"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Abroad">Abroad</option>
              <option value="Applicant">Applicant</option>
              <option value="Age over">Age over</option>
              <option value="Dismissed">Dismissed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Status Count Cards */}
      <div className="p-4 pb-0">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Card className="shadow-sm">
            <div className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{statistics.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </Card>
          <Card className="shadow-sm">
            <div className="p-3 text-center">
              <p className="text-2xl font-bold text-success">{statistics.active}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </Card>
          <Card className="shadow-sm">
            <div className="p-3 text-center">
              <p className="text-2xl font-bold text-orange-500">{statistics.applicant}</p>
              <p className="text-xs text-muted-foreground">Applicant</p>
            </div>
          </Card>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-4">
          <Card className="shadow-sm">
            <div className="p-2 text-center">
              <p className="text-lg font-bold text-muted-foreground">{statistics.inactive}</p>
              <p className="text-xs text-muted-foreground">Inactive</p>
            </div>
          </Card>
          <Card className="shadow-sm">
            <div className="p-2 text-center">
              <p className="text-lg font-bold text-blue-500">{statistics.abroad}</p>
              <p className="text-xs text-muted-foreground">Abroad</p>
            </div>
          </Card>
          <Card className="shadow-sm">
            <div className="p-2 text-center">
              <p className="text-lg font-bold text-muted-foreground">{statistics.ageOver}</p>
              <p className="text-xs text-muted-foreground">Age over</p>
            </div>
          </Card>
          <Card className="shadow-sm">
            <div className="p-2 text-center">
              <p className="text-lg font-bold text-destructive">{statistics.dismissed}</p>
              <p className="text-xs text-muted-foreground">Dismissed</p>
            </div>
          </Card>
        </div>
        
        {/* Pagination Info */}
        <div className="text-center text-sm text-muted-foreground mb-4">
          Showing {members.length} of {totalDocs} members
          {totalPages > 1 && (
            <span> • Page {currentPage} of {totalPages}</span>
          )}
        </div>
      </div>

      <main className="p-4 space-y-3">
        {members.length === 0 ? (
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
          members.map((member) => (
            <Card key={member._id} className="shadow-sm cursor-pointer hover:shadow-md transition-shadow">
              <div 
                className="p-4"
                onClick={() => navigate(`/member/${member._id}`)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">{member.name}</h3>
                  {!member.isApproved && (
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      Pending
                    </Badge>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground mb-1">
                  {member.email || "No email"}
                </p>
                <a 
                  href={`tel:${member.phone}`} 
                  className="text-sm text-primary flex items-center gap-1 mb-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {member.phone}
                </a>
                
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant={member.status === "Active" ? "default" : "secondary"}
                    className={
                      member.status === "Active" 
                        ? "bg-success" 
                        : member.status === "Applicant"
                        ? "bg-orange-100 text-orange-800"
                        : member.status === "Abroad"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }
                  >
                    {member.status}
                  </Badge>
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
                
                <div className="text-sm text-muted-foreground mb-3">
                  <p>{member.group.name} ({member.group.code})</p>
                  <p>{member.district.name} ({member.district.code})</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex flex-col items-center gap-1 h-auto py-2 px-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/member/${member._id}/edit`);
                    }}
                  >
                    <Edit className="h-5 w-5 text-primary" />
                    <span className="text-xs text-center leading-tight">Edit Request</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex flex-col items-center gap-1 h-auto py-2 px-1"
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
                    variant="ghost"
                    size="sm"
                    className="flex flex-col items-center gap-1 h-auto py-2 px-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMember(member);
                      setShowBaithul(true);
                    }}
                  >
                    <Wallet className="h-5 w-5 text-primary" />
                    <span className="text-xs text-center leading-tight">Baithul Maal</span>
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
        
        {/* Load More Button */}
        {hasNextPage && (
          <div className="text-center py-4">
            <Button 
              onClick={loadMoreMembers}
              disabled={loadingMore}
              variant="outline"
              className="w-full max-w-xs"
            >
              {loadingMore ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                  Loading...
                </>
              ) : (
                `Load More (${totalDocs - members.length} remaining)`
              )}
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
