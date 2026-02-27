import { Building2, FileCheck, Users, CheckCircle, XCircle, Upload, Bell, Menu, Shield, Star, ArrowRightLeft, RefreshCcw, Target } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
  areaApproval: { status: string };
  districtApproval: { status: string };
  createdAt: string;
}

interface DashboardStats {
  memberStatistics?: { totalMembers: number; activeMembers: number };
  groupStatistics?: { totalGroups: number } | null;
}

const DistrictAdmin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingTransfers, setPendingTransfers] = useState<TransferRequest[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingTransfers, setLoadingTransfers] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">District Admin Panel</h1>
            <p className="text-sm text-muted-foreground">{user?.district?.name || "District"}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate("/members")}>Members</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/meetings")}>Meeting Agendas</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/role-management")}>
                <Shield className="h-4 w-4 mr-2" />Role Management
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/leaders")}>
                <Star className="h-4 w-4 mr-2" />Leaders
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/login")} className="text-destructive">
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1">Groups</p>
              <p className="text-2xl font-bold text-primary">{loadingStats ? "..." : totalGroups}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1">Total</p>
              <p className="text-2xl font-bold text-orange-500">{loadingStats ? "..." : totalMembers}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1">Active</p>
              <p className="text-2xl font-bold text-green-500">{loadingStats ? "..." : activeMembers}</p>
            </CardContent>
          </Card>
        </div>

        {/* My Targets */}
        <UserTargetsSection />

        {/* Pending Transfer Approvals */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-orange-500" />
                <h2 className="font-semibold">Transfer Approvals</h2>
              </div>
              <div className="flex items-center gap-2">
                {pendingTransfers.length > 0 && <Badge variant="destructive">{pendingTransfers.length}</Badge>}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchPendingTransfers}>
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {loadingTransfers ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : pendingTransfers.length === 0 ? (
              <div className="text-center py-4">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm text-muted-foreground">No pending transfers to approve</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingTransfers.map(transfer => (
                  <Card key={transfer._id} className="border">
                    <CardContent className="p-3">
                      <p className="font-semibold text-sm">{transfer.member?.name}</p>
                      <p className="text-xs text-muted-foreground">{transfer.member?.phone}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <span>{transfer.currentGroup?.name}</span>
                        <span>→</span>
                        <span>{transfer.targetGroup?.name}</span>
                        {transfer.currentDistrict?._id !== transfer.targetDistrict?._id && (
                          <Badge variant="outline" className="text-xs ml-1">Cross-District</Badge>
                        )}
                      </div>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="outline" className={`text-xs ${transfer.areaApproval?.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          Area: {transfer.areaApproval?.status || 'pending'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 bg-muted p-1 rounded">{transfer.reason}</p>
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700 text-xs h-7"
                          disabled={processingId === transfer._id}
                          onClick={() => { setSelectedTransfer(transfer); setApproveDialogOpen(true); }}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-destructive text-xs h-7"
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
          </CardContent>
        </Card>

        {/* District Tools */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h2 className="font-semibold mb-3">District Tools</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Members", path: "/members", Icon: Users },
                { label: "Meetings", path: "/meetings", Icon: FileCheck },
                { label: "Role Management", path: "/role-management", Icon: Shield },
                { label: "Leaders", path: "/leaders", Icon: Star },
              ].map(({ label, path, Icon }) => (
                <Button key={label} variant="outline" className="h-14 flex-col gap-1 text-xs" onClick={() => navigate(path)}>
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader><DialogTitle>Approve Transfer</DialogTitle></DialogHeader>
          <p className="text-sm">
            Approve transfer for <strong>{selectedTransfer?.member?.name}</strong>? This will forward to State Admin for final approval.
          </p>
          <div>
            <label className="text-sm font-medium">Comments (Optional)</label>
            <Textarea className="mt-1" placeholder="Add comments..." value={commentText} onChange={e => setCommentText(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={!!processingId}>
              <CheckCircle className="h-4 w-4 mr-1" />{processingId ? "Processing..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader><DialogTitle>Reject Transfer</DialogTitle></DialogHeader>
          <p className="text-sm">Reject transfer for <strong>{selectedTransfer?.member?.name}</strong>?</p>
          <div>
            <label className="text-sm font-medium">Rejection Reason *</label>
            <Textarea className="mt-1" placeholder="Provide a reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!processingId || !rejectReason.trim()}>
              <XCircle className="h-4 w-4 mr-1" />{processingId ? "Processing..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default DistrictAdmin;
