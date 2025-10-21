import { useState } from "react";
import { ArrowLeft, Plus, Users, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const ManageGroups = () => {
  const navigate = useNavigate();
  const [selectedDistrict, setSelectedDistrict] = useState("Thrissur");

  const groups = [
    { id: 1, name: "Varantharappalli", members: 17, district: "Thrissur" },
    { id: 2, name: "Perumpilavu", members: 24, district: "Thrissur" },
    { id: 3, name: "Ollur", members: 19, district: "Thrissur" },
    { id: 4, name: "Chavakkad", members: 31, district: "Thrissur" },
  ];

  const filteredGroups = groups.filter(g => g.district === selectedDistrict);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Manage Groups</h1>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Select District</label>
          <select
            className="w-full px-3 py-2 border rounded-md bg-background"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
          >
            <option value="Thrissur">Thrissur</option>
            <option value="Malappuram">Malappuram</option>
            <option value="Kozhikode">Kozhikode</option>
            <option value="Kannur">Kannur</option>
          </select>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <Button className="w-full bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add New Group
        </Button>

        <div className="space-y-3">
          {filteredGroups.map((group) => (
            <Card key={group.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{group.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {group.members} Members
                      </p>
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

export default ManageGroups;
