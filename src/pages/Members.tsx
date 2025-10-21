import { useState } from "react";
import { Search, Users, Edit, Phone, ArrowRightLeft, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import TransferMemberDialog from "@/components/TransferMemberDialog";
import BaithulMaalDialog from "@/components/BaithulMaalDialog";
import RequestEditDialog from "@/components/RequestEditDialog";
import { useAuth } from "@/contexts/AuthContext";

const Members = () => {
  const navigate = useNavigate();
  const { userRole, userDistrict, userGroup } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showBaithul, setShowBaithul] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const allMembers = [
    {
      id: 1,
      name: "Abdullah nadeer",
      phone: "+919846058901",
      email: "No email",
      status: "Active",
      group: "Varantharappalli",
      district: "Thrissur",
    },
    {
      id: 2,
      name: "Adhil Salim Noor",
      phone: "+918891323881",
      email: "No email",
      status: "Applicant",
      group: "Varantharappalli",
      district: "Thrissur",
    },
    {
      id: 3,
      name: "Mohammed Ali",
      phone: "+919876543210",
      email: "mohammed@example.com",
      status: "Active",
      group: "Perumpilavu",
      district: "Thrissur",
    },
    {
      id: 4,
      name: "Ahmed Hassan",
      phone: "+919123456789",
      email: "ahmed@example.com",
      status: "Abroad",
      group: "Varantharappalli",
      district: "Thrissur",
    },
    {
      id: 5,
      name: "Ibrahim Khan",
      phone: "+919998887776",
      email: "No email",
      status: "Inactive",
      group: "Perumpilavu",
      district: "Thrissur",
    },
    {
      id: 6,
      name: "Yusuf Ahmed",
      phone: "+919887776665",
      email: "yusuf@example.com",
      status: "Active",
      group: "Manjeri",
      district: "Malappuram",
    },
    {
      id: 7,
      name: "Ismail Rahman",
      phone: "+919776665554",
      email: "No email",
      status: "Active",
      group: "Manjeri",
      district: "Malappuram",
    },
  ];

  // Filter members based on user role
  let members = allMembers;

  if (userRole === "group_admin" && userGroup) {
    // Group admin sees only their group
    members = allMembers.filter(m => m.group === userGroup);
  } else if (userRole === "district_admin" && userDistrict) {
    // District admin sees only their district
    members = allMembers.filter(m => m.district === userDistrict);
  }
  // State admin sees all members (no filter)

  // Apply additional filters
  const filteredMembers = members.filter(member => {
    const matchesSearch = 
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phone.includes(searchQuery) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDistrict = !selectedDistrict || member.district === selectedDistrict;
    const matchesGroup = !selectedGroup || member.group === selectedGroup;
    const matchesStatus = !selectedStatus || member.status === selectedStatus;

    return matchesSearch && matchesDistrict && matchesGroup && matchesStatus;
  });

  // Calculate status counts based on filtered members
  const statusCounts = {
    total: members.length,
    active: members.filter(m => m.status === "Active").length,
    inactive: members.filter(m => m.status === "Inactive").length,
    abroad: members.filter(m => m.status === "Abroad").length,
    applicant: members.filter(m => m.status === "Applicant").length,
    ageOver: members.filter(m => m.status === "Age over").length,
    dismissed: members.filter(m => m.status === "Dismissed").length,
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeaderWithLogout
        icon={<Users className="h-6 w-6 text-primary-foreground" />}
        title="Members"
      />

      <div className="p-4 pb-0 bg-card border-b">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="space-y-2 mb-3">
          {(userRole === "state_admin" || userRole === "district_admin") && (
            <select 
              className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
            >
              <option value="">All Districts</option>
              <option value="Thrissur">Thrissur</option>
              <option value="Malappuram">Malappuram</option>
              <option value="Kozhikode">Kozhikode</option>
            </select>
          )}
          
          <div className="grid grid-cols-2 gap-2">
            <select 
              className="px-3 py-2 border rounded-md text-sm bg-background"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              <option value="">All Groups</option>
              <option value="Varantharappalli">Varantharappalli</option>
              <option value="Perumpilavu">Perumpilavu</option>
            </select>
            <select 
              className="px-3 py-2 border rounded-md text-sm bg-background"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Abroad">Abroad</option>
              <option value="Applicant">Applicant</option>
              <option value="Age over">Age over</option>
              <option value="Dismissed">Dismissed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Status Count Cards */}
      <div className="p-4 pb-0">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Card className="shadow-sm">
            <div className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{statusCounts.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </Card>
          <Card className="shadow-sm">
            <div className="p-3 text-center">
              <p className="text-2xl font-bold text-success">{statusCounts.active}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </Card>
          <Card className="shadow-sm">
            <div className="p-3 text-center">
              <p className="text-2xl font-bold text-orange-500">{statusCounts.applicant}</p>
              <p className="text-xs text-muted-foreground">Applicant</p>
            </div>
          </Card>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-4">
          <Card className="shadow-sm">
            <div className="p-2 text-center">
              <p className="text-lg font-bold text-muted-foreground">{statusCounts.inactive}</p>
              <p className="text-xs text-muted-foreground">Inactive</p>
            </div>
          </Card>
          <Card className="shadow-sm">
            <div className="p-2 text-center">
              <p className="text-lg font-bold text-blue-500">{statusCounts.abroad}</p>
              <p className="text-xs text-muted-foreground">Abroad</p>
            </div>
          </Card>
          <Card className="shadow-sm">
            <div className="p-2 text-center">
              <p className="text-lg font-bold text-muted-foreground">{statusCounts.ageOver}</p>
              <p className="text-xs text-muted-foreground">Age over</p>
            </div>
          </Card>
          <Card className="shadow-sm">
            <div className="p-2 text-center">
              <p className="text-lg font-bold text-destructive">{statusCounts.dismissed}</p>
              <p className="text-xs text-muted-foreground">Dismissed</p>
            </div>
          </Card>
        </div>
      </div>

      <main className="p-4 space-y-3">
        {filteredMembers.map((member) => (
          <Card key={member.id} className="shadow-sm cursor-pointer hover:shadow-md transition-shadow">
            <div 
              className="p-4"
              onClick={() => navigate(`/member/${member.id}`)}
            >
              <h3 className="font-semibold text-lg mb-1">{member.name}</h3>
              <p className="text-sm text-muted-foreground mb-1">{member.email}</p>
              <a 
                href={`tel:${member.phone}`} 
                className="text-sm text-primary flex items-center gap-1 mb-2"
                onClick={(e) => e.stopPropagation()}
              >
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
