import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RequestEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: any;
}

const RequestEditDialog = ({ open, onOpenChange, member }: RequestEditDialogProps) => {
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

  const handleSubmit = () => {
    console.log("Edit request submitted:", formData);
    onOpenChange(false);
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
            <select
              className="w-full px-3 py-2 border rounded-md bg-background"
              value={formData.bloodGroup}
              onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
            >
              <option value="">Select Blood Group</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
            </select>
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
            <select
              className="w-full px-3 py-2 border rounded-md bg-background"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Abroad">Abroad</option>
              <option value="Age over">Age over</option>
            </select>
          </div>

          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm font-medium mb-1">Unit Assignment</p>
            <p className="text-sm text-muted-foreground">District: {formData.district}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleSubmit}>
              Submit Request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RequestEditDialog;
