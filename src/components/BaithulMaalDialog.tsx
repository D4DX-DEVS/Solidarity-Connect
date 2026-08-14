import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { baithulMaalAPI } from "@/utils/api";

interface Payment {
  _id: string;
  amount: number;
  paymentDate: string;
  paymentMonth: string;
  description?: string;
  recordedBy: {
    name: string;
    phone: string;
  };
}

interface Member {
  _id: string;
  name: string;
  phone: string;
  baithulMaal?: {
    monthlyAmount: number;
    totalPaid: number;
  };
}

interface BaithulMaalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member | null;
}

const BaithulMaalDialog = ({ open, onOpenChange, member }: BaithulMaalDialogProps) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("add");
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  
  // Form state
  const [formData, setFormData] = useState({
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM format
    description: ""
  });

  // Reset form when dialog opens/closes or member changes
  useEffect(() => {
    if (open && member) {
      setFormData({
        amount: member.baithulMaal?.monthlyAmount?.toString() || "",
        paymentDate: new Date().toISOString().split("T")[0],
        paymentMonth: new Date().toISOString().slice(0, 7),
        description: ""
      });
      setEditingPayment(null);
      fetchPayments();
    }
  }, [open, member]);

  const fetchPayments = async () => {
    if (!member) return;
    
    try {
      const token = localStorage.getItem('token');
      const result = await baithulMaalAPI.getMemberPayments(member._id);
      setPayments(result.data || []);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = editingPayment 
        ? formData 
        : { ...formData, member: member._id };

      let result;
      if (editingPayment) {
        result = await baithulMaalAPI.updatePayment(editingPayment._id, formData);
      } else {
        result = await baithulMaalAPI.createPayment(payload);
      }

      if (result && result.success !== false) {
        toast({
          title: "Success",
          description: editingPayment ? "Payment updated successfully" : "Payment recorded successfully",
        });
        
        // Reset form and refresh payments
        setFormData({
          amount: member.baithulMaal?.monthlyAmount?.toString() || "",
          paymentDate: new Date().toISOString().split("T")[0],
          paymentMonth: new Date().toISOString().slice(0, 7),
          description: ""
        });
        setEditingPayment(null);
        fetchPayments();
        setActiveTab("history");
      } else {
        toast({
          title: "Error",
          description: result?.message || "Failed to save payment",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Failed to save payment:', error);
      toast({
        title: "Error",
        description: "Failed to save payment",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      amount: payment.amount.toString(),
      paymentDate: payment.paymentDate.split('T')[0],
      paymentMonth: payment.paymentMonth,
      description: payment.description || ""
    });
    setActiveTab("add");
  };

  const handleDelete = async (paymentId: string) => {
    if (!confirm("Are you sure you want to delete this payment record?")) return;

    try {
      const token = localStorage.getItem('token');
      await baithulMaalAPI.deletePayment(paymentId);
      
      toast({
        title: "Success",
        description: "Payment record deleted successfully",
      });
      fetchPayments();
    } catch (error) {
      console.error('Failed to delete payment:', error);
      toast({
        title: "Error",
        description: "Failed to delete payment",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const formatMonth = (monthString: string) => {
    const [year, month] = monthString.split('-');
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92dvh] overflow-y-auto flex flex-col gap-4 p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-lg sm:text-xl">Baithul Maal · {member.name}</DialogTitle>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-muted/60 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Monthly</p>
              <p className="text-sm font-semibold">{formatCurrency(member.baithulMaal?.monthlyAmount || 0)}</p>
            </div>
            <div className="rounded-xl bg-success/10 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Paid</p>
              <p className="text-sm font-semibold text-success">{formatCurrency(member.baithulMaal?.totalPaid || 0)}</p>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
          <TabsList className="grid w-full grid-cols-2 h-11 rounded-xl">
            <TabsTrigger value="add" className="flex items-center gap-2 rounded-lg">
              <Plus className="h-4 w-4" />
              {editingPayment ? "Edit Payment" : "Add Payment"}
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg">Payment History</TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="mt-4 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Amount (₹) *</label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Payment Month *</label>
                  <Popover
                    open={monthOpen}
                    onOpenChange={(o) => {
                      setMonthOpen(o);
                      if (o) setPickerYear(parseInt(formData.paymentMonth.split("-")[0]));
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-start font-normal px-3">
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                          {monthNames[parseInt(formData.paymentMonth.split("-")[1]) - 1]?.slice(0, 3)}{" "}
                          {formData.paymentMonth.split("-")[0]}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3" align="start">
                      <div className="flex items-center justify-between mb-2">
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setPickerYear((y) => y - 1)}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="font-medium text-sm">{pickerYear}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setPickerYear((y) => y + 1)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {monthNames.map((m, i) => {
                          const value = `${pickerYear}-${String(i + 1).padStart(2, "0")}`;
                          const selected = formData.paymentMonth === value;
                          return (
                            <Button
                              key={m}
                              type="button"
                              size="sm"
                              variant={selected ? "default" : "ghost"}
                              className="text-xs"
                              onClick={() => {
                                setFormData({ ...formData, paymentMonth: value });
                                setMonthOpen(false);
                              }}
                            >
                              {m.slice(0, 3)}
                            </Button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Payment Date *</label>
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-start font-normal px-3">
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{formatDate(formData.paymentDate)}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={new Date(formData.paymentDate)}
                        onSelect={(d) => {
                          if (d) {
                            setFormData({ ...formData, paymentDate: d.toLocaleDateString("en-CA") });
                            setDateOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional notes about this payment"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => {
                    setEditingPayment(null);
                    setActiveTab("history");
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-success hover:bg-success/90"
                  disabled={loading}
                >
                  {loading ? "Saving..." : editingPayment ? "Update Payment" : "Add Payment"}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* ponytail: 340px ≈ form's natural height, keeps dialog same size across tabs */}
          <TabsContent value="history" className="h-[340px] data-[state=inactive]:hidden flex flex-col mt-4">
            {payments.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <p className="font-medium">No payments yet</p>
                <Button
                  size="sm"
                  onClick={() => setActiveTab("add")}
                  className="bg-success hover:bg-success/90"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Payment
                </Button>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
                {payments.map((payment) => (
                  <Card key={payment._id} className="p-4 rounded-xl">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                          <Badge variant="secondary" className="rounded-full font-normal">
                            {formatMonth(payment.paymentMonth)}
                          </Badge>
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground space-y-0.5">
                          <p>Paid {formatDate(payment.paymentDate)} · by {payment.recordedBy.name}</p>
                          {payment.description && <p className="truncate">Note: {payment.description}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEdit(payment)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(payment._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default BaithulMaalDialog;
