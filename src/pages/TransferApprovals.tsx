import { ArrowLeft, CheckCircle, XCircle, ArrowRightLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";

interface DistrictApproval {
  status: "pending" | "approved" | "rejected";
  approvedBy?: { name: string };
}

interface TransferRequest {
  _id: string;
  member: { _id: string; name: string; phone: string };
  currentDistrict: { _id: string; name: string; code: string };
  currentGroup: { _id: string; name: string; code: string };
  targetDistrict: { _id: string; name: string; code: string };
  targetGroup: { _id: string; name: string; code: string };
  requestedBy: { _id: string; name: string; role: string };
  reason: string;
  status: "pending" | "district_approved" | "completed" | "rejected";
  sourceDistrictApproval: DistrictApproval;
  targetDistrictApproval: DistrictApproval;
  stateApproval: DistrictApproval;
  isCrossDistrict: boolean;
  createdAt: string;
}

const ApprovalBadge = ({ label, status }: { label: string; status: string }) => {
  const colorMap: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <Badge variant="outline" className={`text-xs ${colorMap[status] ?? "bg-gray-100 text-gray-600"}`}>
      {label}: {status === "approved" ? "✓" : status === "rejected" ? "✗" : "pending"}
    </Badge>
  );
};

const TransferApprovals = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const itemsPerPage = 20;

  const crossDistrictCount = transferRequests.filter((request) => request.isCrossDistrict).length;
  const waitingOnStateCount = transferRequests.filter((request) => request.stateApproval?.status === "pending").length;

  useEffect(() => {
    fetchTransferRequests();
  }, []);

  const fetchTransferRequests = async (page = 1, append = false) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      // No ?status= param — backend auto-filters by role
      const response = await api.get(
        `/transfer-requests?page=${page}&limit=${itemsPerPage}&sort=-createdAt`
      );

      if (append) {
        setTransferRequests(prev => [...prev, ...((response.data as TransferRequest[]) || [])]);
      } else {
        setTransferRequests((response.data as TransferRequest[]) || []);
      }

      if (response.pagination) {
        setCurrentPage(response.pagination.currentPage);
        setHasNextPage(response.pagination.hasNextPage);
      }
    } catch (error) {
      console.error("Failed to fetch transfer requests:", error);
      toast({ title: "Error", description: "Failed to load transfer requests", variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreRequests = async () => {
    if (!hasNextPage || loadingMore) return;
    await fetchTransferRequests(currentPage + 1, true);
  };

  const handleApprove = async (id: string) => {
    try {
      setProcessingId(id);
      await api.post(`/transfer-requests/${id}/approve`, { comments: "" });

      if (userRole === "state_admin") {
        toast({ title: "Transfer Completed", description: "Member has been successfully moved to the new group." });
      } else {
        toast({ title: "Approved", description: "Transfer forwarded to the next approval stage." });
      }
      await fetchTransferRequests();
    } catch (error) {
      console.error("Failed to approve transfer:", error);
      toast({ title: "Error", description: "Failed to approve transfer request", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectDialog = (id: string) => {
    setRejectTargetId(id);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!rejectTargetId || !rejectReason.trim()) {
      toast({ title: "Error", description: "Please provide a rejection reason", variant: "destructive" });
      return;
    }
    try {
      setProcessingId(rejectTargetId);
      await api.post(`/transfer-requests/${rejectTargetId}/reject`, { reason: rejectReason });
      toast({ title: "Transfer Rejected", description: "Request has been rejected.", variant: "destructive" });
      setRejectDialogOpen(false);
      setRejectTargetId(null);
      await fetchTransferRequests();
    } catch (error) {
      console.error("Failed to reject transfer:", error);
      toast({ title: "Error", description: "Failed to reject transfer request", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <PageShell>
      <PageHero
        title="Transfer Approvals"
        subtitle={`${transferRequests.length} request${transferRequests.length !== 1 ? "s" : ""} currently need review or action.`}
        eyebrow="Approvals"
        icon={<ArrowRightLeft className="h-6 w-6" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(userRole === "district_admin" ? "/district-admin" : "/state-admin")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard title="Pending Requests" value={String(transferRequests.length)} icon={ArrowRightLeft} tone="primary" />
        <MetricCard title="Cross-District" value={String(crossDistrictCount)} icon={Clock} tone="warning" />
        <MetricCard title="Waiting on State" value={String(waitingOnStateCount)} icon={CheckCircle} tone="success" />
      </div>

      <SectionCard title="Approval Queue" description="Review source, target, reason, and approval chain before taking action.">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading transfer requests...
          </div>
        ) : (
          <div className="space-y-3">
          {transferRequests.map((request) => (
            <Card key={request._id} className="surface-card border-border/70">
              <CardContent className="p-4">
                <div className="mb-3">
                  {/* Transfer type + district approval badges */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={request.isCrossDistrict ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"}
                    >
                      {request.isCrossDistrict ? "Cross-District" : "Within District"}
                    </Badge>

                    <ApprovalBadge
                      label={`Source (${request.currentDistrict.name})`}
                      status={request.sourceDistrictApproval.status}
                    />

                    {request.isCrossDistrict && (
                      <ApprovalBadge
                        label={`Target (${request.targetDistrict.name})`}
                        status={request.targetDistrictApproval.status}
                      />
                    )}

                    {userRole === "state_admin" && (
                      <ApprovalBadge label="State" status={request.stateApproval.status} />
                    )}

                    <span className="text-xs text-muted-foreground">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Member info */}
                  <h3 className="font-semibold text-lg mb-1">{request.member.name}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{request.member.phone}</p>

                  {/* From / To */}
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <div className="bg-muted px-2 py-1 rounded">
                      <p className="text-xs text-muted-foreground">From</p>
                      <p className="font-medium">{request.currentDistrict.name}</p>
                      <p className="text-xs">{request.currentGroup.name}</p>
                    </div>
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="bg-muted px-2 py-1 rounded">
                      <p className="text-xs text-muted-foreground">To</p>
                      <p className="font-medium">{request.targetDistrict.name}</p>
                      <p className="text-xs">{request.targetGroup.name}</p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="mb-2">
                    <p className="text-xs text-muted-foreground mb-1">Reason:</p>
                    <p className="text-sm bg-muted p-2 rounded">{request.reason}</p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Requested by: {request.requestedBy.name} ({request.requestedBy.role.replace("_", " ")})
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-success hover:bg-success/90"
                    onClick={() => handleApprove(request._id)}
                    disabled={processingId === request._id}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {processingId === request._id
                      ? "Processing..."
                      : userRole === "state_admin"
                        ? "Approve & Complete"
                        : "Approve"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-destructive"
                    onClick={() => openRejectDialog(request._id)}
                    disabled={processingId === request._id}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        )}

        {/* Load more */}
        {!loading && hasNextPage && (
          <Button variant="outline" className="mt-3 w-full" onClick={loadMoreRequests} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load More"}
          </Button>
        )}

        {/* Empty state */}
        {!loading && transferRequests.length === 0 && (
          <div className="rounded-[1.8rem] border border-border/60 bg-background/75 p-8 text-center shadow-sm">
            <ArrowRightLeft className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="font-semibold text-lg mb-2">No Pending Transfers</h2>
            <p className="text-sm text-muted-foreground">
              {userRole === "state_admin"
                ? "No transfers are awaiting your final approval."
                : "No transfers require your approval at this time."}
            </p>
          </div>
        )}
      </SectionCard>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md mx-auto p-6 rounded-[2rem] border-none shadow-2xl glass font-sans">
          <div className="flex flex-col items-center text-center">
            <div className="bg-destructive/10 p-4 rounded-full mb-4 ring-8 ring-destructive/5">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight mb-1">Reject Transfer Request</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to reject this transfer request? This action cannot be undone.
            </p>
          </div>
          <div className="mb-6 space-y-2">
            <label className="text-sm font-semibold text-destructive">Rejection Reason *</label>
            <Textarea
              className="resize-none rounded-xl border-destructive/20 focus:border-destructive transition-colors bg-destructive/5 mt-1"
              placeholder="Provide a detailed rejection reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-3 sm:gap-2">
            <Button variant="outline" className="rounded-xl w-full sm:w-auto h-12 font-medium border-border/50 hover:bg-background/80" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl w-full sm:w-auto h-12 font-medium shadow-lg shadow-destructive/20 active:scale-[0.98] transition-all"
              onClick={handleReject}
              disabled={!!processingId || !rejectReason.trim()}
            >
              {processingId ? "Processing..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default TransferApprovals;
