import { useState, useEffect, useCallback } from "react";
import { FileText, Check, X, MessageSquare, Clock, AlertCircle } from "lucide-react";
import { SectionCard } from "@/components/app/AppShell";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { requestsAPI } from "@/utils/api";

interface RequestItem {
  _id: string;
  type: string;
  status: string;
  priority: string;
  approvalLevel: string;
  member?: { name: string; phone: string };
  requestedBy?: { name: string; role: string };
  changes?: Array<{ field: string; oldValue: any; newValue: any }>;
  createdAt: string;
}

const Requests = () => {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const result = await requestsAPI.getRequests({ status: 'pending', limit: '50' });
      setRequests(result.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to fetch requests", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      await requestsAPI.approveRequest(id);
      toast({ title: "Approved", description: "Request approved successfully." });
      fetchRequests();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to approve", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    try {
      setActionLoading(id);
      await requestsAPI.rejectRequest(id, reason);
      toast({ title: "Rejected", description: "Request rejected." });
      fetchRequests();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reject", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><X className="h-3 w-3 mr-1" />Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'member_edit': return <Badge variant="secondary">Edit Member</Badge>;
      case 'member_transfer': return <Badge variant="secondary">Transfer</Badge>;
      case 'baithul_maal_update': return <Badge variant="secondary">Baithul Maal</Badge>;
      default: return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const canApprove = (request: RequestItem) => {
    if (!user) return false;
    const role = user.role;
    return role === 'state_admin' || role === request.approvalLevel;
  };

  return (
    <div className="app-page">
      <HeaderWithLogout icon={<FileText className="h-6 w-6 text-primary-foreground" />} title="Requests" />

      <main className="app-main pb-24">
      <SectionCard title="Pending Queue" description="Requests awaiting your action.">
        {loading ? (
          <ListSkeleton rows={4} />
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-10 text-center shadow-sm">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="font-semibold text-lg mb-2">No Pending Requests</h2>
            <p className="text-sm text-muted-foreground">
              Transfer and edit requests will appear here for approval.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <Card key={request._id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {getTypeBadge(request.type)}
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm font-medium truncate">
                        {request.member?.name || "Unknown Member"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        By {request.requestedBy?.name} &middot; {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                      {request.changes && request.changes.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <span className="font-medium">Changes:</span>{" "}
                          {request.changes.map(c => c.field).join(", ")}
                        </div>
                      )}
                    </div>
                    {canApprove(request) && request.status === 'pending' && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => handleApprove(request._id)}
                          disabled={actionLoading === request._id}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleReject(request._id)}
                          disabled={actionLoading === request._id}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>
      </main>

      <BottomNav />
    </div>
  );
};

export default Requests;
