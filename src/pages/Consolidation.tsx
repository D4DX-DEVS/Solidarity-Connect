import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart3, Users, CheckCircle2, Clock, Download, Filter, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHero, PageShell, SectionCard } from '@/components/app/AppShell';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
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
import { consolidationService, type ConsolidationUserType, type ConsolidationTarget, type ConsolidationReport, type ConsolidationUser, type MonthlyBreakdown } from '@/services/consolidationService';import * as XLSX from 'xlsx';

// Ordered state → district → area level → unit → members. Murabi and Coordinator are
// area-level admins with the same scope as Area Admin, listed separately so each kind
// can be consolidated on its own.
const USER_TYPE_OPTIONS: { value: ConsolidationUserType; label: string }[] = [
  { value: 'district_admin', label: 'District Admin' },
  { value: 'area_admin', label: 'Area Admin' },
  { value: 'murabi_admin', label: 'Murabi Admin' },
  { value: 'coordinator_admin', label: 'Coordinator Admin' },
  { value: 'unit_admin', label: 'Unit Admin' },
  { value: 'members', label: 'Members' },
];

const AREA_LEVEL_TYPES: ConsolidationUserType[] = ['area_admin', 'murabi_admin', 'coordinator_admin'];

// Hierarchy: each role only consolidates levels below itself (mirrors the API gate).
const userTypeOptionsForRole = (role?: string) => {
  if (role === 'state_admin') return USER_TYPE_OPTIONS;
  if (role === 'district_admin') {
    return USER_TYPE_OPTIONS.filter(o => o.value !== 'district_admin');
  }
  return USER_TYPE_OPTIONS.filter(o => o.value === 'unit_admin' || o.value === 'members');
};

// Area-level admins are scoped by their area name, everyone else by their group.
const scopeOf = (u: { area?: string; group?: string }) => u.area || u.group || '';

// User types that need region filtering
const NEEDS_DISTRICT_FILTER: ConsolidationUserType[] = ['district_admin', ...AREA_LEVEL_TYPES, 'unit_admin', 'members'];
const NEEDS_GROUP_FILTER: ConsolidationUserType[] = [...AREA_LEVEL_TYPES, 'unit_admin', 'members'];

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
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

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

  // Reset month selection when a new report is generated
  useEffect(() => {
    setSelectedMonthKey(null);
  }, [report]);

  // For recurring targets, filter detailed view by the selected month
  const detailedUsers = useMemo(() => {
    if (!report) return { completed: [], pending: [] };
    if (report.target.isRecurring && selectedMonthKey) {
      const allUsers = [...report.users.completed, ...report.users.pending];
      return {
        completed: allUsers.filter(u => u.completedMonths?.includes(selectedMonthKey)),
        pending: allUsers.filter(u => !u.completedMonths?.includes(selectedMonthKey)),
      };
    }
    return report.users;
  }, [report, selectedMonthKey]);

  const selectedMonthLabel = useMemo(() => {
    if (!selectedMonthKey || !report?.monthlyBreakdown) return null;
    return report.monthlyBreakdown.find(m => `${m.year}-${m.month}` === selectedMonthKey)?.label ?? null;
  }, [selectedMonthKey, report]);

  const handleExportExcel = useCallback(() => {
    if (!report) return;

    const wb = XLSX.utils.book_new();

    // Use month-filtered data if a month is selected, otherwise overall
    const exportCompleted = detailedUsers.completed;
    const exportPending = detailedUsers.pending;
    const isMonthFiltered = report.target.isRecurring && !!selectedMonthKey;
    const allUsers = [...exportCompleted, ...exportPending];
    const isRecurring = report.target.isRecurring;
    const months = report.monthlyBreakdown || [];

    // Helper to format month key to readable label
    const formatMonth = (mk: string) => {
      const [y, m] = mk.split('-');
      const date = new Date(Number(y), Number(m) - 1);
      return date.toLocaleString('default', { month: 'short', year: 'numeric' });
    };

    // --- District-wise grouping ---
    type DistrictEntry = {
      total: number; completed: number; pending: number;
      completedUsers: typeof allUsers; pendingUsers: typeof allUsers;
    };
    const districtMap = new Map<string, DistrictEntry>();
    allUsers.forEach(u => {
      const dist = u.district || 'Not Assigned';
      if (!districtMap.has(dist)) {
        districtMap.set(dist, { total: 0, completed: 0, pending: 0, completedUsers: [], pendingUsers: [] });
      }
      districtMap.get(dist)!.total++;
    });
    exportCompleted.forEach(u => {
      const dist = u.district || 'Not Assigned';
      const entry = districtMap.get(dist)!;
      entry.completed++;
      entry.completedUsers.push(u);
    });
    exportPending.forEach(u => {
      const dist = u.district || 'Not Assigned';
      const entry = districtMap.get(dist)!;
      entry.pending++;
      entry.pendingUsers.push(u);
    });

    const sortedDistricts = [...districtMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const hasRealDistricts = sortedDistricts.some(([dist]) => dist !== 'Not Assigned');

    // ========== SHEET 1: Summary ==========
    const summaryData: any[][] = [
      ['CONSOLIDATION REPORT'],
      [],
      ['Report Details'],
      ['Generated On', new Date().toLocaleString()],
      ['Target Name', report.target.title],
      ['Category', report.target.category],
      ['Type', isRecurring ? `Recurring (${report.target.recurringFrequency})` : 'One-time'],
      ['User Type', selectedUserType || 'All'],
      ...(isMonthFiltered ? [['Filtered Month', selectedMonthLabel || '']] : []),
      [],
      ['OVERALL SUMMARY'],
      ['Total Members', report.summary.totalUsers],
      ['Submitted (Completed)', exportCompleted.length],
      ['Not Yet Submitted', exportPending.length],
      ['Completion Rate', `${report.summary.totalUsers > 0 ? Math.round((exportCompleted.length / report.summary.totalUsers) * 1000) / 10 : 0}%`],
      [],
      [],
      ...(hasRealDistricts ? [
        ['DISTRICT-WISE SUMMARY'],
        ['District', 'Total Members', 'Submitted', 'Not Submitted', 'Completion Rate', 'Status'],
        ...sortedDistricts.filter(([dist]) => dist !== 'Not Assigned').map(([dist, data]) => {
          const rate = data.total > 0 ? Math.round((data.completed / data.total) * 1000) / 10 : 0;
          return [
            dist, data.total, data.completed, data.pending, `${rate}%`,
            data.pending === 0 ? '✅ All Submitted' : data.completed === 0 ? '❌ None Submitted' : '⚠️ Partial'
          ];
        }),
        [],
        [],
      ] : [
        ['NOTE: State Admins are state-level users and are not assigned to any specific district.'],
        ['To see district-wise data, select District Admin, Area Admin, Unit Admin, or Members.'],
        [],
        [],
      ]),
      ...(isRecurring ? [
        ['MONTHLY SUMMARY'],
        ['Month', 'Total', 'Submitted', 'Not Submitted', 'Completion Rate'],
        ...months.map(m => [m.label, m.total, m.completed, m.pending, `${m.completionRate}%`]),
      ] : []),
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 15 }, { wch: 16 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // ========== SHEET 2: All Members (Full Matrix) ==========
    if (isRecurring && months.length > 0) {
      // Create a matrix: each row is a user, columns are months with ✅/❌
      const monthKeys = months.map(m => `${m.year}-${m.month}`);
      const headerRow = ['S.No', 'Name', 'Phone', 'District', 'Group', 'Role', 'Overall Status',
        ...months.map(m => m.label), 'Total Submitted', 'Total Missed'];

      const dataRows = allUsers.map((u, idx) => {
        const userMonths = u.completedMonths || [];
        const submitted = monthKeys.filter(mk => userMonths.includes(mk)).length;
        const missed = monthKeys.length - submitted;
        const isOverallCompleted = exportCompleted.includes(u);
        return [
          idx + 1,
          u.name,
          u.phone,
          u.district || 'Not Assigned',
          scopeOf(u) || 'Not Assigned',
          u.roleTag || u.role || '-',
          isOverallCompleted ? 'Submitted' : 'Not Submitted',
          ...monthKeys.map(mk => userMonths.includes(mk) ? '✅ Yes' : '❌ No'),
          submitted,
          missed,
        ];
      });

      const allMembersSheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      allMembersSheet['!cols'] = [
        { wch: 5 }, { wch: 22 }, { wch: 13 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 15 },
        ...months.map(() => ({ wch: 14 })),
        { wch: 15 }, { wch: 13 }
      ];
      XLSX.utils.book_append_sheet(wb, allMembersSheet, 'All Members');
    } else {
      // Non-recurring: simple list
      const headerRow = ['S.No', 'Name', 'Phone', 'District', 'Group', 'Role', 'Status', 'Submitted At'];
      const dataRows = allUsers.map((u, idx) => {
        const isCompleted = exportCompleted.includes(u);
        return [
          idx + 1, u.name, u.phone, u.district || 'Not Assigned', scopeOf(u) || 'Not Assigned',
          u.roleTag || u.role || '-',
          isCompleted ? '✅ Submitted' : '❌ Not Submitted',
          isCompleted && u.completedAt ? new Date(u.completedAt).toLocaleDateString() : '-',
        ];
      });
      const allMembersSheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      allMembersSheet['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 13 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, allMembersSheet, 'All Members');
    }

    // ========== SHEET 3: District Wise Detailed ==========
    const distDetailData: any[][] = [
      ['DISTRICT-WISE DETAILED REPORT'],
      ['Shows which district submitted, who submitted, and who did not'],
      [],
    ];

    if (!hasRealDistricts) {
      distDetailData.push(
        ['NOTE: The selected user type (State Admin) is not assigned to districts.'],
        ['District-wise breakdown is available for: District Admin, Area Admin, Unit Admin, Members'],
        [],
        ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'],
        ['ALL MEMBERS (State Level):'],
        [`Total: ${allUsers.length}`, `Submitted: ${exportCompleted.length}`, `Not Submitted: ${exportPending.length}`],
        [],
      );
      if (exportCompleted.length > 0) {
        distDetailData.push(['  ✅ SUBMITTED MEMBERS:']);
        distDetailData.push(['', 'S.No', 'Name', 'Phone', ...(isRecurring ? ['Months Done'] : ['Submitted At'])]);
        exportCompleted.forEach((u, idx) => {
          distDetailData.push([
            '', idx + 1, u.name, u.phone,
            ...(isRecurring ? [`${u.completedCount || 0} of ${months.length}`] : [u.completedAt ? new Date(u.completedAt).toLocaleDateString() : '-']),
          ]);
        });
        distDetailData.push([]);
      }
      if (exportPending.length > 0) {
        distDetailData.push(['  ❌ NOT YET SUBMITTED:']);
        distDetailData.push(['', 'S.No', 'Name', 'Phone', ...(isRecurring ? ['Months Missed'] : ['Status'])]);
        exportPending.forEach((u, idx) => {
          if (isRecurring) {
            const userMonths = u.completedMonths || [];
            const monthKeys = months.map(m => `${m.year}-${m.month}`);
            const missed = monthKeys.filter(mk => !userMonths.includes(mk));
            distDetailData.push(['', idx + 1, u.name, u.phone, missed.map(formatMonth).join(', ') || 'All months']);
          } else {
            distDetailData.push(['', idx + 1, u.name, u.phone, 'Not Started']);
          }
        });
      }
    } else {
      sortedDistricts.forEach(([dist, data]) => {
        const rate = data.total > 0 ? Math.round((data.completed / data.total) * 1000) / 10 : 0;
        const status = data.pending === 0 ? '✅ ALL SUBMITTED' : data.completed === 0 ? '❌ NONE SUBMITTED' : '⚠️ PARTIALLY SUBMITTED';

        distDetailData.push(
          ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'],
          [`DISTRICT: ${dist}`, '', '', status],
          [`Members: ${data.total}`, `Submitted: ${data.completed}`, `Not Submitted: ${data.pending}`, `Rate: ${rate}%`],
          [],
        );

        // Submitted members in this district
        if (data.completedUsers.length > 0) {
          distDetailData.push(['  ✅ SUBMITTED MEMBERS:']);
          distDetailData.push(['', 'S.No', 'Name', 'Phone', 'Group', ...(isRecurring ? ['Months Done'] : ['Submitted At'])]);
          data.completedUsers.forEach((u, idx) => {
            distDetailData.push([
              '', idx + 1, u.name, u.phone, scopeOf(u) || '-',
              ...(isRecurring
                ? [`${u.completedCount || 0} of ${months.length}`]
                : [u.completedAt ? new Date(u.completedAt).toLocaleDateString() : '-']
              ),
            ]);
          });
          distDetailData.push([]);
        }

        // Not submitted members in this district
        if (data.pendingUsers.length > 0) {
          distDetailData.push(['  ❌ NOT YET SUBMITTED:']);
          distDetailData.push(['', 'S.No', 'Name', 'Phone', 'Group', ...(isRecurring ? ['Months Missed'] : ['Status'])]);
          data.pendingUsers.forEach((u, idx) => {
            if (isRecurring) {
              const userMonths = u.completedMonths || [];
              const monthKeys = months.map(m => `${m.year}-${m.month}`);
              const missed = monthKeys.filter(mk => !userMonths.includes(mk));
              const missedLabels = missed.map(formatMonth).join(', ');
              distDetailData.push(['', idx + 1, u.name, u.phone, scopeOf(u) || '-', missedLabels || 'All months']);
            } else {
              distDetailData.push(['', idx + 1, u.name, u.phone, scopeOf(u) || '-', 'Not Started']);
            }
          });
          distDetailData.push([]);
        }
        distDetailData.push([]);
      });
    }

    const distDetailSheet = XLSX.utils.aoa_to_sheet(distDetailData);
    distDetailSheet['!cols'] = [{ wch: 28 }, { wch: 6 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, distDetailSheet, 'District Details');

    // ========== SHEET 4: Monthly Detailed (for recurring) ==========
    if (isRecurring && months.length > 0) {
      const monthlyDetailData: any[][] = [
        ['MONTH-WISE DETAILED REPORT'],
        ['Shows who submitted and who did not submit for each month'],
        [],
      ];

      months.forEach(m => {
        const monthKey = `${m.year}-${m.month}`;
        const monthSubmitted = allUsers.filter(u => u.completedMonths?.includes(monthKey));
        const monthNotSubmitted = allUsers.filter(u => !u.completedMonths?.includes(monthKey));
        const status = monthNotSubmitted.length === 0 ? '✅ ALL DONE' : monthSubmitted.length === 0 ? '❌ NONE DONE' : '⚠️ PARTIAL';

        monthlyDetailData.push(
          ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'],
          [`MONTH: ${m.label}`, '', '', status],
          [`Total: ${allUsers.length}`, `Submitted: ${monthSubmitted.length}`, `Not Submitted: ${monthNotSubmitted.length}`, `Rate: ${allUsers.length > 0 ? Math.round((monthSubmitted.length / allUsers.length) * 1000) / 10 : 0}%`],
          [],
        );

        // Who submitted this month
        if (monthSubmitted.length > 0) {
          monthlyDetailData.push(['  ✅ SUBMITTED THIS MONTH:']);
          monthlyDetailData.push(['', 'S.No', 'Name', 'Phone', 'District', 'Group']);
          monthSubmitted.forEach((u, idx) => {
            monthlyDetailData.push(['', idx + 1, u.name, u.phone, u.district || '-', scopeOf(u) || '-']);
          });
        } else {
          monthlyDetailData.push(['  ✅ SUBMITTED THIS MONTH: Nobody']);
        }
        monthlyDetailData.push([]);

        // Who did NOT submit this month
        if (monthNotSubmitted.length > 0) {
          monthlyDetailData.push(['  ❌ NOT SUBMITTED THIS MONTH:']);
          monthlyDetailData.push(['', 'S.No', 'Name', 'Phone', 'District', 'Group']);
          monthNotSubmitted.forEach((u, idx) => {
            monthlyDetailData.push(['', idx + 1, u.name, u.phone, u.district || '-', scopeOf(u) || '-']);
          });
        } else {
          monthlyDetailData.push(['  ❌ NOT SUBMITTED: Everyone has submitted!']);
        }
        monthlyDetailData.push([], []);
      });

      const monthlySheet = XLSX.utils.aoa_to_sheet(monthlyDetailData);
      monthlySheet['!cols'] = [{ wch: 28 }, { wch: 6 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, monthlySheet, 'Monthly Details');
    }

    // ========== SHEET 5: Quick Status (easy to read) ==========
    const quickData: any[][] = [
      ['QUICK STATUS REPORT'],
      ['A simple overview of who completed and who needs follow-up'],
      [],
      ['✅ MEMBERS WHO SUBMITTED (Completed)'],
      ['S.No', 'Name', 'Phone', 'District', 'Group', ...(isRecurring ? ['Times Submitted'] : ['Date'])],
      ...exportCompleted.map((u, idx) => [
        idx + 1, u.name, u.phone, u.district || '-', scopeOf(u) || '-',
        ...(isRecurring ? [`${u.completedCount || 0}/${months.length}`] : [u.completedAt ? new Date(u.completedAt).toLocaleDateString() : '-']),
      ]),
      [],
      [],
      ['❌ MEMBERS WHO HAVE NOT SUBMITTED (Need Follow-up)'],
      ['S.No', 'Name', 'Phone', 'District', 'Group', ...(isRecurring ? ['Months Missed'] : ['Status'])],
      ...exportPending.map((u, idx) => {
        if (isRecurring) {
          const userMonths = u.completedMonths || [];
          const monthKeys = months.map(m => `${m.year}-${m.month}`);
          const missed = monthKeys.filter(mk => !userMonths.includes(mk));
          return [idx + 1, u.name, u.phone, u.district || '-', scopeOf(u) || '-', missed.map(formatMonth).join(', ') || 'All'];
        }
        return [idx + 1, u.name, u.phone, u.district || '-', scopeOf(u) || '-', 'Not Started'];
      }),
    ];
    const quickSheet = XLSX.utils.aoa_to_sheet(quickData);
    quickSheet['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, quickSheet, 'Quick Status');

    XLSX.writeFile(wb, `consolidation-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: 'Exported', description: 'Report exported as Excel file' });
  }, [report, detailedUsers, selectedMonthKey, selectedMonthLabel, selectedUserType]);

  const showDistrictFilter = selectedUserType && NEEDS_DISTRICT_FILTER.includes(selectedUserType);
  const showGroupFilter = selectedUserType && NEEDS_GROUP_FILTER.includes(selectedUserType);

  // For district_admin, they can't filter districts
  const isDistrictAdmin = user?.role === 'district_admin';
  const isGroupAdmin = user?.role === 'group_admin';

  return (
    <PageShell>
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
        {/* Filters Section — compact single-row layout */}
        <SectionCard title="Filters" description="Select user type, target, and date range to generate report">
          {/* All filters in one auto-flow grid — no labels, selects self-describe */}
          <div className="grid grid-cols-2 lg:grid-cols-12 gap-2">
            <div className="col-span-2 lg:col-span-2">
              <Select
                value={selectedUserType}
                onValueChange={(val) => { if (val) setSelectedUserType(val as ConsolidationUserType); }}
              >
                <SelectTrigger aria-label="User type">
                  <SelectValue placeholder="User type..." />
                </SelectTrigger>
                <SelectContent>
                  {userTypeOptionsForRole(user?.role).map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUserType && (
              <div className="col-span-2 lg:col-span-3">
                {loadingTargets ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={selectedTargetId} onValueChange={setSelectedTargetId}>
                    <SelectTrigger aria-label="Target">
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

            {selectedUserType && showDistrictFilter && !isDistrictAdmin && !isGroupAdmin && (
              <>
                <div className="col-span-1 lg:col-span-2">
                  <Select value={selectedDistrictId} onValueChange={setSelectedDistrictId}>
                    <SelectTrigger aria-label="District" className="h-9 px-2 text-xs gap-1 sm:h-11 sm:px-4 sm:text-sm">
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
                  <div className="col-span-1 lg:col-span-2">
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger aria-label="Group" className="h-9 px-2 text-xs gap-1 sm:h-11 sm:px-4 sm:text-sm">
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
              </>
            )}

            {selectedTargetId && (
              <div className="col-span-1 lg:col-span-2">
                <Select value={dateMode} onValueChange={(val) => { if (val) setDateMode(val as 'all' | 'custom'); }}>
                  <SelectTrigger aria-label="Date range" className="h-9 px-2 text-xs gap-1 sm:h-11 sm:px-4 sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedTargetId && dateMode === 'custom' && (
              <div className="col-span-2 lg:col-span-3 flex items-center gap-2">
                <MonthPicker value={dateFrom} onChange={setDateFrom} placeholder="From month" />
                <span className="text-muted-foreground text-sm">to</span>
                <MonthPicker value={dateTo} onChange={setDateTo} placeholder="To month" />
              </div>
            )}

            {selectedTargetId && (
              <Button
                onClick={handleGenerateReport}
                disabled={loadingReport || (dateMode === 'custom' && (!dateFrom || !dateTo))}
                className="col-span-1 lg:col-span-3 w-full"
              >
                <Filter className="h-4 w-4 mr-2" />
                {loadingReport ? 'Generating...' : 'Generate'}
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
            {/* Summary — single compact stat strip instead of 4 cards */}
            <Card>
              <CardContent className="p-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 divide-x-0 sm:divide-x divide-border [&>*:nth-child(odd)]:border-r sm:[&>*:nth-child(odd)]:border-r-0">
                  <StatCell icon={Users} label="Total Users" value={String(report.summary.totalUsers)} className="text-foreground" />
                  <StatCell icon={CheckCircle2} label="Completed" value={String(report.summary.completed)} className="text-green-600" />
                  <StatCell icon={Clock} label="Pending" value={String(report.summary.pending)} className="text-amber-600" />
                  <StatCell
                    icon={BarChart3}
                    label="Completion Rate"
                    value={`${report.summary.completionRate}%`}
                    className={report.summary.completionRate >= 70 ? 'text-green-600' : report.summary.completionRate >= 40 ? 'text-amber-600' : 'text-red-600'}
                    progress={report.summary.completionRate}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Monthly Breakdown (if available) */}
            {report.monthlyBreakdown.length > 0 && (
              <MonthlyBreakdownSection
                breakdown={report.monthlyBreakdown}
                isRecurring={report.target.isRecurring}
                onMonthSelect={setSelectedMonthKey}
              />
            )}

            {/* Detailed User Lists */}
            <SectionCard
              title="Detailed View"
              description={selectedMonthLabel ? `Showing completions for ${selectedMonthLabel}` : 'View completed and pending users'}
            >
              <Tabs defaultValue="completed" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="completed">
                    Completed ({detailedUsers.completed.length})
                  </TabsTrigger>
                  <TabsTrigger value="pending">
                    Pending ({detailedUsers.pending.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="completed" className="mt-4">
                  <UserTable users={detailedUsers.completed} type="completed" isRecurring={report.target.isRecurring} />
                </TabsContent>
                <TabsContent value="pending" className="mt-4">
                  <UserTable users={detailedUsers.pending} type="pending" isRecurring={report.target.isRecurring} />
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
      </div>    </PageShell>
  );
}

// Monthly Breakdown Component
function MonthlyBreakdownSection({
  breakdown,
  isRecurring,
  onMonthSelect,
}: {
  breakdown: MonthlyBreakdown[];
  isRecurring: boolean;
  onMonthSelect?: (key: string | null) => void;
}) {
  const handleValueChange = (value: string) => {
    if (!isRecurring || !onMonthSelect) return;
    if (value) {
      const idx = parseInt(value.replace('month-', ''), 10);
      const month = breakdown[idx];
      if (month) onMonthSelect(`${month.year}-${month.month}`);
    } else {
      onMonthSelect(null);
    }
  };

  return (
    <SectionCard title="Monthly Breakdown" description={isRecurring ? 'Click a month to filter the detailed view below' : 'Completion status per month'}>
      <Accordion type="single" collapsible className="divide-y divide-border" onValueChange={handleValueChange}>
        {breakdown.map((month, idx) => (
          <AccordionItem key={`${month.year}-${month.month}`} value={`month-${idx}`} className="border-b-0 px-1">
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
            <TableHead className="hidden md:table-cell">Group / Area</TableHead>
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
                <TableCell className="hidden md:table-cell">{scopeOf(user) || '-'}</TableCell>
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
                        <DetailItem label="Group / Area" value={scopeOf(user) || '-'} />
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

function StatCell({ icon: Icon, label, value, className, progress }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  className?: string;
  progress?: number;
}) {
  return (
    <div className="flex flex-col gap-1 p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] sm:text-xs font-medium truncate">{label}</span>
      </div>
      <div className={cn('text-xl sm:text-2xl font-bold leading-tight', className)}>{value}</div>
      {progress !== undefined && <Progress value={progress} className="h-1 mt-1" />}
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
