import { useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TransferMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: any;
}

const TransferMemberDialog = ({ open, onOpenChange, member }: TransferMemberDialogProps) => {
  const [district, setDistrict] = useState("");
  const [targetGroup, setTargetGroup] = useState("");

  const handleSubmit = () => {
    console.log("Transfer submitted:", { member, district, targetGroup });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer {member?.name}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground mb-4">
          Transfer this member to another group.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">District</label>
            <select
              className="w-full px-3 py-2 border rounded-md bg-background"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            >
              <option value="">Select District</option>
              <option value="Thrissur">Thrissur</option>
              <option value="Malappuram">Malappuram</option>
              <option value="Kozhikode">Kozhikode</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Target Group</label>
            <select
              className="w-full px-3 py-2 border rounded-md bg-background"
              value={targetGroup}
              onChange={(e) => setTargetGroup(e.target.value)}
            >
              <option value="">Select Group</option>
              <option value="Varantharappalli">Varantharappalli</option>
              <option value="Perumpilavu">Perumpilavu</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1 bg-success hover:bg-success/90" onClick={handleSubmit}>
              Submit Transfer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransferMemberDialog;
