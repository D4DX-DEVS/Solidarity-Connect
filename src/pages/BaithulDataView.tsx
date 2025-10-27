import { Wallet, ArrowLeft, Download, Users, TrendingUp, AlertCircle, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
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
  const [viewMode, setViewMode] = useState<"members" | "payments" | "groups" | "monthly">("members");

  // Fetch data
  const fetchBaithulData = async () => {
    try {
      setLoading(true);
      
      const params: Record<string, string> = {};
      if (selectedDistrict) params.district = selectedDistrict;
      
      const [membersResult, paymentsResult, statsResult] = await Promise.all([
        baithulMaalAPI.getBaithulData(params),
        baithulMaalAPI.getPayments({ 
          ...params, 
          ...(selectedMonth && { paymentMonth: selectedMonth }),
          limit: '50' 
        }),
        baithulMaalAPI.getStats(params)
      ]);
      
      // Safely set data with null checks
      setBaithulMembers(Array.isArray(membersResult.data) ? membersResult.data.filter(m => m && m._id) : []);
      setBaithulPayments(Array.isArray(paymentsResult.data) ? paymentsResult.data.filter(p => p && p._id) : []);
      setBaithulStats(statsResult.data || null);
      
      // Process monthly report data
      if (viewMode === "monthly") {
        await fetchMonthlyReportData(params);
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
      // Fetch payments for the last 12 months
      const monthlyData = [];
      // Use a fixed date to avoid future date issues - start from December 2024
      const now = new Date(2024, 11, 1); // December 2024
      
      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = format(date, 'yyyy-MM');
        
        const monthlyPayments = await baithulMaalAPI.getPayments({
          ...params,
          paymentMonth: monthStr,
          limit: '100' // Get payments for the month (max allowed by API)
        });
        
        const monthData = {
          month: monthStr,
          monthLabel: format(date, 'MMMM yyyy'),
          totalAmount: monthlyPayments.statistics?.totalAmount || 0,
          totalPayments: monthlyPayments.statistics?.totalPayments || 0,
          avgAmount: monthlyPayments.statistics?.avgAmount || 0,
          payments: monthlyPayments.data || []
        };
        
        monthlyData.push(monthData);
      }
      
      setMonthlyReportData(monthlyData.reverse()); // Show oldest to newest
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
  }, [selectedDistrict, selectedMonth, viewMode]);

  useEffect(() => {
    fetchDistricts();
  }, []);

  // Generate month options for the last 12 months
  const getMonthOptions = () => {
    const months = [];
    // Use a fixed date to avoid future date issues - start from December 2024
    const now = new Date(2024, 11, 1); // December 2024
    // Start from current month and go back 11 months (total 12 months)
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = format(date, 'yyyy-MM');
      const monthLabel = format(date, 'MMMM yyyy');
      months.push({ value: monthStr, label: monthLabel });
    }
    return months;
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
            <Wallet className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Baithul Maal Data</h1>
            <p className="text-sm text-muted-foreground">Financial Records</p>
          </div>
          <Button size="sm" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="p-4 space-y-3">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select value={selectedDistrict || "all"} onValueChange={(value) => setSelectedDistrict(value === "all" ? "" : value)}>
                <SelectTrigger>
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

              {viewMode === "payments" && (
                <Select value={selectedMonth || "all"} onValueChange={(value) => setSelectedMonth(value === "all" ? "" : value)}>
                  <SelectTrigger>
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
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Statistics */}
        {baithulStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {baithulStats.overallStatistics.contributingMembers}
                </p>
                <p className="text-xs text-muted-foreground">Contributing Members</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-600">
                  ₹{baithulStats.overallStatistics.totalMonthlyAmount.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Monthly Target</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Wallet className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-purple-600">
                  ₹{baithulStats.overallStatistics.totalPaidAmount.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total Collected</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                </div>
                <p className="text-2xl font-bold text-orange-600">
                  ₹{Math.round(baithulStats.overallStatistics.averageMonthlyAmount).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Avg per Member</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Content based on view mode */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-8 w-1/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {viewMode === "members" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Contributing Members ({baithulMembers.length})</h2>
                </div>
                {baithulMembers.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold text-lg mb-2">No Members Found</h3>
                      <p className="text-muted-foreground">No contributing members match your filters.</p>
                    </CardContent>
                  </Card>
                ) : (
                  baithulMembers
                    .filter(member => member && member._id && member.name) // Filter out null/undefined members
                    .map((member) => {
                    const monthsActive = member.joinedDate ? 
                      Math.floor((Date.now() - new Date(member.joinedDate).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;
                    const expectedTotal = monthsActive * member.baithulMaal.monthlyAmount;
                    const pendingAmount = Math.max(0, expectedTotal - member.baithulMaal.totalPaid);
                    
                    return (
                      <Card key={member._id}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-semibold">{member.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {member.group.name}, {member.district.name}
                              </p>
                              <p className="text-xs text-muted-foreground">{member.phone}</p>
                            </div>
                            <Badge variant={pendingAmount > 0 ? "destructive" : "default"}>
                              {pendingAmount > 0 ? "Pending" : "Up to Date"}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-3 mt-3">
                            <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                              <p className="text-lg font-bold text-blue-600">
                                ₹{member.baithulMaal.monthlyAmount}
                              </p>
                              <p className="text-xs text-muted-foreground">Monthly</p>
                            </div>
                            <div className="text-center bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                              <p className="text-lg font-bold text-green-600">
                                ₹{member.baithulMaal.totalPaid}
                              </p>
                              <p className="text-xs text-muted-foreground">Paid</p>
                            </div>
                            <div className="text-center bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
                              <p className="text-lg font-bold text-orange-600">
                                ₹{pendingAmount}
                              </p>
                              <p className="text-xs text-muted-foreground">Pending</p>
                            </div>
                          </div>
                          
                          {member.baithulMaal.lastPaymentDate && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Last payment: {format(new Date(member.baithulMaal.lastPaymentDate), 'MMM dd, yyyy')}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {viewMode === "payments" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Recent Payments ({baithulPayments.length})</h2>
                </div>
                {baithulPayments.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold text-lg mb-2">No Payments Found</h3>
                      <p className="text-muted-foreground">No payments match your current filters.</p>
                    </CardContent>
                  </Card>
                ) : (
                  baithulPayments
                    .filter(payment => payment && payment._id) // Filter out null/undefined payments
                    .map((payment) => (
                    <Card key={payment._id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold">{payment.member?.name || 'Unknown Member'}</h3>
                            <p className="text-sm text-muted-foreground">
                              {payment.member?.group?.name || 'Unknown Group'}, {payment.member?.district?.name || 'Unknown District'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Recorded by: {payment.recordedBy?.name || 'Unknown'}
                            </p>
                          </div>
                          <Badge variant="default">Paid</Badge>
                        </div>
                        
                        <div className="flex justify-between items-center mt-3">
                          <div>
                            <p className="text-2xl font-bold text-green-600">₹{payment.amount.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(payment.paymentDate), 'MMM dd, yyyy')} • {format(new Date(payment.paymentMonth + '-01'), 'MMMM yyyy')}
                            </p>
                          </div>
                        </div>
                        
                        {payment.description && (
                          <p className="text-xs text-muted-foreground mt-2 italic">{payment.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {viewMode === "groups" && baithulStats && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Group Statistics ({baithulStats.groupStatistics.length})</h2>
                </div>
                {baithulStats.groupStatistics.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold text-lg mb-2">No Group Data</h3>
                      <p className="text-muted-foreground">No group statistics available.</p>
                    </CardContent>
                  </Card>
                ) : (
                  baithulStats.groupStatistics
                    .filter(group => group && group._id && group.groupName) // Filter out null/undefined groups
                    .map((group) => (
                    <Card key={group._id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{group.groupName}</h3>
                            <p className="text-sm text-muted-foreground">Code: {group.groupCode}</p>
                          </div>
                          <Badge variant="outline">{group.memberCount} members</Badge>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                            <p className="text-lg font-bold text-blue-600">
                              ₹{group.totalMonthlyAmount.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">Monthly Target</p>
                          </div>
                          <div className="text-center bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                            <p className="text-lg font-bold text-green-600">
                              ₹{group.totalPaidAmount.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">Total Collected</p>
                          </div>
                          <div className="text-center bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                            <p className="text-lg font-bold text-purple-600">
                              ₹{Math.round(group.averageAmount).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">Avg per Member</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
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
      </main>

      <BottomNav />
    </div>
  );
};

export default BaithulDataView;
