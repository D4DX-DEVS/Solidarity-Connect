import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BaithulMaalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: any;
}

const BaithulMaalDialog = ({ open, onOpenChange, member }: BaithulMaalDialogProps) => {
  const [amount, setAmount] = useState("");
  const [datePaid, setDatePaid] = useState(new Date().toISOString().split("T")[0]);
  const [paidTo, setPaidTo] = useState("");
  const [remark, setRemark] = useState("");

  const handleSubmit = () => {
    console.log("Baithul Maal payment:", { member, amount, datePaid, paidTo, remark });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Baithulmaal Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Amount (₹)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Date Paid</label>
            <Input
              type="date"
              value={datePaid}
              onChange={(e) => setDatePaid(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Paid To (Optional)</label>
            <Input
              value={paidTo}
              onChange={(e) => setPaidTo(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Remark (Optional)</label>
            <Input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleSubmit}>
              Add Payment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BaithulMaalDialog;
