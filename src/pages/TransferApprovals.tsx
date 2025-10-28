import { ArrowLeft, CheckCircle, XCircle, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
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
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  isCrossDistrict: boolean;
  createdAt: string;
  updatedAt: string;
}

const TransferApprovals = () => {
  const navigate = useNavigate();
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
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
      
      // First approve the transfer
      await api.post(`/transfer-requests/${id}/approve`, {
        comments: "Approved by State Admin"
      });
      
      // Then complete the transfer (actually move the member)
      await api.post(`/transfer-requests/${id}/complete`);
      
      toast({
        title: "Transfer Completed",
        description: "Member has been successfully transferred to the new district and group.",
      });
      
      // Refresh the list
      await fetchTransferRequests();
    } catch (error) {
      console.error('Failed to approve and complete transfer:', error);
      toast({
        title: "Error",
        description: "Failed to approve and complete transfer request",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setProcessingId(id);
      await api.post(`/transfer-requests/${id}/reject`, {
        reason: "Rejected by State Admin"
      });
      
      toast({
        title: "Transfer Rejected",
        description: "Member transfer request has been rejected.",
        variant: "destructive",
      });
      
      // Refresh the list
      await fetchTransferRequests();
    } catch (error) {
      console.error('Failed to reject transfer:', error);
      toast({
        title: "Error",
        description: "Failed to reject transfer request",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/state-admin")}>
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
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="bg-orange-100 text-orange-800">
                        {request.isCrossDistrict ? 'Cross-District Transfer' : 'Within District Transfer'}
                      </Badge>
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
                    {processingId === request._id ? 'Processing...' : 'Approve & Complete'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-destructive"
                    onClick={() => handleReject(request._id)}
                    disabled={processingId === request._id}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    {processingId === request._id ? 'Rejecting...' : 'Reject'}
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
    </div>
  );
};

export default TransferApprovals;
