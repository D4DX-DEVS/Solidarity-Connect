import { useState } from "react";
import { Search, Users, Edit, Phone, ArrowRightLeft, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import TransferMemberDialog from "@/components/TransferMemberDialog";
import BaithulMaalDialog from "@/components/BaithulMaalDialog";
import RequestEditDialog from "@/components/RequestEditDialog";

const Members = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showBaithul, setShowBaithul] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const members = [
    {
      id: 1,
      name: "Abdullah nadeer",
      phone: "+919846058901",
      email: "No email",
      status: "Active",
      group: "Varantharappalli",
    },
    {
      id: 2,
      name: "Adhil Salim Noor",
      phone: "+918891323881",
      email: "No email",
      status: "Applicant",
      group: "Varantharappalli",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeaderWithLogout
        icon={<Users className="h-6 w-6 text-primary-foreground" />}
        title="Members"
      />

      <div className="p-4 pb-0 bg-card border-b">{/* Search container moved */}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2 mt-3">
          <select className="flex-1 px-3 py-2 border rounded-md text-sm bg-background">
            <option>All Members</option>
            <option>Active</option>
            <option>Applicant</option>
          </select>
          <select className="flex-1 px-3 py-2 border rounded-md text-sm bg-background">
            <option>All Statuses</option>
            <option>Active</option>
            <option>Inactive</option>
            <option>Abroad</option>
          </select>
        </div>
      </div>

      <main className="p-4 space-y-3">
        {members.map((member) => (
          <Card key={member.id} className="shadow-sm">
            <div className="p-4">
              <h3 className="font-semibold text-lg mb-1">{member.name}</h3>
              <p className="text-sm text-muted-foreground mb-1">{member.email}</p>
              <a href={`tel:${member.phone}`} className="text-sm text-primary flex items-center gap-1 mb-2">
                {member.phone}
                <Phone className="h-3 w-3" />
              </a>
              <Badge
                variant={member.status === "Active" ? "default" : "secondary"}
                className={member.status === "Active" ? "bg-success" : "bg-orange-100 text-orange-800"}
              >
                {member.status}
              </Badge>
              <p className="text-sm text-muted-foreground mt-2">{member.group}</p>

              <div className="grid grid-cols-4 gap-2 mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex flex-col items-center gap-1 h-auto py-2"
                  onClick={() => {
                    setSelectedMember(member);
                    setShowEdit(true);
                  }}
                >
                  <Edit className="h-5 w-5 text-primary" />
                  <span className="text-xs">Request Edit</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex flex-col items-center gap-1 h-auto py-2"
                >
                  <Phone className="h-5 w-5 text-primary" />
                  <span className="text-xs">Change Phone</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex flex-col items-center gap-1 h-auto py-2"
                  onClick={() => {
                    setSelectedMember(member);
                    setShowTransfer(true);
                  }}
                >
                  <ArrowRightLeft className="h-5 w-5 text-success" />
                  <span className="text-xs">Transfer Member</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex flex-col items-center gap-1 h-auto py-2"
                  onClick={() => {
                    setSelectedMember(member);
                    setShowBaithul(true);
                  }}
                >
                  <Wallet className="h-5 w-5 text-primary" />
                  <span className="text-xs">Baithul Maal</span>
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </main>

      <TransferMemberDialog
        open={showTransfer}
        onOpenChange={setShowTransfer}
        member={selectedMember}
      />
      <BaithulMaalDialog
        open={showBaithul}
        onOpenChange={setShowBaithul}
        member={selectedMember}
      />
      <RequestEditDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        member={selectedMember}
      />

      <BottomNav />
    </div>
  );
};

export default Members;
