import { Building2, FileCheck, Users, CheckCircle, XCircle, Upload, Bell, Menu, Shield, Star, ArrowRightLeft, RefreshCcw, Target, BarChart3, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import BottomNav from "@/components/BottomNav";
import UserTargetsSection from "@/components/UserTargetsSection";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
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

const DistrictAdmin = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingTransfers, setPendingTransfers] = useState<TransferRequest[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingTransfers, setLoadingTransfers] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Dialog state
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRequest | null>(null);
  const [commentText, setCommentText] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    fetchStats();
    fetchPendingTransfers();
  }, []);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const result = await apiCall("/reports/dashboard");
      setStats(result.data);
    } catch (err) {
      console.error("Failed to fetch district stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchPendingTransfers = async () => {
    try {
      setLoadingTransfers(true);
      // No ?status= param — backend auto-filters to show only requests pending this district's approval
      const result = await apiCall("/transfer-requests?sort=-createdAt&limit=20");
      setPendingTransfers(result.data || []);
    } catch (err) {
      console.error("Failed to fetch transfers:", err);
    } finally {
      setLoadingTransfers(false);
    }
  };

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
    { label: "Members", path: "/members", Icon: Users },
    { label: "Meetings", path: "/meetings", Icon: FileCheck },
    { label: "Meeting Agenda", path: "/state-admin/meeting-agenda", Icon: FileCheck },
    { label: "Groups", path: "/state-admin/groups", Icon: Users },
    { label: "Role Management", path: "/role-management", Icon: Shield },
    { label: "Leaders", path: "/leaders", Icon: Star },
    { label: "Consolidation", path: "/consolidation", Icon: BarChart3 },
    { label: "Baithul Maal", path: "/state-admin/baithul-data", Icon: BarChart3 },
    { label: "Group Reports", path: "/state-admin/group-reports", Icon: BarChart3 },
  ];

  return (
    <PageShell>
      <PageHero
        eyebrow="District Control"
        title="District Admin Panel"
        subtitle={user?.district?.name || "District"}
        icon={<Building2 className="h-6 w-6" />}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass w-56 rounded-[1.4rem] border-border/50 p-1.5 shadow-2xl">
              <DropdownMenuItem onClick={() => navigate("/members")}>Members</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/meetings")}>Meeting Agendas</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/role-management")}>
                <Shield className="mr-2 h-4 w-4" />Role Management
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/leaders")}>
                <Star className="mr-2 h-4 w-4" />Leaders
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowLogoutConfirm(true)} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        details={
          <>
            <div className="data-strip">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pending Transfers</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{loadingTransfers ? "Loading..." : pendingTransfers.length}</p>
            </div>
            <div className="data-strip">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">District</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{user?.district?.name || "District"}</p>
            </div>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="Groups" value={loadingStats ? "..." : String(totalGroups)} icon={Building2} tone="primary" />
        <MetricCard title="Total Members" value={loadingStats ? "..." : String(totalMembers)} icon={Users} tone="warning" />
        <MetricCard title="Active Members" value={loadingStats ? "..." : String(activeMembers)} icon={CheckCircle} tone="success" />
      </div>

        <UserTargetsSection />

      <SectionCard
        title="Transfer Approvals"
        description="Requests that need district review before state-level approval."
        action={
          <div className="flex items-center gap-2">
            {pendingTransfers.length > 0 && <Badge variant="destructive">{pendingTransfers.length}</Badge>}
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={fetchPendingTransfers}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        }
      >
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-orange-500" />
                <p className="text-sm font-semibold text-foreground">Approval Queue</p>
              </div>

            {loadingTransfers ? (
              <p className="pt-4 text-sm text-muted-foreground">Loading...</p>
            ) : pendingTransfers.length === 0 ? (
              <div className="py-6 text-center">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm text-muted-foreground">No pending transfers to approve</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {pendingTransfers.map((transfer) => (
                  <Card key={transfer._id} className="surface-card transition-transform hover:-translate-y-0.5">
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
                        <Badge variant="outline" className={`text-xs ${transfer.sourceDistrictApproval?.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          Source: {transfer.sourceDistrictApproval?.status === 'approved' ? '✓' : 'pending'}
                        </Badge>
                        {transfer.isCrossDistrict && (
                          <Badge variant="outline" className={`text-xs ${transfer.targetDistrictApproval?.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            Target: {transfer.targetDistrictApproval?.status === 'approved' ? '✓' : 'pending'}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-3 rounded-2xl bg-muted/70 p-3 text-xs text-muted-foreground">{transfer.reason}</p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          className="h-9 flex-1 bg-green-600 text-xs hover:bg-green-700"
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
      </SectionCard>

      <SectionCard title="District Tools" description="Fast access to the most used district workflows.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {districtTools.map(({ label, path, Icon }) => (
                <Button key={label} variant="outline" className="action-tile h-auto" onClick={() => navigate(path)}>
                  <div className="action-tile-icon">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1 text-left">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">Open {label.toLowerCase()} tools.</p>
                  </div>
                </Button>
              ))}
            </div>
      </SectionCard>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-md mx-auto p-6 rounded-[2rem] border-none shadow-2xl glass font-sans">
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
            <Button variant="outline" className="rounded-xl w-full sm:w-auto h-12 font-medium border-border/50 hover:bg-background/80" onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
            <Button className="bg-success hover:bg-success/90 rounded-xl w-full sm:w-auto h-12 font-medium text-success-foreground shadow-lg shadow-success/20 active:scale-[0.98] transition-all" onClick={handleApprove} disabled={!!processingId}>
              {processingId ? "Processing..." : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md mx-auto p-6 rounded-[2rem] border-none shadow-2xl glass font-sans">
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
            <Button variant="outline" className="rounded-xl w-full sm:w-auto h-12 font-medium border-border/50 hover:bg-background/80" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" className="rounded-xl w-full sm:w-auto h-12 font-medium shadow-lg shadow-destructive/20 active:scale-[0.98] transition-all" onClick={handleReject} disabled={!!processingId || !rejectReason.trim()}>
              {processingId ? "Processing..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>Are you sure you want to log out?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { logout(); navigate("/login"); }}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default DistrictAdmin;
