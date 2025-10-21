import { Wallet, ArrowLeft, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const BaithulDataView = () => {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [viewMode, setViewMode] = useState<"individual" | "cumulative">("individual");

  const allBaithulRecords = [
    {
      id: 1,
      memberName: "Abdullah nadeer",
      amount: 5000,
      date: "2024-01-15",
      month: "January 2024",
      district: "Thrissur",
      group: "Varantharappalli",
      paidTo: "District Office",
      status: "Paid",
      remarks: "Monthly contribution"
    },
    {
      id: 2,
      memberName: "Adhil Salim Noor",
      amount: 3000,
      date: "2024-01-20",
      month: "January 2024",
      district: "Thrissur",
      group: "Varantharappalli",
      paidTo: "State Office",
      status: "Paid",
      remarks: "Special contribution"
    },
    {
      id: 3,
      memberName: "Mohammed Ali",
      amount: 7500,
      date: "2024-02-01",
      month: "February 2024",
      district: "Thrissur",
      group: "Perumpilavu",
      paidTo: "Group Office",
      status: "Pending",
      remarks: "Quarterly payment"
    },
    {
      id: 4,
      memberName: "Ahmed Hassan",
      amount: 4500,
      date: "2024-02-10",
      month: "February 2024",
      district: "Malappuram",
      group: "Manjeri",
      paidTo: "District Office",
      status: "Paid",
      remarks: "Regular contribution"
    },
  ];

  // Apply filters
  const baithulRecords = allBaithulRecords.filter(record => {
    const matchesMonth = !selectedMonth || record.month === selectedMonth;
    const matchesDistrict = !selectedDistrict || record.district === selectedDistrict;
    const matchesGroup = !selectedGroup || record.group === selectedGroup;
    return matchesMonth && matchesDistrict && matchesGroup;
  });

  // Group by group for cumulative view
  const cumulativeData = baithulRecords.reduce((acc, record) => {
    const key = `${record.district}-${record.group}`;
    if (!acc[key]) {
      acc[key] = {
        district: record.district,
        group: record.group,
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        recordCount: 0,
      };
    }
    acc[key].totalAmount += record.amount;
    acc[key].recordCount += 1;
    if (record.status === "Paid") {
      acc[key].paidAmount += record.amount;
    } else {
      acc[key].pendingAmount += record.amount;
    }
    return acc;
  }, {} as Record<string, any>);

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
        {/* Filters */}
        <Card className="shadow-sm">
          <CardContent className="p-3 space-y-2">
            <div className="flex gap-2">
              <Button
                variant={viewMode === "individual" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setViewMode("individual")}
              >
                Individual
              </Button>
              <Button
                variant={viewMode === "cumulative" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setViewMode("cumulative")}
              >
                Cumulative
              </Button>
            </div>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="">All Months</option>
              <option value="January 2024">January 2024</option>
              <option value="February 2024">February 2024</option>
              <option value="March 2024">March 2024</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="px-3 py-2 border rounded-md text-sm bg-background"
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
              >
                <option value="">All Districts</option>
                <option value="Thrissur">Thrissur</option>
                <option value="Malappuram">Malappuram</option>
                <option value="Kozhikode">Kozhikode</option>
              </select>
              <select
                className="px-3 py-2 border rounded-md text-sm bg-background"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                <option value="">All Groups</option>
                <option value="Varantharappalli">Varantharappalli</option>
                <option value="Perumpilavu">Perumpilavu</option>
                <option value="Manjeri">Manjeri</option>
              </select>
            </div>
          </CardContent>
        </Card>

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
        {viewMode === "individual" ? (
          <div className="space-y-3">
            <h2 className="font-semibold text-sm">Payment Records</h2>
            {baithulRecords.map((record) => (
              <Card key={record.id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{record.memberName}</h3>
                      <p className="text-sm text-muted-foreground">{record.group}, {record.district}</p>
                      <p className="text-xs text-muted-foreground">{record.paidTo}</p>
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
        ) : (
          <div className="space-y-3">
            <h2 className="font-semibold text-sm">Cumulative View by Group</h2>
            {Object.values(cumulativeData).map((group: any, index) => (
              <Card key={index} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{group.group}</h3>
                      <p className="text-sm text-muted-foreground">{group.district}</p>
                    </div>
                    <Badge variant="outline">{group.recordCount} payments</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center bg-primary/10 rounded-lg p-2">
                      <p className="text-lg font-bold text-primary">₹{group.totalAmount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center bg-success/10 rounded-lg p-2">
                      <p className="text-lg font-bold text-success">₹{group.paidAmount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Paid</p>
                    </div>
                    <div className="text-center bg-orange-100 rounded-lg p-2">
                      <p className="text-lg font-bold text-orange-500">₹{group.pendingAmount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default BaithulDataView;
