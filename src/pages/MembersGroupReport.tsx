import { Users, ArrowLeft, Download, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";

const MembersGroupReport = () => {
  const navigate = useNavigate();

  const groupReports = [
    {
      district: "Thrissur",
      groups: [
        {
          name: "Varantharappalli",
          total: 45,
          active: 38,
          inactive: 3,
          abroad: 2,
          applicant: 2,
          growth: "+5",
        },
        {
          name: "Perumpilavu",
          total: 32,
          active: 28,
          inactive: 2,
          abroad: 1,
          applicant: 1,
          growth: "+2",
        },
      ],
    },
    {
      district: "Malappuram",
      groups: [
        {
          name: "Manjeri",
          total: 52,
          active: 45,
          inactive: 4,
          abroad: 2,
          applicant: 1,
          growth: "+7",
        },
        {
          name: "Perinthalmanna",
          total: 38,
          active: 32,
          inactive: 3,
          abroad: 2,
          applicant: 1,
          growth: "+3",
        },
      ],
    },
    {
      district: "Kozhikode",
      groups: [
        {
          name: "Chevayur",
          total: 41,
          active: 36,
          inactive: 2,
          abroad: 2,
          applicant: 1,
          growth: "+4",
        },
      ],
    },
  ];

  const totalMembers = groupReports.reduce(
    (sum, district) => sum + district.groups.reduce((s, g) => s + g.total, 0),
    0
  );
  const totalActive = groupReports.reduce(
    (sum, district) => sum + district.groups.reduce((s, g) => s + g.active, 0),
    0
  );

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
            <Users className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Group Reports</h1>
            <p className="text-sm text-muted-foreground">Member Statistics</p>
          </div>
          <Button size="sm" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Members</p>
              <p className="text-3xl font-bold text-primary">{totalMembers}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Active Members</p>
              <p className="text-3xl font-bold text-success">{totalActive}</p>
            </CardContent>
          </Card>
        </div>

        {/* District-wise Reports */}
        {groupReports.map((district, districtIndex) => (
          <div key={districtIndex}>
            <h2 className="font-semibold mb-3">{district.district}</h2>
            <div className="space-y-3">
              {district.groups.map((group, groupIndex) => (
                <Card key={groupIndex} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{group.name}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          <TrendingUp className="h-3 w-3 text-success" />
                          <span className="text-xs text-success font-medium">{group.growth} this month</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-lg font-bold">
                        {group.total}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      <div className="text-center">
                        <p className="text-lg font-bold text-success">{group.active}</p>
                        <p className="text-xs text-muted-foreground">Active</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-muted-foreground">{group.inactive}</p>
                        <p className="text-xs text-muted-foreground">Inactive</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-blue-500">{group.abroad}</p>
                        <p className="text-xs text-muted-foreground">Abroad</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-orange-500">{group.applicant}</p>
                        <p className="text-xs text-muted-foreground">Applicant</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-primary">{group.total}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </main>

      <BottomNav />
    </div>
  );
};

export default MembersGroupReport;
