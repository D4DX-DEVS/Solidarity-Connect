import { Users, CheckCircle, Clock, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import BottomNav from "@/components/BottomNav";
import logo from "@/assets/logo.png";

const Dashboard = () => {
  const stats = [
    { label: "Total Members", value: "17", icon: Users, color: "text-primary" },
    { label: "Active Members", value: "3", icon: CheckCircle, color: "text-success" },
    { label: "Pending Requests", value: "0", icon: Clock, color: "text-destructive" },
    { label: "Pending Meetings", value: "4", icon: Calendar, color: "text-foreground" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Users className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Murabbi Panel</h1>
            <p className="text-sm text-muted-foreground">Applicant - Thrissur</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, index) => (
            <Card key={index} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h2 className="font-semibold mb-2">Murabbi Actions</h2>
            <p className="text-sm text-muted-foreground">
              Manage your members, track attendance, and handle requests efficiently.
            </p>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
