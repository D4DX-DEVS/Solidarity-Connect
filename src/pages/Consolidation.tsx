import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Users, CheckCircle2, Clock, Download, Filter, CalendarDays, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHero, MetricCard, SectionCard } from '@/components/app/AppShell';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MonthPicker } from '@/components/ui/month-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useDistricts } from '@/hooks/useDistricts';
import { useGroups } from '@/hooks/useGroups';
import { consolidationService, type ConsolidationUserType, type ConsolidationTarget, type ConsolidationReport, type ConsolidationUser, type MonthlyBreakdown } from '@/services/consolidationService';
import BottomNav from '@/components/BottomNav';
import * as XLSX from 'xlsx';

const USER_TYPE_OPTIONS: { value: ConsolidationUserType; label: string }[] = [
  { value: 'state_admin', label: 'State Admin' },
  { value: 'district_admin', label: 'District Admin' },
  { value: 'area_admin', label: 'Area Admin' },
  { value: 'unit_admin', label: 'Unit Admin' },
  { value: 'members', label: 'Members' },
];

// User types that need region filtering
const NEEDS_DISTRICT_FILTER: ConsolidationUserType[] = ['district_admin', 'area_admin', 'unit_admin', 'members'];
const NEEDS_GROUP_FILTER: ConsolidationUserType[] = ['area_admin', 'unit_admin', 'members'];

export default function Consolidation() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Filter state
  const [selectedUserType, setSelectedUserType] = useState<ConsolidationUserType | ''>('');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [dateMode, setDateMode] = useState<'all' | 'custom'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Data state
  const [targets, setTargets] = useState<ConsolidationTarget[]>([]);
  const [report, setReport] = useState<ConsolidationReport | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  // Fetch districts and groups for region filters
  const { data: districtsData } = useDistricts();
  const { data: groupsData } = useGroups(
    selectedDistrictId && selectedDistrictId !== 'all'
      ? { district: selectedDistrictId }
      : undefined
  );

  const districts = districtsData?.data || [];
  const groups = groupsData?.data || [];

  // Load targets when user type changes
  useEffect(() => {
    if (!selectedUserType) {
      setTargets([]);
      setSelectedTargetId('');
      return;
    }

    const fetchTargets = async () => {
      setLoadingTargets(true);
      try {
        const res = await consolidationService.getTargets(selectedUserType);
        setTargets(res.data || []);
      } catch {
        toast({ title: 'Error', description: 'Failed to load targets', variant: 'destructive' });
        setTargets([]);
      } finally {
        setLoadingTargets(false);
      }
    };

    fetchTargets();
    setSelectedTargetId('');
    setReport(null);
  }, [selectedUserType]);

  // Reset dependent filters on user type change
  useEffect(() => {
    setSelectedDistrictId('all');
    setSelectedGroupId('all');
  }, [selectedUserType]);

  // Reset group when district changes
  useEffect(() => {
    setSelectedGroupId('all');
  }, [selectedDistrictId]);

  const handleGenerateReport = useCallback(async () => {
    if (!selectedUserType || !selectedTargetId) {
      toast({ title: 'Missing filters', description: 'Please select user type and target', variant: 'destructive' });
      return;
    }

    setLoadingReport(true);
    try {
      const res = await consolidationService.getReport({
        userType: selectedUserType,
        targetId: selectedTargetId,
        districtId: selectedDistrictId,
        groupId: selectedGroupId,
        dateFrom: dateMode === 'custom' ? dateFrom : undefined,
        dateTo: dateMode === 'custom' ? dateTo : undefined,
      });
      setReport(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to generate report', variant: 'destructive' });
      setReport(null);
    } finally {
      setLoadingReport(false);
    }
  }, [selectedUserType, selectedTargetId, selectedDistrictId, selectedGroupId, dateMode, dateFrom, dateTo]);

  const handleExportExcel = useCallback(() => {
    if (!report) return;

    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['Consolidation Report'],
      ['Target', report.target.title],
      ['Category', report.target.category],
      ['Type', report.target.isRecurring ? `Recurring (${report.target.recurringFrequency})` : 'Regular'],
      [],
      ['Summary'],
      ['Total Users', report.summary.totalUsers],
      ['Completed', report.summary.completed],
      ['Pending', report.summary.pending],
      ['Completion Rate', `${report.summary.completionRate}%`],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // Completed users sheet
    if (report.users.completed.length > 0) {
      const completedData = report.users.completed.map(u => ({
        Name: u.name,
        Phone: u.phone,
        District: u.district,
        Group: u.group,
        'Completed At': u.completedAt ? new Date(u.completedAt).toLocaleDateString() : 'N/A',
        ...(report.target.isRecurring ? { 'Completed Months': u.completedMonths?.join(', ') || '' } : {})
      }));
      const completedSheet = XLSX.utils.json_to_sheet(completedData);
      XLSX.utils.book_append_sheet(wb, completedSheet, 'Completed');
    }

    // Pending users sheet
    if (report.users.pending.length > 0) {
      const pendingData = report.users.pending.map(u => ({
        Name: u.name,
        Phone: u.phone,
        District: u.district,
        Group: u.group,
        Status: u.status || 'not_started',
        ...(report.target.isRecurring ? {
          'Completed Count': u.completedCount || 0,
          'Total Periods': u.totalPeriods || 0
        } : {})
      }));
      const pendingSheet = XLSX.utils.json_to_sheet(pendingData);
      XLSX.utils.book_append_sheet(wb, pendingSheet, 'Pending');
    }

    // Monthly breakdown sheet
    if (report.monthlyBreakdown.length > 0) {
      const monthlyData = report.monthlyBreakdown.map(m => ({
        Month: m.label,
        Total: m.total,
        Completed: m.completed,
        Pending: m.pending,
        'Completion Rate': `${m.completionRate}%`
      }));
      const monthlySheet = XLSX.utils.json_to_sheet(monthlyData);
      XLSX.utils.book_append_sheet(wb, monthlySheet, 'Monthly Breakdown');
    }

    XLSX.writeFile(wb, `consolidation-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: 'Exported', description: 'Report exported as Excel file' });
  }, [report]);

  const showDistrictFilter = selectedUserType && NEEDS_DISTRICT_FILTER.includes(selectedUserType);
  const showGroupFilter = selectedUserType && NEEDS_GROUP_FILTER.includes(selectedUserType);

  // For district_admin, they can't filter districts
  const isDistrictAdmin = user?.role === 'district_admin';
  const isGroupAdmin = user?.role === 'group_admin';

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHero
        title="Consolidation"
        subtitle="Track target completion across user types and regions"
        icon={<BarChart3 className="h-6 w-6" />}
        actions={
          report && (
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          )
        }
      />

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Filters Section */}
        <SectionCard title="Filters" description="Select user type, target, and date range to generate report">
          <div className="space-y-4">
            {/* Step 1: User Type */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">User Type</label>
              <ToggleGroup
                type="single"
                value={selectedUserType}
                onValueChange={(val) => {
                  if (val) setSelectedUserType(val as ConsolidationUserType);
                }}
                className="flex flex-wrap justify-start gap-1"
              >
                {USER_TYPE_OPTIONS.map(opt => (
                  <ToggleGroupItem
                    key={opt.value}
                    value={opt.value}
                    className="text-xs sm:text-sm px-3 py-1.5"
                  >
                    {opt.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {/* Step 2: Target Selection */}
            {selectedUserType && (
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Target</label>
                {loadingTargets ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={selectedTargetId} onValueChange={setSelectedTargetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a target..." />
                    </SelectTrigger>
                    <SelectContent>
                      {targets.map(t => (
                        <SelectItem key={t._id} value={t._id}>
                          <span className="flex items-center gap-2">
                            {t.title}
                            {t.isRecurring && (
                              <Badge variant="secondary" className="text-[10px]">
                                {t.recurringFrequency}
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                      {targets.length === 0 && (
                        <SelectItem value="_empty" disabled>
                          No targets found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Step 3: Region Filter (conditional) */}
            {showDistrictFilter && !isDistrictAdmin && !isGroupAdmin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">District</label>
                  <Select value={selectedDistrictId} onValueChange={setSelectedDistrictId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Districts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts</SelectItem>
                      {districts.map((d: any) => (
                        <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {showGroupFilter && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Group</label>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Groups" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Groups</SelectItem>
                        {groups.map((g: any) => (
                          <SelectItem key={g._id} value={g._id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Date Range */}
            {selectedTargetId && (
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  <CalendarDays className="h-4 w-4 inline mr-1" />
                  Date Range
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <ToggleGroup
                    type="single"
                    value={dateMode}
                    onValueChange={(val) => { if (val) setDateMode(val as 'all' | 'custom'); }}
                  >
                    <ToggleGroupItem value="all" className="text-xs sm:text-sm">All Time</ToggleGroupItem>
                    <ToggleGroupItem value="custom" className="text-xs sm:text-sm">Custom Range</ToggleGroupItem>
                  </ToggleGroup>

                  {dateMode === 'custom' && (
                    <div className="flex items-center gap-2">
                      <MonthPicker
                        value={dateFrom}
                        onChange={setDateFrom}
                        placeholder="From month"
                      />
                      <span className="text-muted-foreground text-sm">to</span>
                      <MonthPicker
                        value={dateTo}
                        onChange={setDateTo}
                        placeholder="To month"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Generate Button */}
            {selectedUserType && selectedTargetId && (
              <Button
                onClick={handleGenerateReport}
                disabled={loadingReport || (dateMode === 'custom' && (!dateFrom || !dateTo))}
                className="w-full sm:w-auto"
              >
                <Filter className="h-4 w-4 mr-2" />
                {loadingReport ? 'Generating...' : 'Generate Report'}
              </Button>
            )}
          </div>
        </SectionCard>

        {/* Loading State */}
        {loadingReport && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-64" />
          </div>
        )}

        {/* Results Section */}
        {report && !loadingReport && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricCard
                title="Total Users"
                value={String(report.summary.totalUsers)}
                icon={Users}
                tone="neutral"
              />
              <MetricCard
                title="Completed"
                value={String(report.summary.completed)}
                icon={CheckCircle2}
                tone="success"
              />
              <MetricCard
                title="Pending"
                value={String(report.summary.pending)}
                icon={Clock}
                tone="warning"
              />
              <MetricCard
                title="Completion Rate"
                value={`${report.summary.completionRate}%`}
                icon={BarChart3}
                tone={report.summary.completionRate >= 70 ? 'success' : report.summary.completionRate >= 40 ? 'warning' : 'danger'}
              />
            </div>

            {/* Monthly Breakdown (if available) */}
            {report.monthlyBreakdown.length > 0 && (
              <MonthlyBreakdownSection breakdown={report.monthlyBreakdown} isRecurring={report.target.isRecurring} />
            )}

            {/* Detailed User Lists */}
            <SectionCard title="Detailed View" description="View completed and pending users">
              <Tabs defaultValue="completed" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="completed">
                    Completed ({report.users.completed.length})
                  </TabsTrigger>
                  <TabsTrigger value="pending">
                    Pending ({report.users.pending.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="completed" className="mt-4">
                  <UserTable users={report.users.completed} type="completed" isRecurring={report.target.isRecurring} />
                </TabsContent>
                <TabsContent value="pending" className="mt-4">
                  <UserTable users={report.users.pending} type="pending" isRecurring={report.target.isRecurring} />
                </TabsContent>
              </Tabs>
            </SectionCard>
          </>
        )}

        {/* Empty state when no report generated yet */}
        {!report && !loadingReport && selectedUserType && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Select filters above and click "Generate Report" to view consolidation data
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

// Monthly Breakdown Component
function MonthlyBreakdownSection({ breakdown, isRecurring }: { breakdown: MonthlyBreakdown[]; isRecurring: boolean }) {
  return (
    <SectionCard title="Monthly Breakdown" description="Completion status per month">
      <Accordion type="multiple" className="space-y-2">
        {breakdown.map((month, idx) => (
          <AccordionItem key={`${month.year}-${month.month}`} value={`month-${idx}`} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center justify-between w-full mr-4">
                <span className="font-medium text-sm">{month.label}</span>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">
                    {month.completed}/{month.total}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{month.completionRate}%</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-2">
                <Progress value={month.completionRate} className="h-2" />
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-muted rounded p-2">
                    <div className="font-semibold">{month.total}</div>
                    <div className="text-muted-foreground">Total</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/30 rounded p-2">
                    <div className="font-semibold text-green-600">{month.completed}</div>
                    <div className="text-muted-foreground">Completed</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded p-2">
                    <div className="font-semibold text-amber-600">{month.pending}</div>
                    <div className="text-muted-foreground">Pending</div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </SectionCard>
  );
}

// User Table Component with expandable rows
function UserTable({ users, type, isRecurring }: { users: ConsolidationUser[]; type: 'completed' | 'pending'; isRecurring: boolean }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No {type} users found
      </div>
    );
  }

  const toggleRow = (userId: string) => {
    setExpandedRow(prev => prev === userId ? null : userId);
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Phone</TableHead>
            <TableHead className="hidden md:table-cell">District</TableHead>
            <TableHead className="hidden md:table-cell">Group</TableHead>
            {type === 'completed' && <TableHead>Completed</TableHead>}
            {type === 'pending' && <TableHead>Status</TableHead>}
            {isRecurring && type === 'pending' && <TableHead>Progress</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user, idx) => (
            <React.Fragment key={user.userId}>
              <TableRow
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => toggleRow(user.userId)}
              >
                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedRow === user.userId && "rotate-90")} />
                    {user.name}
                  </div>
                  <div className="sm:hidden text-xs text-muted-foreground ml-6">{user.phone}</div>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">{user.phone}</TableCell>
                <TableCell className="hidden md:table-cell">{user.district || '-'}</TableCell>
                <TableCell className="hidden md:table-cell">{user.group || '-'}</TableCell>
                {type === 'completed' && (
                  <TableCell>
                    {isRecurring ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {user.completedCount} of {user.totalPeriods}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {user.completedAt ? new Date(user.completedAt).toLocaleDateString() : '-'}
                      </span>
                    )}
                  </TableCell>
                )}
                {type === 'pending' && (
                  <TableCell>
                    <Badge
                      variant={user.status === 'partial' ? 'secondary' : 'outline'}
                      className="text-[10px]"
                    >
                      {user.status === 'partial' ? 'Partial' : user.status === 'in_progress' ? 'In Progress' : 'Not Started'}
                    </Badge>
                  </TableCell>
                )}
                {isRecurring && type === 'pending' && (
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {user.completedCount || 0}/{user.totalPeriods || 0}
                    </span>
                  </TableCell>
                )}
              </TableRow>

              {/* Expanded Detail Row */}
              {expandedRow === user.userId && (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={isRecurring && type === 'pending' ? 7 : 6} className="p-0">
                    <div className="px-6 py-4 space-y-3 animate-in slide-in-from-top-1 duration-200">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        <DetailItem label="Name" value={user.name} />
                        <DetailItem label="Phone" value={user.phone} />
                        <DetailItem label="Role" value={user.roleTag || user.role || '-'} />
                        <DetailItem label="District" value={user.district || '-'} />
                        <DetailItem label="Group" value={user.group || '-'} />
                        {type === 'completed' && !isRecurring && (
                          <DetailItem
                            label="Completed At"
                            value={user.completedAt ? new Date(user.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          />
                        )}
                        {type === 'pending' && (
                          <DetailItem
                            label="Status"
                            value={user.status === 'partial' ? 'Partial' : user.status === 'in_progress' ? 'In Progress' : 'Not Started'}
                          />
                        )}
                        {user.lastActivity && (
                          <DetailItem
                            label="Last Activity"
                            value={new Date(user.lastActivity).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          />
                        )}
                      </div>

                      {/* Recurring progress detail */}
                      {isRecurring && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Completion Progress</span>
                            <span className="text-xs font-semibold">
                              {user.completedCount || 0} completed out of {user.totalPeriods || 0} required
                            </span>
                          </div>
                          <Progress value={user.totalPeriods ? ((user.completedCount || 0) / user.totalPeriods) * 100 : 0} className="h-2" />
                          {user.completedMonths && user.completedMonths.length > 0 && (
                            <div className="mt-3">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">
                                Completed Months
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {user.completedMonths.map((m, i) => (
                                  <Badge key={`${m}-${i}`} variant="secondary" className="text-[10px] px-2 py-0.5">
                                    {formatMonthLabel(m)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Progress percentage for non-recurring */}
                      {!isRecurring && user.progressPercentage !== undefined && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Progress</span>
                            <span className="text-xs font-semibold">{user.progressPercentage}%</span>
                          </div>
                          <Progress value={user.progressPercentage} className="h-2" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMonthLabel(raw: string): string {
  // Handle formats: "2026-5", "2026-05", "May 2026"
  if (!raw) return raw;
  const parts = raw.split('-');
  if (parts.length === 2) {
    const year = parts[0];
    const month = parseInt(parts[1]) - 1;
    if (month >= 0 && month < 12) {
      return `${MONTH_NAMES[month]} ${year}`;
    }
  }
  return raw;
}
