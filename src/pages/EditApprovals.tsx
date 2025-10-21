import { ArrowLeft, CheckCircle, XCircle, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const EditApprovals = () => {
  const navigate = useNavigate();

  const editRequests = [
    {
      id: 1,
      member: "Abdullah nadeer",
      changes: [
        { field: "Email", oldValue: "No email", newValue: "abdullah@example.com" },
        { field: "Blood Group", oldValue: "Not set", newValue: "A+" },
      ],
      requestedBy: "Group Admin - Varantharappalli",
      date: "2025-10-20",
      status: "pending",
    },
    {
      id: 2,
      member: "Adhil Salim Noor",
      changes: [
        { field: "Status", oldValue: "Applicant", newValue: "Active" },
        { field: "Profession", oldValue: "Not set", newValue: "Teacher" },
      ],
      requestedBy: "Group Admin - Varantharappalli",
      date: "2025-10-19",
      status: "pending",
    },
  ];

  const handleApprove = (id: number) => {
    toast({
      title: "Edit Approved",
      description: "Member edit request has been approved successfully.",
    });
  };

  const handleReject = (id: number) => {
    toast({
      title: "Edit Rejected",
      description: "Member edit request has been rejected.",
      variant: "destructive",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Edit Approvals</h1>
            <p className="text-sm text-muted-foreground">
              {editRequests.length} pending requests
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-3">
        {editRequests.map((request) => (
          <Card key={request.id} className="shadow-sm">
            <CardContent className="p-4">
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    Edit Request
                  </Badge>
                  <span className="text-xs text-muted-foreground">{request.date}</span>
                </div>
                <h3 className="font-semibold text-lg mb-1">{request.member}</h3>
                
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Requested Changes:</p>
                  {request.changes.map((change, index) => (
                    <div key={index} className="bg-muted p-2 rounded text-sm">
                      <p className="font-medium">{change.field}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-muted-foreground line-through">{change.oldValue}</span>
                        <span>→</span>
                        <span className="font-medium text-primary">{change.newValue}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Requested by: {request.requestedBy}
                </p>
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

        {editRequests.length === 0 && (
          <Card className="p-8 text-center shadow-sm">
            <Edit className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="font-semibold text-lg mb-2">No Pending Edits</h2>
            <p className="text-sm text-muted-foreground">
              All edit requests have been processed.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
};

export default EditApprovals;
