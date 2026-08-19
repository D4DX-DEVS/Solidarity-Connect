import { Building2, Users, CheckCircle, XCircle, Upload, Menu, Shield, Star, ArrowRightLeft, RefreshCcw, Target, BarChart3, FolderOpen, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MetricCard, PageHero, PageShell } from "@/components/app/AppShell";
import { ListSkeleton } from "@/components/ui/loading-skeletons";import UserTargetsSection from "@/components/UserTargetsSection";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { apiCall } from "@/utils/api";

interface TransferRequest {
  _id: string;
  member: { _id: string; name: string; phone: string };
  currentDistrict: { _id: string; name: string };
  currentGroup: { _id: string; name: string };
  targetDistrict: { _id: string; name: string };
  targetGroup: { _id: string; name: string };
  requestedBy: { name: string; role: string };
  reason: string;
  status: string;
  sourceDistrictApproval: { status: string };
  targetDistrictApproval: { status: string };
  isCrossDistrict: boolean;
  createdAt: string;
}

interface DashboardStats {
  memberStatistics?: { totalMembers: number; activeMembers: number };
  groupStatistics?: { totalGroups: number } | null;
}

// Members & Meetings live in bottom nav — don't duplicate them in Quick Actions
const PRIMARY_TOOL_LABELS = ["Meeting Agenda", "Groups", "Files", "Group Reports", "Baithul Maal"];

const DistrictAdmin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAllActions, setShowAllActions] = useState(false);
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Dialog state
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRequest | null>(null);
  const [commentText, setCommentText] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // ponytail: cached queries so returning to the dashboard paints from cache
  const { data: stats = null, isPending: loadingStats } = useQuery({
    queryKey: ['district-admin', 'dashboard'],
    queryFn: async () => (await apiCall("/reports/dashboard")).data as DashboardStats,
  });

  // No ?status= param — backend auto-filters to requests pending this district's approval
  const { data: pendingTransfers = [], isPending: loadingTransfers } = useQuery({
    queryKey: ['district-admin', 'transfers'],
    queryFn: async () => ((await apiCall("/transfer-requests?sort=-createdAt&limit=20")).data || []) as TransferRequest[],
  });

  const fetchPendingTransfers = () =>
    queryClient.invalidateQueries({ queryKey: ['district-admin', 'transfers'] });

  const handleApprove = async () => {
    if (!selectedTransfer) return;
    try {
      setProcessingId(selectedTransfer._id);
      await apiCall(`/transfer-requests/${selectedTransfer._id}/approve`, {
        method: "POST",
        body: JSON.stringify({ comments: commentText })
      });
      toast({ title: "Approved", description: "Transfer forwarded to State Admin for final approval." });
      setApproveDialogOpen(false);
      setCommentText("");
      setSelectedTransfer(null);
      await fetchPendingTransfers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to approve transfer", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedTransfer || !rejectReason.trim()) {
      toast({ title: "Error", description: "Please provide a rejection reason", variant: "destructive" });
      return;
    }
    try {
      setProcessingId(selectedTransfer._id);
      await apiCall(`/transfer-requests/${selectedTransfer._id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason })
      });
      toast({ title: "Rejected", description: "Transfer request has been rejected.", variant: "destructive" });
      setRejectDialogOpen(false);
      setRejectReason("");
      setSelectedTransfer(null);
      await fetchPendingTransfers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reject transfer", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const totalGroups = stats?.groupStatistics?.totalGroups ?? "—";
  const totalMembers = stats?.memberStatistics?.totalMembers ?? "—";
  const activeMembers = stats?.memberStatistics?.activeMembers ?? "—";

  const districtTools = [
    { label: "Members", path: "/members", icon: Users, color: "text-cyan-600" },
    { label: "Meetings", path: "/admin/meetings-view", icon: Calendar, color: "text-amber-600" },
    { label: "Groups", path: "/state-admin/groups", icon: Building2, color: "text-sky-600" },
    { label: "Role Management", path: "/role-management", icon: Shield, color: "text-blue-500" },
    { label: "Leaders", path: "/leaders", icon: Star, color: "text-yellow-500" },
    { label: "Files", path: "/org-files", icon: FolderOpen, color: "text-teal-500" },
    { label: "Consolidation", path: "/consolidation", icon: BarChart3, color: "text-indigo-500" },
    { label: "Baithul Maal", path: "/state-admin/baithul-data", icon: BarChart3, color: "text-primary" },
    { label: "Group Reports", path: "/state-admin/group-reports", icon: BarChart3, color: "text-primary" },
  ];

  return (
    <PageShell contentClassName="pb-28">
      <PageHero
        title={`Welcome back, ${user?.name?.trim().split(' ')[0] || 'Admin'}`}
        showTitleOnMobile
        icon={<Building2 className="h-6 w-6" />}
        actions={
          <>
            <Badge className="rounded-full bg-primary/10 text-primary border-primary/20 px-3 py-1 text-sm font-semibold">
              {user?.district?.name || "District"}
            </Badge>
          {/* ponytail: bell + menu handled by PageHero/BottomNav — no per-page wiring */}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2">
        <MetricCard title="Groups" value={loadingStats ? "..." : String(totalGroups)} detail="In your district" icon={Building2} tone="primary" onClick={() => navigate("/state-admin/groups")} />
        <MetricCard title="Total Members" value={loadingStats ? "..." : String(totalMembers)} detail="Across all groups" icon={Users} tone="neutral" onClick={() => navigate("/members")} />
        <MetricCard title="Active Members" value={loadingStats ? "..." : String(activeMembers)} detail="Currently active" icon={CheckCircle} tone="success" onClick={() => navigate("/members")} />
        <MetricCard
          title="Pending Transfers"
          value={loadingTransfers ? "..." : String(pendingTransfers.length)}
          detail={pendingTransfers.length ? "Needs your review" : "All clear"}
          icon={ArrowRightLeft}
          tone={pendingTransfers.length ? "danger" : "warning"}
        />
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Menu className="h-5 w-5" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {districtTools.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => navigate(action.path)}
              className={`${showAllActions || PRIMARY_TOOL_LABELS.includes(action.label) ? "flex" : "hidden"} lg:flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 text-center shadow-sm transition-all hover:border-primary/40 hover:shadow-md sm:p-4`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <action.icon className={`h-5 w-5 ${action.color}`} />
              </div>
              <p className="text-xs font-medium leading-tight text-foreground">{action.label}</p>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowAllActions((v) => !v)}
            className="lg:hidden flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card p-3 text-center shadow-sm transition-all hover:border-primary/40 hover:shadow-md sm:p-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Menu className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs font-medium leading-tight text-foreground">{showAllActions ? "Less" : "More"}</p>
          </button>
        </div>
      </div>

      <UserTargetsSection />

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ArrowRightLeft className="h-5 w-5 text-orange-500" />
            Transfer Approvals
          </h2>
          <div className="flex items-center gap-2">
            {pendingTransfers.length > 0 && <Badge variant="destructive">{pendingTransfers.length}</Badge>}
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={fetchPendingTransfers}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loadingTransfers ? (
          <div className="pt-4"><ListSkeleton rows={2} /></div>
        ) : pendingTransfers.length === 0 ? (
          <div className="py-6 text-center">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-success" />
            <p className="text-sm text-muted-foreground">No pending transfers to approve</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTransfers.map((transfer) => (
              <Card key={transfer._id}>
                <CardContent className="p-4">
                  <p className="font-semibold text-sm">{transfer.member?.name}</p>
                  <p className="text-xs text-muted-foreground">{transfer.member?.phone}</p>
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{transfer.currentGroup?.name}</span>
                    <span>→</span>
                    <span>{transfer.targetGroup?.name}</span>
                    {transfer.currentDistrict?._id !== transfer.targetDistrict?._id && (
                      <Badge variant="outline" className="text-xs ml-1">Cross-District</Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="outline" className={`text-xs ${transfer.sourceDistrictApproval?.status === 'approved' ? 'border-success/30 bg-success/10 text-success' : 'border-warning/30 bg-warning/10 text-warning'}`}>
                      Source: {transfer.sourceDistrictApproval?.status === 'approved' ? '✓' : 'pending'}
                    </Badge>
                    {transfer.isCrossDistrict && (
                      <Badge variant="outline" className={`text-xs ${transfer.targetDistrictApproval?.status === 'approved' ? 'border-success/30 bg-success/10 text-success' : 'border-warning/30 bg-warning/10 text-warning'}`}>
                        Target: {transfer.targetDistrictApproval?.status === 'approved' ? '✓' : 'pending'}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-3 rounded-xl bg-muted/70 p-3 text-xs text-muted-foreground">{transfer.reason}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="h-9 flex-1 bg-success text-xs text-success-foreground hover:bg-success/90"
                      disabled={processingId === transfer._id}
                      onClick={() => { setSelectedTransfer(transfer); setApproveDialogOpen(true); }}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 flex-1 text-destructive text-xs"
                      disabled={processingId === transfer._id}
                      onClick={() => { setSelectedTransfer(transfer); setRejectDialogOpen(true); }}
                    >
                      <XCircle className="h-3 w-3 mr-1" />Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-md mx-auto p-6 rounded-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="bg-success/10 p-4 rounded-full mb-4 ring-8 ring-success/5">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight mb-1">Approve Transfer</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-6">
              Approve transfer for <strong className="text-foreground">{selectedTransfer?.member?.name}</strong>? Once both district admins approve, the request will be forwarded to State Admin for final approval.
            </p>
          </div>
          <div className="mb-6 space-y-2">
            <label className="text-sm font-semibold">Comments (Optional)</label>
            <Textarea className="resize-none rounded-xl border-input/50 focus:border-primary transition-colors bg-background/50" placeholder="Add comments..." value={commentText} onChange={e => setCommentText(e.target.value)} />
          </div>
          <DialogFooter className="gap-3 sm:gap-2">
            <Button variant="outline" className="rounded-xl w-full sm:w-auto h-12 font-medium border-border/50 hover:bg-card" onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
            <Button className="bg-success hover:bg-success/90 rounded-xl w-full sm:w-auto h-12 font-medium text-success-foreground shadow-lg shadow-success/20 active:scale-[0.98] transition-all" onClick={handleApprove} disabled={!!processingId}>
              {processingId ? "Processing..." : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md mx-auto p-6 rounded-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="bg-destructive/10 p-4 rounded-full mb-4 ring-8 ring-destructive/5">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight mb-1">Reject Transfer</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-6">
              Reject transfer for <strong className="text-foreground">{selectedTransfer?.member?.name}</strong>? This action cannot be undone.
            </p>
          </div>
          <div className="mb-6 space-y-2">
            <label className="text-sm font-semibold text-destructive">Rejection Reason *</label>
            <Textarea className="resize-none rounded-xl border-destructive/20 focus:border-destructive transition-colors bg-destructive/5" placeholder="Provide a detailed reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          </div>
          <DialogFooter className="gap-3 sm:gap-2">
            <Button variant="outline" className="rounded-xl w-full sm:w-auto h-12 font-medium border-border/50 hover:bg-card" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" className="rounded-xl w-full sm:w-auto h-12 font-medium shadow-lg shadow-destructive/20 active:scale-[0.98] transition-all" onClick={handleReject} disabled={!!processingId || !rejectReason.trim()}>
              {processingId ? "Processing..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default DistrictAdmin;
