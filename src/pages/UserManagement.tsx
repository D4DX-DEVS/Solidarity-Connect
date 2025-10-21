import { useState } from "react";
import { ArrowLeft, Users, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

const UserManagement = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    status: [],
    district: [],
    group: [],
  });

  const users = [
    { id: 1, name: "Abdullah nadeer", phone: "+919846058901", status: "Active", district: "Thrissur", group: "Varantharappalli" },
    { id: 2, name: "Adhil Salim Noor", phone: "+918891323881", status: "Active", district: "Thrissur", group: "Varantharappalli" },
    { id: 3, name: "Mohammed Ali", phone: "+919876543210", status: "Inactive", district: "Malappuram", group: "Manjeri" },
    { id: 4, name: "Ahmed Hassan", phone: "+919123456789", status: "Abroad", district: "Thrissur", group: "Perumpilavu" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">User Management</h1>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select className="px-3 py-2 border rounded-md text-sm bg-background">
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Abroad">Abroad</option>
            <option value="Age over">Age over</option>
            <option value="Dismissed">Dismissed</option>
          </select>
          <select className="px-3 py-2 border rounded-md text-sm bg-background">
            <option value="">All Districts</option>
            <option value="Thrissur">Thrissur</option>
            <option value="Malappuram">Malappuram</option>
            <option value="Kozhikode">Kozhikode</option>
          </select>
        </div>
      </header>

      <main className="p-4 space-y-3">
        {users.map((user) => (
          <Card key={user.id} className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{user.name}</h3>
                  <p className="text-sm text-muted-foreground">{user.phone}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge
                      variant={user.status === "Active" ? "default" : "secondary"}
                      className={user.status === "Active" ? "bg-success" : ""}
                    >
                      {user.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {user.district} • {user.group}
                  </p>
                </div>
                <Button size="sm" variant="outline">
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
};

export default UserManagement;
