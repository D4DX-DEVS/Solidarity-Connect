import { ArrowLeft, CheckCircle, XCircle, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";

interface TransferRequest {
  _id: string;
  member: {
    _id: string;
    name: string;
    phone: string;
  };
  currentDistrict: {
    _id: string;
    name: string;
    code: string;
  };
  currentGroup: {
    _id: string;
    name: string;
    code: string;
  };
  targetDistrict: {
    _id: string;
    name: string;
    code: string;
  };
  targetGroup: {
    _id: string;
    name: string;
    code: string;
  };
  requestedBy: {
    _id: string;
    name: string;
    role: string;
  };
  reason: string;
  status: 'pending' | 'area_approved' | 'district_approved' | 'approved' | 'rejected' | 'completed';
  areaApproval: { status: string; approvedBy?: { name: string } };
  districtApproval: { status: string; approvedBy?: { name: string } };
  isCrossDistrict: boolean;
  createdAt: string;
  updatedAt: string;
}

const TransferApprovals = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchTransferRequests();
  }, []);

  const fetchTransferRequests = async (page = 1, append = false) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      
      const response = await api.get(`/transfer-requests?status=pending&page=${page}&limit=${itemsPerPage}&sort=-createdAt`);
      console.log('Transfer requests API response:', response);
      console.log('Transfer requests data:', response.data);
      
      if (append) {
        setTransferRequests(prev => [...prev, ...(response.data || [])]);
      } else {
        setTransferRequests(response.data || []);
      }
      
      // Update pagination state
      if (response.pagination) {
        setCurrentPage(response.pagination.currentPage);
        setTotalPages(response.pagination.totalPages);
        setTotalDocs(response.pagination.totalDocs);
        setHasNextPage(response.pagination.hasNextPage);
      }
    } catch (error) {
      console.error('Failed to fetch transfer requests:', error);
      toast({
        title: "Error",
        description: "Failed to load transfer requests",
        variant: "destructive",
      });
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
      // State admin also completes the transfer in one step
      if (userRole === 'state_admin') {
        await api.post(`/transfer-requests/${id}/complete`);
        toast({ title: "Transfer Completed", description: "Member has been successfully transferred." });
      } else {
        toast({ title: "Approved", description: "Transfer forwarded to the next approval tier." });
      }
      await fetchTransferRequests();
    } catch (error) {
      console.error('Failed to approve transfer:', error);
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
      console.error('Failed to reject transfer:', error);
      toast({ title: "Error", description: "Failed to reject transfer request", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(userRole === 'district_admin' ? '/district-admin' : '/state-admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Transfer Approvals</h1>
            <p className="text-sm text-muted-foreground">
              {transferRequests.length} pending requests
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-muted-foreground">Loading transfer requests...</div>
          </div>
        ) : (
          transferRequests.map((request) => (
            <Card key={request._id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="outline" className="bg-orange-100 text-orange-800">
                        {request.isCrossDistrict ? 'Cross-District' : 'Within District'}
                      </Badge>
                      {request.areaApproval?.status === 'approved' && (
                        <Badge variant="outline" className="bg-green-100 text-green-700 text-xs">Area ✓</Badge>
                      )}
                      {request.districtApproval?.status === 'approved' && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 text-xs">District ✓</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg mb-1">{request.member.name}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{request.member.phone}</p>
                    
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <div className="bg-muted px-2 py-1 rounded">
                        <p className="text-xs text-muted-foreground">From</p>
                        <p className="font-medium">{request.currentDistrict.name}</p>
                        <p className="text-xs">{request.currentGroup.name}</p>
                      </div>
                      <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                      <div className="bg-muted px-2 py-1 rounded">
                        <p className="text-xs text-muted-foreground">To</p>
                        <p className="font-medium">{request.targetDistrict.name}</p>
                        <p className="text-xs">{request.targetGroup.name}</p>
                      </div>
                    </div>

                    <div className="mb-2">
                      <p className="text-xs text-muted-foreground mb-1">Reason:</p>
                      <p className="text-sm bg-muted p-2 rounded">{request.reason}</p>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Requested by: {request.requestedBy.name} ({request.requestedBy.role.replace('_', ' ')})
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-success hover:bg-success/90"
                    onClick={() => handleApprove(request._id)}
                    disabled={processingId === request._id}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {processingId === request._id ? 'Processing...' : userRole === 'state_admin' ? 'Approve & Complete' : 'Approve'}
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
          ))
        )}

        {transferRequests.length === 0 && (
          <Card className="p-8 text-center shadow-sm">
            <ArrowRightLeft className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="font-semibold text-lg mb-2">No Pending Transfers</h2>
            <p className="text-sm text-muted-foreground">
              All transfer requests have been processed.
            </p>
          </Card>
        )}
      </main>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader><DialogTitle>Reject Transfer Request</DialogTitle></DialogHeader>
          <div>
            <label className="text-sm font-medium">Rejection Reason *</label>
            <Textarea
              className="mt-1"
              placeholder="Provide a rejection reason..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!processingId || !rejectReason.trim()}>
              <XCircle className="h-4 w-4 mr-1" />{processingId ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransferApprovals;
