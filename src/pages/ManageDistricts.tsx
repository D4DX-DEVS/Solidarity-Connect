import { ArrowLeft, Plus, Building2, Users, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const ManageDistricts = () => {
  const navigate = useNavigate();

  const districts = [
    { id: 1, name: "Thrissur", groups: 8, members: 142 },
    { id: 2, name: "Malappuram", groups: 12, members: 235 },
    { id: 3, name: "Kozhikode", groups: 10, members: 198 },
    { id: 4, name: "Kannur", groups: 6, members: 95 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Manage Districts</h1>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <Button className="w-full bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add New District
        </Button>

        <div className="space-y-3">
          {districts.map((district) => (
            <Card key={district.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{district.name}</h3>
                      <div className="flex gap-4 mt-1">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{district.groups} Groups</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{district.members} Members</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default ManageDistricts;
