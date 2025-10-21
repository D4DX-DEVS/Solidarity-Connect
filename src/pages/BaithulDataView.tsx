import { Wallet, ArrowLeft, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";

const BaithulDataView = () => {
  const navigate = useNavigate();

  const baithulRecords = [
    {
      id: 1,
      memberName: "Abdullah nadeer",
      amount: 5000,
      date: "2024-01-15",
      paidTo: "District Office",
      status: "Paid",
      remarks: "Monthly contribution"
    },
    {
      id: 2,
      memberName: "Adhil Salim Noor",
      amount: 3000,
      date: "2024-01-20",
      paidTo: "State Office",
      status: "Paid",
      remarks: "Special contribution"
    },
    {
      id: 3,
      memberName: "Mohammed Ali",
      amount: 7500,
      date: "2024-02-01",
      paidTo: "Group Office",
      status: "Pending",
      remarks: "Quarterly payment"
    },
    {
      id: 4,
      memberName: "Ahmed Hassan",
      amount: 4500,
      date: "2024-02-10",
      paidTo: "District Office",
      status: "Paid",
      remarks: "Regular contribution"
    },
  ];

  const totalAmount = baithulRecords.reduce((sum, record) => sum + record.amount, 0);
  const paidAmount = baithulRecords
    .filter(r => r.status === "Paid")
    .reduce((sum, record) => sum + record.amount, 0);
  const pendingAmount = totalAmount - paidAmount;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/state-admin")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="bg-primary p-2 rounded-lg">
            <Wallet className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Baithul Maal Data</h1>
            <p className="text-sm text-muted-foreground">Financial Records</p>
          </div>
          <Button size="sm" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total</p>
              <p className="text-lg font-bold text-primary">₹{totalAmount.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Paid</p>
              <p className="text-lg font-bold text-success">₹{paidAmount.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Pending</p>
              <p className="text-lg font-bold text-orange-500">₹{pendingAmount.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Records */}
        <div className="space-y-3">
          <h2 className="font-semibold text-sm">Payment Records</h2>
          {baithulRecords.map((record) => (
            <Card key={record.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">{record.memberName}</h3>
                    <p className="text-sm text-muted-foreground">{record.paidTo}</p>
                  </div>
                  <Badge variant={record.status === "Paid" ? "default" : "secondary"}>
                    {record.status}
                  </Badge>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <div>
                    <p className="text-2xl font-bold text-primary">₹{record.amount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{record.date}</p>
                  </div>
                </div>
                {record.remarks && (
                  <p className="text-xs text-muted-foreground mt-2 italic">{record.remarks}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default BaithulDataView;
