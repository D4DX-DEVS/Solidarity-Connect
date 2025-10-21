import { ArrowLeft, CheckCircle, XCircle, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const TransferApprovals = () => {
  const navigate = useNavigate();

  const transferRequests = [
    {
      id: 1,
      member: "Abdullah nadeer",
      fromDistrict: "Thrissur",
      fromGroup: "Varantharappalli",
      toDistrict: "Thrissur",
      toGroup: "Perumpilavu",
      requestedBy: "Group Admin - Varantharappalli",
      date: "2025-10-20",
      status: "pending",
    },
    {
      id: 2,
      member: "Adhil Salim Noor",
      fromDistrict: "Thrissur",
      fromGroup: "Perumpilavu",
      toDistrict: "Malappuram",
      toGroup: "Manjeri",
      requestedBy: "Group Admin - Perumpilavu",
      date: "2025-10-19",
      status: "pending",
    },
  ];

  const handleApprove = (id: number) => {
    toast({
      title: "Transfer Approved",
      description: "Member transfer has been approved successfully.",
    });
  };

  const handleReject = (id: number) => {
    toast({
      title: "Transfer Rejected",
      description: "Member transfer request has been rejected.",
      variant: "destructive",
    });
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
        {transferRequests.map((request) => (
          <Card key={request.id} className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-orange-100 text-orange-800">
                      Transfer Request
                    </Badge>
                    <span className="text-xs text-muted-foreground">{request.date}</span>
                  </div>
                  <h3 className="font-semibold text-lg mb-1">{request.member}</h3>
                  
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <div className="bg-muted px-2 py-1 rounded">
                      <p className="text-xs text-muted-foreground">From</p>
                      <p className="font-medium">{request.fromDistrict}</p>
                      <p className="text-xs">{request.fromGroup}</p>
                    </div>
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    <div className="bg-muted px-2 py-1 rounded">
                      <p className="text-xs text-muted-foreground">To</p>
                      <p className="font-medium">{request.toDistrict}</p>
                      <p className="text-xs">{request.toGroup}</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Requested by: {request.requestedBy}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-success hover:bg-success/90"
                  onClick={() => handleApprove(request.id)}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-destructive"
                  onClick={() => handleReject(request.id)}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

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
