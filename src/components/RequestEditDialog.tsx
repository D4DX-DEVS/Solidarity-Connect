import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { requestsAPI } from "@/utils/api";

interface RequestEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: any;
}

const RequestEditDialog = ({ open, onOpenChange, member }: RequestEditDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: member?.name || "",
    phone: member?.phone || "",
    email: member?.email || "",
    dateOfBirth: "",
    bloodGroup: "",
    baithulmaalAmount: "10",
    status: member?.status || "Active",
    district: "Thrissur",
  });

  const handleSubmit = async () => {
    if (!member?._id) return;

    try {
      setLoading(true);
      const proposedData: Record<string, any> = {};

      if (formData.name && formData.name !== member.name) proposedData.name = formData.name;
      if (formData.email && formData.email !== member.email) proposedData.email = formData.email;
      if (formData.phone && formData.phone !== member.phone) proposedData.phone = formData.phone;
      if (formData.bloodGroup) proposedData.bloodGroup = formData.bloodGroup;
      if (formData.dateOfBirth) proposedData.dateOfBirth = formData.dateOfBirth;
      if (formData.status !== member.status) proposedData.status = formData.status;

      if (Object.keys(proposedData).length === 0) {
        toast({ title: "No Changes", description: "Please modify at least one field.", variant: "destructive" });
        return;
      }

      await requestsAPI.createRequest({
        type: 'member_edit',
        member: member._id,
        title: `Edit request for ${member.name}`,
        proposedData,
        reason: `Edit request for ${member.name}`,
      });

      toast({ title: "Request Submitted", description: "Your edit request has been submitted for approval." });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to submit request", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Changes for {member?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Phone Number</label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use "Change Phone" button for phone number changes
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Email</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Date of Birth</label>
            <Input
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Blood Group</label>
            <Select
              value={formData.bloodGroup || "none"}
              onValueChange={(val) => setFormData({ ...formData, bloodGroup: val === "none" ? "" : val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Blood Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select Blood Group</SelectItem>
                <SelectItem value="A+">A+</SelectItem>
                <SelectItem value="A-">A-</SelectItem>
                <SelectItem value="B+">B+</SelectItem>
                <SelectItem value="B-">B-</SelectItem>
                <SelectItem value="O+">O+</SelectItem>
                <SelectItem value="O-">O-</SelectItem>
                <SelectItem value="AB+">AB+</SelectItem>
                <SelectItem value="AB-">AB-</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Baithulmaal Amount</label>
            <Input
              value={formData.baithulmaalAmount}
              onChange={(e) => setFormData({ ...formData, baithulmaalAmount: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Fixed amount the member has to pay
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select
              value={formData.status}
              onValueChange={(val) => setFormData({ ...formData, status: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Abroad">Abroad</SelectItem>
                <SelectItem value="Age over">Age over</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm font-medium mb-1">Unit Assignment</p>
            <p className="text-sm text-muted-foreground">District: {formData.district}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleSubmit} disabled={loading}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RequestEditDialog;
