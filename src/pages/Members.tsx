import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, Users, Edit, ArrowRightLeft, Wallet, Clock, Plus, ChevronLeft, ChevronRight, Phone, Mail, MapPin, ShieldCheck, Download, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import PageSizeInput from "@/components/app/PageSizeInput";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [approvingMemberId, setApprovingMemberId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);

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

  // ponytail: cached queries — filters and list survive navigation away and back
  const { data: districts = [] } = useQuery({
    queryKey: ['members', 'districts'],
    queryFn: async () => ((await districtsAPI.getDistricts({ limit: 100 })).data || []) as District[],
    enabled: userRole === 'state_admin',
  });

  // Group list narrows to the selected district when one is picked
  const groupDistrictId = selectedDistrict || (userRole === 'district_admin' ? user?.district?._id : undefined);
  const { data: groups = [] } = useQuery({
    queryKey: ['members', 'groups', groupDistrictId ?? null],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: 100 };
      if (groupDistrictId) params.district = groupDistrictId;
      return ((await groupsAPI.getGroups(params)).data || []) as Group[];
    },
    enabled: userRole === 'state_admin' || userRole === 'district_admin',
  });

  // Clear the group filter whenever the district filter changes
  useEffect(() => {
    if (selectedDistrict && (userRole === 'state_admin' || userRole === 'district_admin')) {
      setSelectedGroup("");
    }
  }, [selectedDistrict, userRole]);

  // Shared with handleExport so the download always matches the on-screen filters
  const memberFilterParams = {
    ...(debouncedSearchQuery ? { search: debouncedSearchQuery } : {}),
    ...(selectedDistrict ? { district: selectedDistrict } : {}),
    ...(selectedGroup ? { group: selectedGroup } : {}),
    ...(selectedStatus === 'pending_approval'
      ? { isApproved: 'false' }
      : selectedStatus ? { status: selectedStatus } : {}),
  };

  const memberQueryParams = {
    ...memberFilterParams,
    page: currentPage.toString(),
    limit: itemsPerPage.toString(),
    sort: '-createdAt',
    // Skip heavy stats aggregation on page 2+; page resets to 1 when filters change
    ...(currentPage > 1 ? { includeStats: 'false' } : {}),
  };

  const { data: membersResult, isPending: loading, isError: membersError } = useQuery({
    queryKey: ['members', 'list', memberQueryParams, refreshKey],
    queryFn: () => membersAPI.getMembers(memberQueryParams),
    placeholderData: keepPreviousData,
  });

  const members: Member[] = membersResult?.data || [];

  useEffect(() => {
    if (membersError) {
      toast({ title: "Error", description: "Failed to load members", variant: "destructive" });
    }
  }, [membersError, toast]);

  // Stats only come back on page 1 — keep the last known set for later pages
  useEffect(() => {
    if (membersResult?.statistics) setStatistics(membersResult.statistics);
    const p = membersResult?.pagination;
    if (p) {
      setTotalPages(p.totalPages);
      setTotalDocs(p.totalDocs);
      setHasNextPage(p.hasNextPage);
      setHasPrevPage(p.hasPrevPage);
    }
  }, [membersResult]);

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

  const EXPORT_HEADERS = ['Name', 'Phone', 'Email', 'Status', 'District', 'Group', 'Approved', 'Joined'];
  const memberExportRow = (m: Member) => [
    m.name,
    m.phone,
    m.email || '',
    m.status,
    m.district ? `${m.district.name} (${m.district.code})` : '',
    m.group ? `${m.group.name} (${m.group.code})` : '',
    m.isApproved ? 'Yes' : 'No',
    m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '',
  ];

  // Fetches every member matching the current filters, not just the visible page.
  // Backend clamps `limit` to 100/request regardless of what we pass, so this
  // pages through in batches of 100 and concatenates the results.
  const fetchAllFilteredMembers = async (): Promise<Member[]> => {
    const all: Member[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const res = await membersAPI.getMembers({
        ...memberFilterParams,
        page: page.toString(),
        limit: '100',
        sort: '-createdAt',
        includeStats: 'false',
      });
      all.push(...((res.data || []) as Member[]));
      totalPages = res.pagination?.totalPages || 1;
      page += 1;
    } while (page <= totalPages);
    return all;
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (exporting) return;
    setExporting(true);
    try {
      const members = await fetchAllFilteredMembers();
      const rows = members.map(memberExportRow);
      const filename = `members-${new Date().toISOString().split('T')[0]}`;

      if (format === 'excel') {
        const sheet = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...rows]);
        sheet['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, 'Members');
        XLSX.writeFile(wb, `${filename}.xlsx`);
      } else {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text('Members', 14, 12);
        autoTable(doc, {
          head: [EXPORT_HEADERS],
          body: rows,
          startY: 18,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [39, 39, 42] },
        });
        doc.save(`${filename}.pdf`);
      }

      toast({ title: 'Exported', description: `${rows.length} member${rows.length === 1 ? '' : 's'} exported as ${format === 'excel' ? 'Excel' : 'PDF'} file` });
    } catch (error) {
      console.error('Failed to export members:', error);
      toast({ title: 'Error', description: 'Failed to export members', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  // Removed early loading return to prevent search focus loss

  const statChips = [
    { title: "All", value: statistics.total, status: "" },
    { title: "Active", value: statistics.active, status: "Active" },
    { title: "Applicant", value: statistics.applicant, status: "Applicant" },
    { title: "Inactive", value: statistics.inactive, status: "Inactive" },
    { title: "Abroad", value: statistics.abroad, status: "Abroad" },
    { title: "Dismissed", value: statistics.dismissed, status: "Dismissed" },
  ];

  return (
    <div className="app-page">
      <div className="app-page-orb app-page-orb-primary" aria-hidden />
      <div className="app-page-orb app-page-orb-secondary" aria-hidden />
      <HeaderWithLogout
        icon={<Users className="h-6 w-6 text-primary-foreground" />}
        title="Members"
      />

      <main className="app-main pt-4 pb-28 lg:pb-8">
        <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-flow-col auto-cols-fr gap-1.5 sm:gap-2">
              {userRole === "state_admin" && (
                <Select value={selectedDistrict || "all"} onValueChange={(value) => setSelectedDistrict(value === "all" ? "" : value)}>
                  <SelectTrigger className="h-9 px-2 text-xs gap-1 sm:h-11 sm:px-4 sm:text-sm">
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
                  <SelectTrigger className="h-9 px-2 text-xs gap-1 sm:h-11 sm:px-4 sm:text-sm">
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
                <SelectTrigger className="h-9 px-2 text-xs gap-1 sm:h-11 sm:px-4 sm:text-sm">
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

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {statChips.map((chip) => {
            const active = (selectedStatus || "") === chip.status;
            return (
              <button
                key={chip.title}
                onClick={() => { setSelectedStatus(chip.status); setCurrentPage(1); }}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {chip.title}
                <span className={`font-bold ${active ? "text-primary-foreground" : "text-foreground"}`}>{chip.value}</span>
              </button>
            );
          })}
        </div>

        <div className="data-strip flex items-center justify-between gap-2 text-xs text-muted-foreground sm:text-sm">
          <span className="min-w-0 truncate">
            Showing {members.length} of {totalDocs} members
            {totalPages > 1 && (
              <span> • Page {currentPage} of {totalPages}</span>
            )}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={exporting || totalDocs === 0}
                  aria-label="Download members"
                  title="Download members"
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('excel')}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>PDF (.pdf)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <PageSizeInput value={itemsPerPage} onChange={(s) => { setItemsPerPage(s); setCurrentPage(1); }} />
          </div>
        </div>

        {loading ? (
          <ListSkeleton rows={5} />
        ) : members.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No members found</p>
            <Button
              onClick={() => navigate('/add-member')}
              className="mt-4"
            >
              Add First Member
            </Button>
          </div>
        ) : (
          <div className="space-y-2 relative">
          {members.map((member) => (
            <Card key={member._id} className="surface-card cursor-pointer transition-shadow duration-200 md:hover:-translate-y-0.5 md:hover:shadow-sm md:transition-all md:duration-200">
              <div
                className="p-2 sm:p-3"
                onClick={() => navigate(`/member/${member._id}`)}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="truncate font-semibold text-sm sm:text-base">{member.name}</h3>
                    {member.status === "Active" ? (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
                        title="Active"
                        aria-label="Active"
                      />
                    ) : (
                      <Badge
                        variant="secondary"
                        className={`shrink-0 px-2 py-0 text-[11px] ${
                          member.status === "Applicant"
                            ? "bg-orange-100 text-orange-800"
                            : member.status === "Abroad"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {member.status}
                      </Badge>
                    )}
                    {member.transferRequest && (
                      <Badge
                        variant="outline"
                        className={`shrink-0 flex items-center gap-1 px-2 py-0 text-[11px] ${
                          member.transferRequest.status === 'pending'
                            ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                            : "bg-green-100 text-green-800 border-green-300"
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        Transfer {member.transferRequest.status === 'pending' ? 'Pending' : 'Approved'}
                      </Badge>
                    )}
                  </div>
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

                <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground sm:gap-2 xl:grid-cols-4">
                  <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-muted/65 px-2 py-1 sm:gap-2 sm:px-2.5 sm:py-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                    <span className="truncate">{member.email || "No email"}</span>
                  </div>
                  <a
                    href={`tel:${member.phone}`}
                    className="flex min-w-0 items-center gap-1.5 rounded-xl bg-primary/5 px-2 py-1 text-primary sm:gap-2 sm:px-2.5 sm:py-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                    <span className="truncate">{member.phone}</span>
                  </a>
                  <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-muted/65 px-2 py-1 sm:gap-2 sm:px-2.5 sm:py-1.5">
                    <Users className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                    <span className="truncate">{member.group.name} ({member.group.code})</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-muted/65 px-2 py-1 sm:gap-2 sm:px-2.5 sm:py-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                    <span className="truncate">{member.district.name} ({member.district.code})</span>
                  </div>
                </div>

                <div className="mt-1.5 grid grid-cols-4 gap-1.5 sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 px-1 sm:px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/member/${member._id}/edit`);
                    }}
                  >
                    <Edit className="h-4 w-4 text-primary" />
                    <span className="text-xs">Edit</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 px-1 sm:px-2"
                    // State + district admins move a member directly (no TransferRequest),
                    // so the button stays enabled even if a pending request exists.
                    // Group admins create a TransferRequest and are blocked while one is pending.
                    disabled={!!member.transferRequest && userRole === 'group_admin'}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMember(member);
                      setShowTransfer(true);
                    }}
                  >
                    <ArrowRightLeft className={`h-4 w-4 ${member.transferRequest && userRole === 'group_admin' ? 'text-muted-foreground' : 'text-success'}`} />
                    <span className="text-xs">
                      {userRole === 'state_admin' || userRole === 'district_admin' ? 'Move' : 'Transfer'}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 px-1 sm:px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMember(member);
                      setShowBaithul(true);
                    }}
                  >
                    <Wallet className="h-4 w-4 text-primary" />
                    <span className="text-xs">Baithul</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 px-1 sm:px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/member/${member._id}`);
                    }}
                  >
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-xs">Details</span>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-1">
            <Button onClick={goToPrevPage} disabled={!hasPrevPage} variant="outline" size="icon" className="h-8 w-8" aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-12 text-center text-sm text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button onClick={goToNextPage} disabled={!hasNextPage} variant="outline" size="icon" className="h-8 w-8" aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>

      <TransferMemberDialog
        open={showTransfer}
        onOpenChange={setShowTransfer}
        member={selectedMember}
        onTransferred={() => setRefreshKey((prev) => prev + 1)}
      />
      <BaithulMaalDialog
        open={showBaithul}
        onOpenChange={setShowBaithul}
        member={selectedMember}
      />

      {/* Floating Add Member Button */}
      <Button
        onClick={() => navigate('/add-member')}
        className="fixed bottom-28 right-4 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 z-50 lg:bottom-8"
        size="icon"
        aria-label="Add member"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default Members;
