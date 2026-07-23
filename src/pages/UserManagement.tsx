import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Shield,
  Building2,
  ChevronLeft,
  ChevronRight,
  Star,
  StarOff,
  Tag,
  Phone,
  Mail,
  CalendarDays,
  Clock3,
  Briefcase,
  Cake,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { PageSkeleton } from "@/components/ui/loading-skeletons";
import { usersAPI, districtsAPI, groupsAPI, leadersAPI, membersAPI, authAPI } from "@/utils/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";

interface User {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'state_admin' | 'district_admin' | 'group_admin';
  district?: {
    _id: string;
    name: string;
    code: string;
  };
  group?: {
    _id: string;
    name: string;
    code: string;
  };
  isActive: boolean;
  isLeader?: boolean;
  roleTag?: { type?: string; name?: string };
  lastLogin?: string;
  createdAt: string;
}

interface Member {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  status: 'Active' | 'Inactive' | 'Abroad' | 'Applicant' | 'Age over' | 'Dismissed';
  district?: { _id: string; name: string; code: string };
  group?: { _id: string; name: string; code: string };
  isApproved: boolean;
  isLeader?: boolean;
  roleTag?: { type?: string; name?: string };
  profession?: string;
  age?: number;
  createdAt: string;
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
  district: {
    _id: string;
    name: string;
    code: string;
  } | string;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  stateAdmins: number;
  districtAdmins: number;
  groupAdmins: number;
}

const UserManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<User[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [filterGroups, setFilterGroups] = useState<Group[]>([]);
  const [loadingFilterGroups, setLoadingFilterGroups] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [leaderMember, setLeaderMember] = useState<Member | null>(null);
  const [leaderForm, setLeaderForm] = useState({ isLeader: false, roleTagType: "", roleTagName: "" });
  const [savingLeader, setSavingLeader] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    role: "",
    district: "",
    group: ""
  });
  const [existingRoles, setExistingRoles] = useState<string[]>([]);

  const roleLabels = {
    state_admin: "State Admin", 
    district_admin: "District Admin",
    group_admin: "Area Admin"
  };

  const roleColors = {
    state_admin: "bg-blue-100 text-blue-800",
    district_admin: "bg-green-100 text-green-800",
    group_admin: "bg-orange-100 text-orange-800"
  };

  const ROLE_TYPE_LABELS: Record<string, string> = {
    state: "State", district: "District", area: "Area",
    unit: "Unit", murabi: "Murabi", coordinator: "Coordinator",
  };
  const ROLE_TYPE_COLORS: Record<string, string> = {
    state: "bg-purple-100 text-purple-800",
    district: "bg-blue-100 text-blue-800",
    area: "bg-green-100 text-green-800",
    unit: "bg-orange-100 text-orange-800",
    murabi: "bg-teal-100 text-teal-800",
    coordinator: "bg-indigo-100 text-indigo-800",
  };
  const LEADER_ROLE_TYPES = ["state", "district", "area", "unit", "murabi", "coordinator"];

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, roleFilter, statusFilter, districtFilter, groupFilter]);

  // Fetch groups for the district filter selector
  const fetchFilterGroupsForDistrict = async (districtId: string) => {
    if (!districtId || districtId === 'all') { setFilterGroups([]); return; }
    setLoadingFilterGroups(true);
    try {
      const result = await groupsAPI.getGroups({ district: districtId, limit: 200, isActive: true });
      setFilterGroups(result.data || []);
    } catch { setFilterGroups([]); } finally { setLoadingFilterGroups(false); }
  };

  // Fetch districts + stats once on mount
  useEffect(() => {
    const init = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        const [statsResult, districtsResult] = await Promise.all([
          usersAPI.getUserStats(),
          districtsAPI.getDistricts({ limit: 100, isActive: true })
        ]);
        setUserStats(statsResult.data.statistics);
        setDistricts(districtsResult.data || []);
      } catch (err) {
        console.error('Error fetching init data:', err);
      }
    };
    init();
  }, []);

  const isMemberView = roleFilter === 'member';

  // Fetch users/members when page or filters change
  useEffect(() => {
    const fetchData = async () => {
      try {
        setSearching(true);
        const params: Record<string, any> = { page: currentPage, limit: 20 };
        if (debouncedSearch) params.search = debouncedSearch;

        if (isMemberView) {
          if (statusFilter !== 'all') params.status = statusFilter === 'active' ? 'Active' : 'Inactive';
          if (districtFilter !== 'all') params.district = districtFilter;
          if (groupFilter !== 'all') params.group = groupFilter;
          const result = await membersAPI.getMembers(params);
          setMembers(result.data || []);
          if (result.pagination) {
            setTotalPages(result.pagination.totalPages || 1);
            setTotalDocs(result.pagination.totalDocs || 0);
            setHasNextPage(result.pagination.hasNextPage || false);
            setHasPrevPage(result.pagination.hasPrevPage || false);
          }
        } else {
          if (roleFilter !== 'all') params.role = roleFilter;
          if (statusFilter === 'active') params.isActive = true;
          else if (statusFilter === 'inactive') params.isActive = false;
          if (districtFilter !== 'all') params.district = districtFilter;
          if (groupFilter !== 'all') params.group = groupFilter;
          const usersResult = await usersAPI.getUsers(params);
          setUsers(usersResult.data || []);
          if (usersResult.pagination) {
            setTotalPages(usersResult.pagination.totalPages || 1);
            setTotalDocs(usersResult.pagination.totalDocs || 0);
            setHasNextPage(usersResult.pagination.hasNextPage || false);
            setHasPrevPage(usersResult.pagination.hasPrevPage || false);
          }
          setGroups([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
      } finally {
        setSearching(false);
        setLoading(false);
      }
    };
    fetchData();
  }, [currentPage, debouncedSearch, roleFilter, statusFilter, districtFilter, groupFilter, isMemberView]);

  const fetchData = async () => {
    try {
      setSearching(true);
      const params: Record<string, any> = { page: currentPage, limit: 20 };
      if (debouncedSearch) params.search = debouncedSearch;

      if (isMemberView) {
        if (statusFilter !== 'all') params.status = statusFilter === 'active' ? 'Active' : 'Inactive';
        if (districtFilter !== 'all') params.district = districtFilter;
        if (groupFilter !== 'all') params.group = groupFilter;
        const result = await membersAPI.getMembers(params);
        setMembers(result.data || []);
        if (result.pagination) {
          setTotalPages(result.pagination.totalPages || 1);
          setTotalDocs(result.pagination.totalDocs || 0);
          setHasNextPage(result.pagination.hasNextPage || false);
          setHasPrevPage(result.pagination.hasPrevPage || false);
        }
      } else {
        if (roleFilter !== 'all') params.role = roleFilter;
        if (statusFilter === 'active') params.isActive = true;
        else if (statusFilter === 'inactive') params.isActive = false;
        if (districtFilter !== 'all') params.district = districtFilter;
        if (groupFilter !== 'all') params.group = groupFilter;
        const usersResult = await usersAPI.getUsers(params);
        setUsers(usersResult.data || []);
        if (usersResult.pagination) {
          setTotalPages(usersResult.pagination.totalPages || 1);
          setTotalDocs(usersResult.pagination.totalDocs || 0);
          setHasNextPage(usersResult.pagination.hasNextPage || false);
          setHasPrevPage(usersResult.pagination.hasPrevPage || false);
        }
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      const result = await usersAPI.createUser(formData);
      
      toast({
        title: "Success",
        description: "User created successfully",
      });
      setShowCreateDialog(false);
      setFormData({ name: "", phone: "", email: "", role: "", district: "", group: "" });
      setExistingRoles([]);
      fetchData();
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to create user",
        variant: "destructive",
      });
    }
  };

  const handlePhoneBlur = async () => {
    const phone = formData.phone.replace(/\D/g, '').replace(/^\+91/, '');
    if (phone.length === 10 && /^[6-9]/.test(phone)) {
      try {
        const result = await authAPI.checkRoles(phone);
        setExistingRoles(result.data?.roles || []);
      } catch {
        setExistingRoles([]);
      }
    } else {
      setExistingRoles([]);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const result = await usersAPI.updateUser(editingUser._id, formData);
      
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      setEditingUser(null);
      setFormData({ name: "", phone: "", email: "", role: "", district: "", group: "" });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user", 
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      const result = await usersAPI.toggleUserStatus(userId);
      
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const result = await usersAPI.deleteUser(userId);

      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const handleToggleLeader = async (user: User) => {
    const newIsLeader = !user.isLeader;
    try {
      await leadersAPI.updateLeader(user._id, {
        isLeader: newIsLeader,
        ...(newIsLeader && user.roleTag ? { roleTag: user.roleTag } : {}),
      });
      toast({
        title: "Success",
        description: newIsLeader ? "User marked as leader" : "Leader status removed",
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update leader status",
        variant: "destructive",
      });
    }
  };

  const openLeaderDialog = (member: Member) => {
    setLeaderMember(member);
    setLeaderForm({
      isLeader: member.isLeader || false,
      roleTagType: member.roleTag?.type || "",
      roleTagName: member.roleTag?.name || "",
    });
  };

  const handleSaveMemberLeader = async () => {
    if (!leaderMember) return;
    setSavingLeader(true);
    try {
      const payload: any = { isLeader: leaderForm.isLeader };
      if (leaderForm.isLeader && (leaderForm.roleTagType || leaderForm.roleTagName)) {
        payload.roleTag = {
          type: leaderForm.roleTagType || undefined,
          name: leaderForm.roleTagName || undefined,
        };
      }
      await membersAPI.updateMemberLeader(leaderMember._id, payload);
      toast({ title: "Saved", description: "Member leader status updated" });
      setLeaderMember(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" });
    } finally {
      setSavingLeader(false);
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      phone: user.phone,
      email: user.email || "",
      role: user.role,
      district: user.district?._id || "",
      group: user.group?._id || ""
    });
    
    // Load groups for the user's district if they have one
    if (user.district?._id) {
      fetchGroupsForDistrict(user.district._id);
    }
  };




  // Groups are already filtered by district when loaded, so use them directly
  const filteredGroups = groups;

  // Function to fetch groups for a specific district
  const fetchGroupsForDistrict = async (districtId: string) => {
    if (!districtId) {
      setGroups([]); // Clear groups when no district is selected
      return;
    }
    
    setLoadingGroups(true);
    try {
      const result = await groupsAPI.getGroups({ district: districtId, limit: 100, isActive: true });
      
      // Set groups to only the district-specific groups
      setGroups(result.data || []);
    } catch (error) {
      console.error('Error fetching district groups:', error);
      setGroups([]); // Clear groups on error
      toast({
        title: "Error",
        description: "Failed to load groups for selected district",
        variant: "destructive",
      });
    } finally {
      setLoadingGroups(false);
    }
  };

  const topStats = userStats ? [
    { title: "Total Users", value: String(userStats.totalUsers), icon: Users, tone: "primary" as const },
    { title: "Active", value: String(userStats.activeUsers), icon: UserCheck, tone: "success" as const },
    { title: "State Admins", value: String(userStats.stateAdmins), icon: Shield, tone: "neutral" as const },
    { title: "District Admins", value: String(userStats.districtAdmins), icon: Building2, tone: "warning" as const },
  ] : [];

  if (loading) {
    return (
      <PageSkeleton />
    );
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Access Control"
        title="User Management"
        subtitle="Manage admin users, filters, and leader assignments with a cleaner responsive control surface."
        icon={<Users className="h-6 w-6" />}
        actions={
          <Button onClick={() => navigate(-1)} variant="outline" size="sm">
            Back
          </Button>
        }
      />

      {userStats && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {topStats.map((item) => (
            <MetricCard key={item.title} title={item.title} value={item.value} icon={item.icon} tone={item.tone} />
          ))}
        </div>
      )}

      <SectionCard title="Search & Filters" description="Search by person and narrow by role, status, district, or group.">
            <div className="flex flex-col gap-3">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* First filter row: Role + Status */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="state_admin">State Admin</SelectItem>
                    <SelectItem value="district_admin">District Admin</SelectItem>
                    <SelectItem value="group_admin">Area Admin</SelectItem>
                    <SelectItem value="member">Members</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button className="sm:ml-auto">
                      <Plus className="mr-2 h-4 w-4" />
                      Add User
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </div>

              {/* Second filter row: District + Group */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={districtFilter}
                  onValueChange={(val) => {
                    setDistrictFilter(val);
                    setGroupFilter("all");
                    fetchFilterGroupsForDistrict(val);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-52">
                    <SelectValue placeholder="All Districts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Districts</SelectItem>
                    {districts.map((d) => (
                      <SelectItem key={d._id} value={d._id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {districtFilter !== "all" && (
                  <Select
                    value={groupFilter}
                    onValueChange={setGroupFilter}
                    disabled={loadingFilterGroups}
                  >
                    <SelectTrigger className="w-full sm:w-52">
                      <SelectValue placeholder={loadingFilterGroups ? "Loading…" : "All Groups"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Groups</SelectItem>
                      {filterGroups.map((g) => (
                        <SelectItem key={g._id} value={g._id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Active filter chips + clear button */}
                {(roleFilter !== "all" || statusFilter !== "all" || districtFilter !== "all" || groupFilter !== "all" || searchTerm) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="sm:ml-auto text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSearchTerm("");
                      setRoleFilter("all");
                      setStatusFilter("all");
                      setDistrictFilter("all");
                      setGroupFilter("all");
                      setFilterGroups([]);
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>

              {/* Active filter summary chips */}
              {(roleFilter !== "all" || statusFilter !== "all" || districtFilter !== "all" || groupFilter !== "all") && (
                <div className="flex flex-wrap gap-2">
                  {roleFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setRoleFilter("all")}>
                      {roleLabels[roleFilter as keyof typeof roleLabels] ?? roleFilter} ×
                    </Badge>
                  )}
                  {statusFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 cursor-pointer capitalize" onClick={() => setStatusFilter("all")}>
                      {statusFilter} ×
                    </Badge>
                  )}
                  {districtFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => { setDistrictFilter("all"); setGroupFilter("all"); setFilterGroups([]); }}>
                      {districts.find((d) => d._id === districtFilter)?.name ?? "District"} ×
                    </Badge>
                  )}
                  {groupFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setGroupFilter("all")}>
                      {filterGroups.find((g) => g._id === groupFilter)?.name ?? "Group"} ×
                    </Badge>
                  )}
                </div>
              )}
            </div>
      </SectionCard>

      <SectionCard
        title={isMemberView ? "Members" : "Users"}
        description={isMemberView ? "Member records surfaced through the same search and filter controls." : "Admin accounts and their current access status."}
      >
        {searching && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
          </div>
        )}
        {isMemberView && (
          <div className="space-y-3">
            {members.map((member) => {
              const statusColors: Record<string, string> = {
                Active: "bg-green-100 text-green-800",
                Inactive: "bg-gray-100 text-gray-700",
                Abroad: "bg-blue-100 text-blue-800",
                Applicant: "bg-yellow-100 text-yellow-800",
                "Age over": "bg-orange-100 text-orange-800",
                Dismissed: "bg-red-100 text-red-800",
              };
              return (
                <Card key={member._id} className="surface-card transition-transform hover:-translate-y-0.5">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-semibold">{member.name}</h3>
                          <Badge className={statusColors[member.status] || ""}>
                            {member.status}
                          </Badge>
                          {!member.isApproved && (
                            <Badge variant="outline" className="text-xs text-yellow-700 border-yellow-400">
                              Pending Approval
                            </Badge>
                          )}
                          {member.isLeader && member.roleTag?.type && (
                            <Badge className={`text-xs ${ROLE_TYPE_COLORS[member.roleTag.type] || "bg-yellow-100 text-yellow-800"}`}>
                              <Star className="h-3 w-3 mr-1" />
                              {ROLE_TYPE_LABELS[member.roleTag.type]}{member.roleTag.name ? ` · ${member.roleTag.name}` : ""}
                            </Badge>
                          )}
                        </div>
                        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                          <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2"><Phone className="h-4 w-4" />{member.phone}</div>
                          {member.email && <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2"><Mail className="h-4 w-4" />{member.email}</div>}
                          {member.district && <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2"><Building2 className="h-4 w-4" />{member.district.name}</div>}
                          {member.group && <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2"><Users className="h-4 w-4" />{member.group.name}</div>}
                          {member.profession && <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2"><Briefcase className="h-4 w-4" />{member.profession}</div>}
                          {member.age && <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2"><Cake className="h-4 w-4" />Age: {member.age}</div>}
                          <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2"><CalendarDays className="h-4 w-4" />Created: {new Date(member.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openLeaderDialog(member)}>
                            {member.isLeader ? (
                              <>
                                <StarOff className="h-4 w-4 mr-2" />
                                Manage Leader Role
                              </>
                            ) : (
                              <>
                                <Star className="h-4 w-4 mr-2" />
                                Make Leader
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {members.length === 0 && !searching && (
              <Card className="surface-card">
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No members found</h3>
                  <p className="text-muted-foreground">Try adjusting your search or filters</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Users List */}
        {!isMemberView && <div className="space-y-3">
          {users.map((user) => (
            <Card key={user._id} className="surface-card transition-transform hover:-translate-y-0.5">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold">{user.name}</h3>
                      <Badge className={roleColors[user.role]}>
                        {roleLabels[user.role]}
                      </Badge>
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {user.isLeader && (
                        <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300">
                          <Star className="h-3 w-3 mr-1" />
                          Leader{user.roleTag?.name ? ` · ${user.roleTag.name}` : ""}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                      <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2"><Phone className="h-4 w-4" />{user.phone}</div>
                      {user.email && <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2"><Mail className="h-4 w-4" />{user.email}</div>}
                      {user.district && <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2"><Building2 className="h-4 w-4" />{user.district.name}</div>}
                      {user.group && <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2"><Users className="h-4 w-4" />{user.group.name}</div>}
                      <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2"><CalendarDays className="h-4 w-4" />Created: {new Date(user.createdAt).toLocaleDateString()}</div>
                      {user.lastLogin && (
                        <div className="flex items-center gap-2 rounded-2xl bg-muted/65 px-3 py-2"><Clock3 className="h-4 w-4" />Last login: {new Date(user.lastLogin).toLocaleDateString()}</div>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(user)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit User
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleStatus(user._id)}>
                        {user.isActive ? (
                          <>
                            <UserX className="h-4 w-4 mr-2" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleLeader(user)}>
                        {user.isLeader ? (
                          <>
                            <StarOff className="h-4 w-4 mr-2" />
                            Remove Leader
                          </>
                        ) : (
                          <>
                            <Star className="h-4 w-4 mr-2" />
                            Make Leader
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDeleteUser(user._id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>}

        {!isMemberView && users.length === 0 && !searching && (
          <Card className="surface-card">
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No users found</h3>
              <p className="text-muted-foreground">
                {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                  ? "Try adjusting your search or filters"
                  : "Get started by creating your first user"
                }
              </p>
            </CardContent>
          </Card>
        )}
      </SectionCard>

        {totalPages > 1 && (
          <div className="data-strip flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} ({totalDocs} users)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={!hasPrevPage || searching}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={!hasNextPage || searching}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

      {/* Create/Edit User Dialog */}
      <Dialog open={showCreateDialog || !!editingUser} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingUser(null);
          setFormData({ name: "", phone: "", email: "", role: "", district: "", group: "" });
          setExistingRoles([]);
          setGroups([]); // Clear groups when dialog is closed
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Create New User"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                onBlur={handlePhoneBlur}
                placeholder="+91XXXXXXXXXX"
              />
              {existingRoles.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  This phone already has roles: {existingRoles.map(r => roleLabels[r as keyof typeof roleLabels] || r).join(', ')}. A new role will be added.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>

            <div>
              <Label htmlFor="role">Role *</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="state_admin">State Admin</SelectItem>
                  <SelectItem value="district_admin">District Admin</SelectItem>
                  <SelectItem value="group_admin">Area Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.role === 'district_admin' || formData.role === 'group_admin') && (
              <div>
                <Label htmlFor="district">District *</Label>
                <Select value={formData.district} onValueChange={(value) => {
                  setFormData({ ...formData, district: value, group: "" });
                  // Fetch groups for the selected district
                  if (value) {
                    fetchGroupsForDistrict(value);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((district) => (
                      <SelectItem key={district._id} value={district._id}>
                        {district.name} ({district.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.role === 'group_admin' && formData.district && (
              <div>
                <Label htmlFor="group">Group *</Label>
                <Select 
                  value={formData.group} 
                  onValueChange={(value) => setFormData({ ...formData, group: value })} 
                  disabled={loadingGroups || filteredGroups.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      loadingGroups 
                        ? "Loading groups..." 
                        : filteredGroups.length === 0 
                          ? "No groups available" 
                          : "Select group"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredGroups.map((group) => (
                      <SelectItem key={group._id} value={group._id}>
                        {group.name} ({group.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loadingGroups && (
                  <p className="text-sm text-muted-foreground mt-1">Loading groups for selected district...</p>
                )}
                {!loadingGroups && filteredGroups.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">No groups available in this district</p>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={editingUser ? handleUpdateUser : handleCreateUser}
                className="flex-1"
                disabled={!formData.name || !formData.phone || !formData.role}
              >
                {editingUser ? "Update User" : "Create User"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateDialog(false);
                  setEditingUser(null);
                  setFormData({ name: "", phone: "", email: "", role: "", district: "", group: "" });
                  setGroups([]); // Clear groups when canceling
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member Leader Dialog */}
      <Dialog open={!!leaderMember} onOpenChange={(open) => { if (!open) setLeaderMember(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {leaderMember?.isLeader ? "Manage Leader Role" : "Make Leader"} — {leaderMember?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                id="member-is-leader"
                checked={leaderForm.isLeader}
                onCheckedChange={(checked) =>
                  setLeaderForm({ isLeader: checked, roleTagType: checked ? leaderForm.roleTagType : "", roleTagName: checked ? leaderForm.roleTagName : "" })
                }
              />
              <Label htmlFor="member-is-leader" className="text-sm font-medium">Is Leader</Label>
            </div>

            {leaderForm.isLeader && (
              <div className="space-y-3 pl-1 border-l-2 border-primary/20 ml-1">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Select
                    value={leaderForm.roleTagType}
                    onValueChange={(val) => setLeaderForm((f) => ({ ...f, roleTagType: val }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Role type" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEADER_ROLE_TYPES.map((rt) => (
                        <SelectItem key={rt} value={rt}>
                          {ROLE_TYPE_LABELS[rt]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  placeholder="Role name (e.g. Secretary, President…)"
                  value={leaderForm.roleTagName}
                  onChange={(e) => setLeaderForm((f) => ({ ...f, roleTagName: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={handleSaveMemberLeader} disabled={savingLeader}>
                {savingLeader ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : null}
                Save
              </Button>
              <Button variant="outline" onClick={() => setLeaderMember(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </PageShell>
  );
};

export default UserManagement;