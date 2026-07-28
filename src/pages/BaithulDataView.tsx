import { Wallet, Download, Users, TrendingUp, AlertCircle, Calendar, Plus, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageSizeInput from "@/components/app/PageSizeInput";
import BottomNav from "@/components/BottomNav";
import BaithulEnrollDialog from "@/components/BaithulEnrollDialog";
import BaithulStatusDialog from "@/components/BaithulStatusDialog";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { baithulMaalAPI, districtsAPI } from "@/utils/api";
import { format } from "date-fns";

interface BaithulMember {
  _id: string;
  name: string;
  phone: string;
  baithulMaal: {
    monthlyAmount: number;
    totalPaid: number;
    lastPaymentDate?: string;
    startDate?: string;
  };
  district: {
    _id: string;
    name: string;
    code: string;
  };
  group: {
    _id: string;
    name: string;
    code: string;
  };
  joinedDate: string;
}

interface BaithulPayment {
  _id: string;
  member?: {
    _id: string;
    name: string;
    phone: string;
    group?: {
      name: string;
      code: string;
    };
    district?: {
      name: string;
      code: string;
    };
  };
  amount: number;
  paymentMonth: string;
  paymentDate: string;
  description?: string;
  recordedBy?: {
    name: string;
  };
}

interface BaithulStats {
  overallStatistics: {
    totalMembers: number;
    contributingMembers: number;
    totalMonthlyAmount: number;
    totalPaidAmount: number;
    averageMonthlyAmount: number;
  };
  groupStatistics: Array<{
    _id: string;
    groupName: string;
    groupCode: string;
    memberCount: number;
    totalMonthlyAmount: number;
    totalPaidAmount: number;
    averageAmount: number;
  }>;
}

interface District {
  _id: string;
  name: string;
  code: string;
}

const BaithulDataView = () => {
  const { toast } = useToast();
  
  // State
  const [loading, setLoading] = useState(true);
  const [baithulMembers, setBaithulMembers] = useState<BaithulMember[]>([]);
  const [baithulPayments, setBaithulPayments] = useState<BaithulPayment[]>([]);
  const [baithulStats, setBaithulStats] = useState<BaithulStats | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [monthlyReportData, setMonthlyReportData] = useState<any[]>([]);
  
  // Filters
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [statusMember, setStatusMember] = useState<BaithulMember | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [viewMode, setViewMode] = useState<"members" | "payments" | "groups" | "monthly">("members");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalPayments, setTotalPayments] = useState(0);
  const [totalGroups, setTotalGroups] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Fetch data
  const fetchBaithulData = async () => {
    try {
      setLoading(true);
      
      const params: Record<string, string> = {};
      if (selectedDistrict) params.district = selectedDistrict;
      
      // Add pagination params based on view mode
      const paginatedParams = {
        ...params,
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      };
      
      // Fetch based on view mode
      if (viewMode === "members") {
        const [membersResult, statsResult] = await Promise.all([
          baithulMaalAPI.getBaithulData(paginatedParams),
          baithulMaalAPI.getStats(params)
        ]);
        
        setBaithulMembers(Array.isArray(membersResult.data) ? membersResult.data.filter(m => m && m._id) : []);
        setTotalMembers(membersResult.pagination?.totalDocs || 0);
        setBaithulStats(statsResult.data || null);
      } else if (viewMode === "payments") {
        const [paymentsResult, statsResult] = await Promise.all([
          baithulMaalAPI.getPayments({ 
            ...paginatedParams, 
            ...(selectedMonth && { paymentMonth: selectedMonth })
          }),
          baithulMaalAPI.getStats(params)
        ]);
        
        setBaithulPayments(Array.isArray(paymentsResult.data) ? paymentsResult.data.filter(p => p && p._id) : []);
        setTotalPayments(paymentsResult.pagination?.totalDocs || 0);
        setBaithulStats(statsResult.data || null);
      } else if (viewMode === "groups") {
        const statsResult = await baithulMaalAPI.getStats(params);
        setBaithulStats(statsResult.data || null);
        
        // Groups are in stats, apply client-side pagination
        const allGroups = statsResult.data?.groupStatistics || [];
        setTotalGroups(allGroups.length);
        const startIdx = (currentPage - 1) * itemsPerPage;
        const paginatedGroups = allGroups.slice(startIdx, startIdx + itemsPerPage);
        setBaithulStats({
          ...statsResult.data,
          groupStatistics: paginatedGroups
        });
      } else if (viewMode === "monthly") {
        await fetchMonthlyReportData(params);
        const statsResult = await baithulMaalAPI.getStats(params);
        setBaithulStats(statsResult.data || null);
      }
      
    } catch (error) {
      console.error('Error fetching Baithul Maal data:', error);
      toast({
        title: "Error",
        description: "Failed to load Baithul Maal data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyReportData = async (params: Record<string, string>) => {
    try {
      // Fetch payments for selected month (or current month if none selected)
      const monthlyData = [];
      const now = new Date();
      const targetMonthStr = selectedMonth || format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM');
      const targetDate = new Date(targetMonthStr + '-01');

      const monthlyPayments = await baithulMaalAPI.getPayments({
        ...params,
        paymentMonth: targetMonthStr,
        limit: '100' // Get payments for the month (max allowed by API)
      });
      
      const monthData = {
        month: targetMonthStr,
        monthLabel: format(targetDate, 'MMMM yyyy'),
        totalAmount: monthlyPayments.statistics?.totalAmount || 0,
        totalPayments: monthlyPayments.statistics?.totalPayments || 0,
        avgAmount: monthlyPayments.statistics?.avgAmount || 0,
        payments: monthlyPayments.data || []
      };
      
      monthlyData.push(monthData);
      
      setMonthlyReportData(monthlyData);
    } catch (error) {
      console.error('Error fetching monthly report data:', error);
    }
  };

  const fetchDistricts = async () => {
    try {
      const result = await districtsAPI.getDistricts();
      setDistricts(result.data || []);
    } catch (error) {
      console.error('Error fetching districts:', error);
    }
  };

  useEffect(() => {
    fetchBaithulData();
  }, [selectedDistrict, selectedMonth, viewMode, currentPage, itemsPerPage]);
  
  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when filters change
  }, [selectedDistrict, selectedMonth, viewMode]);

  useEffect(() => {
    fetchDistricts();
  }, []);

  // Generate month options: 24 past months → current → 2 future months
  const getMonthOptions = () => {
    const months = [];
    const now = new Date();
    // Start from 24 months ago
    const startDate = new Date(now.getFullYear(), now.getMonth() - 24, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 1); // 2 future months

    const current = new Date(startDate);
    while (current <= endDate) {
      const monthStr = format(current, 'yyyy-MM');
      const monthLabel = format(current, 'MMMM yyyy');
      months.push({ value: monthStr, label: monthLabel });
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  };

  // ponytail: exports only the currently loaded page/view, not the full dataset — add a backend export endpoint if "export everything" is needed
  const handleExport = () => {
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    let rows: string[][];

    if (viewMode === "members") {
      rows = [
        ["Name", "Phone", "District", "Group", "Monthly Amount", "Total Paid", "Last Payment", "Joined Date"],
        ...baithulMembers.map((m) => [
          m.name, m.phone, m.district?.name ?? "", m.group?.name ?? "",
          String(m.baithulMaal.monthlyAmount), String(m.baithulMaal.totalPaid),
          m.baithulMaal.lastPaymentDate ?? "", m.joinedDate,
        ]),
      ];
    } else if (viewMode === "payments") {
      rows = [
        ["Member", "Phone", "Group", "District", "Amount", "Payment Month", "Payment Date", "Recorded By"],
        ...baithulPayments.map((p) => [
          p.member?.name ?? "", p.member?.phone ?? "", p.member?.group?.name ?? "", p.member?.district?.name ?? "",
          String(p.amount), p.paymentMonth, p.paymentDate, p.recordedBy?.name ?? "",
        ]),
      ];
    } else if (viewMode === "groups") {
      rows = [
        ["Group", "Code", "Members", "Monthly Total", "Paid Total", "Average"],
        ...(baithulStats?.groupStatistics ?? []).map((g) => [
          g.groupName, g.groupCode, String(g.memberCount),
          String(g.totalMonthlyAmount), String(g.totalPaidAmount), String(g.averageAmount),
        ]),
      ];
    } else {
      rows = [
        ["Month", "Total Amount", "Total Payments", "Average Amount"],
        ...monthlyReportData.map((m) => [m.monthLabel, String(m.totalAmount), String(m.totalPayments), String(m.avgAmount)]),
      ];
    }

    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `baithul-maal-${viewMode}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const contentTitleMap = {
    members: `Contributing Members (${totalMembers})`,
    payments: `Recent Payments (${totalPayments})`,
    groups: `Group Statistics (${totalGroups})`,
    monthly: "Monthly Report"
  } as const;

  const contentDescriptionMap = {
    members: "Member-level contribution totals and pending amounts.",
    payments: "Recorded payment history for the active filters.",
    groups: "Group-level contribution performance and averages.",
    monthly: "Month-by-month collection totals and trends."
  } as const;

  return (
    <PageShell contentClassName="pb-24">
      <PageHero
        title="Baithul Maal Data"
        eyebrow="Finance"
        icon={<Wallet className="h-6 w-6" />}
      />

        {/* Filters */}
        <SectionCard
          title="Filters & Views"
          description="Switch between member, payment, group, and monthly financial views."
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setShowEnrollDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            {/* View Mode Tabs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button
                variant={viewMode === "members" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("members")}
              >
                <Users className="h-4 w-4 mr-1" />
                Members
              </Button>
              <Button
                variant={viewMode === "payments" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("payments")}
              >
                <Wallet className="h-4 w-4 mr-1" />
                Payments
              </Button>
              <Button
                variant={viewMode === "groups" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("groups")}
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                Groups
              </Button>
              <Button
                variant={viewMode === "monthly" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("monthly")}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Monthly
              </Button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 gap-3">
              <Select value={selectedDistrict || "all"} onValueChange={(value) => setSelectedDistrict(value === "all" ? "" : value)}>
                <SelectTrigger className="h-9 px-2 text-xs gap-1 sm:h-11 sm:px-4 sm:text-sm">
                  <SelectValue placeholder="All Districts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {districts
                    .filter(district => district && district._id && district.name) // Filter out null/undefined districts
                    .map((district) => (
                    <SelectItem key={district._id} value={district._id}>
                      {district.name} ({district.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Month selector – visible for all view modes */}
              <Select value={selectedMonth || "all"} onValueChange={(value) => setSelectedMonth(value === "all" ? "" : value)}>
                <SelectTrigger className="h-9 px-2 text-xs gap-1 sm:h-11 sm:px-4 sm:text-sm">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {getMonthOptions().map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>

        {/* Summary Statistics */}
        {baithulStats && (
          <div className="grid grid-cols-4 gap-1.5 sm:gap-3 [&_.metric-icon]:hidden [&_.metric-card>div]:!p-2.5 [&_.metric-card_.text-\[13px\]]:!text-[11px] [&_.metric-card_.text-\[13px\]]:!leading-tight [&_.metric-card_.font-bold]:!text-base sm:[&_.metric-icon]:flex sm:[&_.metric-card>div]:!p-5 sm:[&_.metric-card_.font-bold]:!text-[1.7rem]">
            <MetricCard title="Contributing Members" value={String(baithulStats.overallStatistics.contributingMembers)} icon={Users} tone="primary" />
            <MetricCard title="Monthly Target" value={`₹${baithulStats.overallStatistics.totalMonthlyAmount.toLocaleString()}`} icon={TrendingUp} tone="success" />
            <MetricCard title="Total Collected" value={`₹${baithulStats.overallStatistics.totalPaidAmount.toLocaleString()}`} icon={Wallet} tone="warning" />
            <MetricCard title="Avg per Member" value={`₹${Math.round(baithulStats.overallStatistics.averageMonthlyAmount).toLocaleString()}`} icon={AlertCircle} tone="neutral" />
          </div>
        )}

        {/* Content based on view mode */}
        <SectionCard title={contentTitleMap[viewMode]} description={contentDescriptionMap[viewMode]}>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="surface-card border-border/70">
                <CardContent className="p-4">
                  <Skeleton className="mb-2 h-6 w-3/4" />
                  <Skeleton className="mb-2 h-4 w-1/2" />
                  <Skeleton className="h-8 w-1/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {viewMode === "members" && (
              <div className="space-y-4">
                {baithulMembers.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold text-lg mb-2">No Members Found</h3>
                      <p className="text-muted-foreground">No contributing members match your filters.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Member</TableHead>
                              <TableHead>Group/District</TableHead>
                              <TableHead className="text-right">Monthly</TableHead>
                              <TableHead className="text-right">Paid</TableHead>
                              <TableHead className="text-right">Pending</TableHead>
                              <TableHead>Last Payment</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-center">Edit</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {baithulMembers
                              .filter(member => member && member._id && member.name)
                              .map((member) => {
                                const contribStart = member.baithulMaal.startDate || member.joinedDate;
                                const monthsActive = contribStart ?
                                  Math.floor((Date.now() - new Date(contribStart).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;
                                const expectedTotal = monthsActive * member.baithulMaal.monthlyAmount;
                                const pendingAmount = Math.max(0, expectedTotal - member.baithulMaal.totalPaid);
                                
                                return (
                                  <TableRow key={member._id}>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium">{member.name}</p>
                                        <p className="text-xs text-muted-foreground">{member.phone}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="text-sm">
                                        <p>{member.group.name}</p>
                                        <p className="text-xs text-muted-foreground">{member.district.name}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-blue-600">
                                      ₹{member.baithulMaal.monthlyAmount}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-green-600">
                                      ₹{member.baithulMaal.totalPaid}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-orange-600">
                                      ₹{pendingAmount}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {member.baithulMaal.lastPaymentDate 
                                        ? format(new Date(member.baithulMaal.lastPaymentDate), 'MMM dd, yyyy')
                                        : '-'}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={pendingAmount > 0 ? "destructive" : "default"} className="text-xs">
                                        {pendingAmount > 0 ? "Pending" : "Up to Date"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        aria-label={`Change payment status for ${member.name}`}
                                        onClick={() => {
                                          setStatusMember(member);
                                          setShowStatusDialog(true);
                                        }}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex justify-end pt-2"><PageSizeInput value={itemsPerPage} onChange={(s) => { setItemsPerPage(s); setCurrentPage(1); }} /></div>
                    {totalMembers > itemsPerPage && (
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                            >
                              Previous
                            </Button>
                            <div className="text-sm text-muted-foreground">
                              Page {currentPage} of {Math.ceil(totalMembers / itemsPerPage)}
                              <span className="ml-2">
                                (Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalMembers)} of {totalMembers})
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalMembers / itemsPerPage), prev + 1))}
                              disabled={currentPage >= Math.ceil(totalMembers / itemsPerPage)}
                            >
                              Next
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>
            )}

            {viewMode === "payments" && (
              <div className="space-y-4">
                {baithulPayments.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold text-lg mb-2">No Payments Found</h3>
                      <p className="text-muted-foreground">No payments match your current filters.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Member</TableHead>
                              <TableHead>Group/District</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Payment Date</TableHead>
                              <TableHead>Month</TableHead>
                              <TableHead>Recorded By</TableHead>
                              <TableHead>Description</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {baithulPayments
                              .filter(payment => payment && payment._id)
                              .map((payment) => (
                                <TableRow key={payment._id}>
                                  <TableCell className="font-medium">
                                    {payment.member?.name || 'Unknown Member'}
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-sm">
                                      <p>{payment.member?.group?.name || 'Unknown Group'}</p>
                                      <p className="text-xs text-muted-foreground">{payment.member?.district?.name || 'Unknown District'}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-green-600">
                                    ₹{payment.amount.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {format(new Date(payment.paymentDate), 'MMM dd, yyyy')}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {format(new Date(payment.paymentMonth + '-01'), 'MMMM yyyy')}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {payment.recordedBy?.name || 'Unknown'}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                                    {payment.description || '-'}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex justify-end pt-2"><PageSizeInput value={itemsPerPage} onChange={(s) => { setItemsPerPage(s); setCurrentPage(1); }} /></div>
                    {totalPayments > itemsPerPage && (
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                            >
                              Previous
                            </Button>
                            <div className="text-sm text-muted-foreground">
                              Page {currentPage} of {Math.ceil(totalPayments / itemsPerPage)}
                              <span className="ml-2">
                                (Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalPayments)} of {totalPayments})
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalPayments / itemsPerPage), prev + 1))}
                              disabled={currentPage >= Math.ceil(totalPayments / itemsPerPage)}
                            >
                              Next
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>
            )}

            {viewMode === "groups" && baithulStats && (
              <div className="space-y-4">
                {baithulStats.groupStatistics.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold text-lg mb-2">No Group Data</h3>
                      <p className="text-muted-foreground">No group statistics available.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Group Name</TableHead>
                              <TableHead>Code</TableHead>
                              <TableHead className="text-center">Members</TableHead>
                              <TableHead className="text-right">Monthly Target</TableHead>
                              <TableHead className="text-right">Total Collected</TableHead>
                              <TableHead className="text-right">Avg per Member</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {baithulStats.groupStatistics
                              .filter(group => group && group._id && group.groupName)
                              .map((group) => (
                                <TableRow key={group._id}>
                                  <TableCell className="font-medium">{group.groupName}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{group.groupCode}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline">{group.memberCount}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-blue-600">
                                    ₹{group.totalMonthlyAmount.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-green-600">
                                    ₹{group.totalPaidAmount.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-purple-600">
                                    ₹{Math.round(group.averageAmount).toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex justify-end pt-2"><PageSizeInput value={itemsPerPage} onChange={(s) => { setItemsPerPage(s); setCurrentPage(1); }} /></div>
                    {totalGroups > itemsPerPage && (
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                            >
                              Previous
                            </Button>
                            <div className="text-sm text-muted-foreground">
                              Page {currentPage} of {Math.ceil(totalGroups / itemsPerPage)}
                              <span className="ml-2">
                                (Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalGroups)} of {totalGroups})
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalGroups / itemsPerPage), prev + 1))}
                              disabled={currentPage >= Math.ceil(totalGroups / itemsPerPage)}
                            >
                              Next
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>
            )}

            {viewMode === "monthly" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Monthly Report (Last 12 Months)</h2>
                </div>
                
                {monthlyReportData.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold text-lg mb-2">No Monthly Data</h3>
                      <p className="text-muted-foreground">No monthly report data available.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Monthly Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="flex items-center justify-center mb-2">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                          </div>
                          <p className="text-2xl font-bold text-green-600">
                            ₹{monthlyReportData.reduce((sum, month) => sum + month.totalAmount, 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">Total (12 Months)</p>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="flex items-center justify-center mb-2">
                            <Wallet className="h-5 w-5 text-blue-600" />
                          </div>
                          <p className="text-2xl font-bold text-blue-600">
                            {monthlyReportData.reduce((sum, month) => sum + month.totalPayments, 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">Total Payments</p>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="flex items-center justify-center mb-2">
                            <Calendar className="h-5 w-5 text-purple-600" />
                          </div>
                          <p className="text-2xl font-bold text-purple-600">
                            ₹{Math.round(monthlyReportData.reduce((sum, month) => sum + month.totalAmount, 0) / 12).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">Monthly Average</p>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="flex items-center justify-center mb-2">
                            <AlertCircle className="h-5 w-5 text-orange-600" />
                          </div>
                          <p className="text-2xl font-bold text-orange-600">
                            {monthlyReportData.filter(month => month.totalAmount > 0).length}
                          </p>
                          <p className="text-xs text-muted-foreground">Active Months</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Monthly Breakdown */}
                    <div className="space-y-3">
                      {monthlyReportData.map((monthData, index) => {
                        const prevMonth = monthlyReportData[index - 1];
                        const growth = prevMonth && prevMonth.totalAmount > 0 
                          ? ((monthData.totalAmount - prevMonth.totalAmount) / prevMonth.totalAmount * 100)
                          : 0;
                        
                        return (
                          <Card key={monthData.month} className={monthData.totalAmount === 0 ? "opacity-60" : ""}>
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h3 className="font-semibold text-lg">{monthData.monthLabel}</h3>
                                  <p className="text-sm text-muted-foreground">
                                    {monthData.totalPayments} payments recorded
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-green-600">
                                    ₹{monthData.totalAmount.toLocaleString()}
                                  </p>
                                  {index > 0 && prevMonth && (
                                    <p className={`text-xs ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {growth >= 0 ? '+' : ''}{growth.toFixed(1)}% from prev month
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              {monthData.totalAmount > 0 && (
                                <div className="grid grid-cols-3 gap-3 mt-3">
                                  <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                                    <p className="text-sm font-bold text-blue-600">
                                      ₹{monthData.totalAmount.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Total Collected</p>
                                  </div>
                                  <div className="text-center bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                                    <p className="text-sm font-bold text-green-600">
                                      {monthData.totalPayments}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Payments</p>
                                  </div>
                                  <div className="text-center bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
                                    <p className="text-sm font-bold text-purple-600">
                                      ₹{Math.round(monthData.avgAmount || 0).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Avg Payment</p>
                                  </div>
                                </div>
                              )}
                              
                              {monthData.totalAmount === 0 && (
                                <div className="text-center py-4 text-muted-foreground">
                                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                                  <p className="text-sm">No payments recorded this month</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
        </SectionCard>

      <BaithulEnrollDialog
        open={showEnrollDialog}
        onOpenChange={setShowEnrollDialog}
        onSaved={fetchBaithulData}
      />

      <BaithulStatusDialog
        open={showStatusDialog}
        onOpenChange={setShowStatusDialog}
        member={statusMember}
        onChanged={fetchBaithulData}
      />

      <BottomNav />
    </PageShell>
  );
};

export default BaithulDataView;
