import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, Plus } from "lucide-react";
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

      if (editingPayment) {
        await baithulMaalAPI.updatePayment(editingPayment._id, formData);
      } else {
        await baithulMaalAPI.createPayment(payload);
      }

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
          description: result.message || "Failed to save payment",
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

  const formatMonth = (monthString: string) => {
    const [year, month] = monthString.split('-');
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Baithul Maal - {member.name}</DialogTitle>
          <div className="text-sm text-muted-foreground">
            Monthly Amount: {formatCurrency(member.baithulMaal?.monthlyAmount || 0)} | 
            Total Paid: {formatCurrency(member.baithulMaal?.totalPaid || 0)}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {editingPayment ? "Edit Payment" : "Add Payment"}
            </TabsTrigger>
            <TabsTrigger value="history">Payment History</TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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

                <div>
                  <label className="text-sm font-medium mb-2 block">Payment Month *</label>
                  <Input
                    type="month"
                    required
                    value={formData.paymentMonth}
                    onChange={(e) => setFormData({ ...formData, paymentMonth: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Payment Date *</label>
                <Input
                  type="date"
                  required
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                />
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

          <TabsContent value="history" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Payment History</h3>
              <Button 
                size="sm" 
                onClick={() => setActiveTab("add")}
                className="bg-success hover:bg-success/90"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Payment
              </Button>
            </div>

            {payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payment records found
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {payments.map((payment) => (
                  <Card key={payment._id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>Month: {formatMonth(payment.paymentMonth)}</p>
                          <p>Date: {formatDate(payment.paymentDate)}</p>
                          {payment.description && <p>Note: {payment.description}</p>}
                          <p>Recorded by: {payment.recordedBy.name}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(payment)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
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
