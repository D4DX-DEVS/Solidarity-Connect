import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { baithulMaalAPI } from "@/utils/api";
import { getMonthOptions, getMonthOptionsFrom, monthLabel, toMonthValue } from "@/lib/months";

interface Payment {
  _id: string;
  amount: number;
  paymentMonth: string; // YYYY-MM
  paymentDate: string;
}

interface StatusMember {
  _id: string;
  name: string;
  joinedDate?: string;
  baithulMaal: {
    monthlyAmount: number;
    startDate?: string;
  };
}

interface BaithulStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: StatusMember | null;
  onChanged: () => void;
}

const currentMonth = () => toMonthValue(new Date());

const BaithulStatusDialog = ({ open, onOpenChange, member, onChanged }: BaithulStatusDialogProps) => {
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (open && member) {
      setMonth(currentMonth());
      fetchPayments();
    }
  }, [open, member]);

  const fetchPayments = async () => {
    if (!member) return;
    try {
      setLoading(true);
      const result = await baithulMaalAPI.getMemberPayments(member._id);
      setPayments(result.data || []);
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!member) return null;

  const contribStart = member.baithulMaal.startDate || member.joinedDate;
  const monthOptions = contribStart ? getMonthOptionsFrom(contribStart, 1) : getMonthOptions(24, 1);
  const paymentForMonth = payments.find((p) => p.paymentMonth === month);

  const markPaid = async () => {
    setWorking(true);
    try {
      const result = await baithulMaalAPI.createPayment({
        member: member._id,
        amount: member.baithulMaal.monthlyAmount,
        paymentMonth: month,
        paymentDate: new Date().toISOString().split("T")[0],
      });
      if (result && result.success !== false) {
        toast({ title: "Payment received", description: `₹${member.baithulMaal.monthlyAmount} recorded for ${month}` });
        await fetchPayments();
        onChanged();
      } else {
        toast({ title: "Error", description: result?.message || "Failed to record payment", variant: "destructive" });
      }
    } catch (error) {
      console.error("Mark paid failed:", error);
      toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const markUnpaid = async () => {
    if (!paymentForMonth) return;
    setWorking(true);
    try {
      await baithulMaalAPI.deletePayment(paymentForMonth._id);
      toast({ title: "Payment removed", description: `${month} set back to pending` });
      await fetchPayments();
      onChanged();
    } catch (error) {
      console.error("Mark unpaid failed:", error);
      toast({ title: "Error", description: "Failed to remove payment", variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment Status - {member.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Monthly amount: ₹{member.baithulMaal.monthlyAmount}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Month</label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">Status for {monthLabel(month)}</span>
            {loading ? (
              <span className="text-sm text-muted-foreground">Loading...</span>
            ) : paymentForMonth ? (
              <Badge className="bg-success text-success-foreground hover:bg-success">Received (₹{paymentForMonth.amount})</Badge>
            ) : (
              <Badge variant="destructive">Pending</Badge>
            )}
          </div>

          {paymentForMonth ? (
            <Button variant="outline" className="w-full" onClick={markUnpaid} disabled={working || loading}>
              {working ? "Updating..." : "Mark as Not Received"}
            </Button>
          ) : (
            <Button
              className="w-full bg-success hover:bg-success/90"
              onClick={markPaid}
              disabled={working || loading || member.baithulMaal.monthlyAmount <= 0}
            >
              {working ? "Updating..." : `Mark as Received (₹${member.baithulMaal.monthlyAmount})`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BaithulStatusDialog;
