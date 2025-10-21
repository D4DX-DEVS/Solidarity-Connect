import { Building2, FileCheck, Users, CheckCircle, XCircle, Upload, Bell, Menu } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";

const DistrictAdmin = () => {
  const navigate = useNavigate();
  const pendingApprovals = [
    {
      id: 1,
      type: "Transfer",
      member: "Abdullah nadeer",
      from: "Varantharappalli",
      to: "Perumpilavu",
      requestedBy: "Group Admin",
      date: "2025-10-20",
    },
    {
      id: 2,
      type: "Edit",
      member: "Adhil Salim Noor",
      changes: "Status change to Active",
      requestedBy: "Group Admin",
      date: "2025-10-19",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">District Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Thrissur District</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm text-muted-foreground">Groups</p>
                <Users className="h-5 w-5 text-primary" />
              </div>
              <p className="text-3xl font-bold text-primary">8</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm text-muted-foreground">Members</p>
                <Users className="h-5 w-5 text-success" />
              </div>
              <p className="text-3xl font-bold text-success">142</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Pending Approvals</h2>
              <Badge variant="destructive">{pendingApprovals.length}</Badge>
            </div>

            <div className="space-y-3">
              {pendingApprovals.map((approval) => (
                <Card key={approval.id} className="border">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{approval.type}</Badge>
                          <span className="text-xs text-muted-foreground">{approval.date}</span>
                        </div>
                        <p className="font-semibold">{approval.member}</p>
                        {approval.type === "Transfer" ? (
                          <p className="text-sm text-muted-foreground">
                            {approval.from} → {approval.to}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">{approval.changes}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Requested by: {approval.requestedBy}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1 bg-success hover:bg-success/90">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-destructive">
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Tools & Reports</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Menu className="h-4 w-4 mr-2" />
                    Master Data
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("/bulk-import")}>
                    <Upload className="h-4 w-4 mr-2" />
                    Bulk Import Members
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/state-admin/send-notification")}>
                    <Bell className="h-4 w-4 mr-2" />
                    Send Notifications
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/members")}>
                <Users className="h-4 w-4 mr-2" />
                View All District Members
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileCheck className="h-4 w-4 mr-2" />
                Activity Reports
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default DistrictAdmin;
