import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit, Phone, Mail, Calendar, Droplet, Briefcase, GraduationCap, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MemberDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  // Mock member data - in real app, fetch by id
  const member = {
    id: 1,
    name: "Abdullah nadeer",
    phone: "+919846058901",
    email: "abdullah.nadeer@example.com",
    status: "Active",
    group: "Varantharappalli",
    district: "Thrissur",
    dateOfBirth: "1990-05-15",
    age: 35,
    bloodGroup: "A+",
    profession: "Software Engineer",
    education: "B.Tech Computer Science",
    address: "House No. 123, Varantharappalli, Thrissur",
    baithulMaalAmount: 50,
    joinedDate: "2020-01-15",
    lastActive: "2025-10-20",
  };

  const InfoRow = ({ icon: Icon, label, value }: any) => (
    <div className="flex items-start gap-3 py-3 border-b last:border-b-0">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium">{value || "Not provided"}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="bg-card border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/members")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Member Details</h1>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Header Card */}
        <Card className="shadow-sm">
          <CardContent className="p-6 text-center">
            <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{member.name}</h2>
            <Badge
              variant={member.status === "Active" ? "default" : "secondary"}
              className={member.status === "Active" ? "bg-success" : ""}
            >
              {member.status}
            </Badge>
            <div className="flex items-center justify-center gap-4 mt-4">
              <a href={`tel:${member.phone}`}>
                <Button size="sm" variant="outline">
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
              </a>
              {member.email && (
                <a href={`mailto:${member.email}`}>
                  <Button size="sm" variant="outline">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Contact Information</h3>
            <InfoRow icon={Phone} label="Phone Number" value={member.phone} />
            <InfoRow icon={Mail} label="Email" value={member.email} />
            <InfoRow icon={MapPin} label="Address" value={member.address} />
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Personal Information</h3>
            <InfoRow icon={Calendar} label="Date of Birth" value={member.dateOfBirth} />
            <InfoRow icon={User} label="Age" value={`${member.age} years`} />
            <InfoRow icon={Droplet} label="Blood Group" value={member.bloodGroup} />
          </CardContent>
        </Card>

        {/* Professional Information */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Professional Information</h3>
            <InfoRow icon={Briefcase} label="Profession" value={member.profession} />
            <InfoRow icon={GraduationCap} label="Education" value={member.education} />
          </CardContent>
        </Card>

        {/* Organization Information */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Organization Details</h3>
            <InfoRow icon={MapPin} label="District" value={member.district} />
            <InfoRow icon={User} label="Group" value={member.group} />
            <InfoRow icon={Calendar} label="Joined Date" value={member.joinedDate} />
            <InfoRow icon={Calendar} label="Last Active" value={member.lastActive} />
          </CardContent>
        </Card>

        {/* Financial Information */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Baithul Maal</h3>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Monthly Amount</span>
              <span className="text-lg font-bold text-primary">₹{member.baithulMaalAmount}</span>
            </div>
          </CardContent>
        </Card>

        {/* Action Button */}
        <Button
          onClick={() => navigate(`/members`)}
          className="w-full bg-primary hover:bg-primary/90"
        >
          <Edit className="h-4 w-4 mr-2" />
          Request Edit
        </Button>
      </main>
    </div>
  );
};

export default MemberDetail;
