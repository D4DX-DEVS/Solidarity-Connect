import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const EditMemberStatus = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();

  const [currentStatus] = useState("Active");
  const [newStatus, setNewStatus] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newStatus || !reason) {
      toast({
        title: "Missing information",
        description: "Please select a new status and provide a reason",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Status change request submitted",
      description: "Your request has been sent for approval",
    });
    
    navigate("/members");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/members")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Change Member Status</h1>
            <p className="text-sm text-muted-foreground">Request to update member status</p>
          </div>
        </div>
      </header>

      <main className="p-4">
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Current Status</Label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="font-semibold text-success">{currentStatus}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newStatus">New Status *</Label>
                <select
                  id="newStatus"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  required
                >
                  <option value="">Select new status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Abroad">Abroad</option>
                  <option value="Applicant">Applicant</option>
                  <option value="Age over">Age over</option>
                  <option value="Dismissed">Dismissed</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Status Change *</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide a detailed reason for this status change..."
                  rows={4}
                  required
                />
              </div>

              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm text-muted-foreground">
                  Note: This request will be sent to the district admin for approval.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/members")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  Submit Request
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EditMemberStatus;
