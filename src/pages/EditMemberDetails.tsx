import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { membersAPI } from "@/utils/api";

interface Member {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  status: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  profession?: string;
  education?: string;
  baithulMaal?: {
    monthlyAmount: number;
    totalPaid: number;
  };
  district: {
    _id: string;
    name: string;
    code: string;
  };
  group: {
    _id: string;
    name: string;
    code: string;
  };
}

const EditMemberDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    status: "",
    dateOfBirth: "",
    bloodGroup: "",
    profession: "",
    education: "",
    monthlyBaithulMaal: "",
  });

  // Fetch member data
  useEffect(() => {
    const fetchMember = async () => {
      try {
        const token = localStorage.getItem('token');
        const result = await membersAPI.getMember(id!);
        
        if (result && result.data) {
          const memberData = result.data;
          setMember(memberData);
          
          // Populate form with existing data
          setFormData({
            name: memberData.name || "",
            email: memberData.email || "",
            phone: memberData.phone ? memberData.phone.replace('+91', '') : "", // Remove +91 for editing
            address: memberData.address || "",
            status: memberData.status || "",
            dateOfBirth: memberData.dateOfBirth ? memberData.dateOfBirth.split('T')[0] : "", // Format date for input
            bloodGroup: memberData.bloodGroup || "",
            profession: memberData.profession || "",
            education: memberData.education || "",
            monthlyBaithulMaal: memberData.baithulMaal?.monthlyAmount?.toString() || "",
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to fetch member details",
            variant: "destructive"
          });
          navigate("/members");
        }
      } catch (error) {
        console.error('Failed to fetch member:', error);
        toast({
          title: "Error",
          description: "Failed to load member details",
          variant: "destructive"
        });
        navigate("/members");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchMember();
    }
  }, [id, navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      
      // Clean the form data - remove empty optional fields
      const cleanedData = { ...formData };
      if (!cleanedData.email) delete cleanedData.email;
      if (!cleanedData.dateOfBirth) delete cleanedData.dateOfBirth;
      if (!cleanedData.bloodGroup) delete cleanedData.bloodGroup;
      if (!cleanedData.profession) delete cleanedData.profession;
      if (!cleanedData.education) delete cleanedData.education;
      if (!cleanedData.address) delete cleanedData.address;
      if (!cleanedData.monthlyBaithulMaal) delete cleanedData.monthlyBaithulMaal;

      console.log('Updating member with data:', cleanedData);

      const result = await membersAPI.updateMember(id!, cleanedData);
      
      if (result && result.success !== false) {
        toast({
          title: "Success",
          description: "Member updated successfully",
        });
        navigate("/members");
      } else {
        toast({
          title: "Error",
          description: result?.message || "Failed to update member",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Failed to update member:', error);
      toast({
        title: "Error",
        description: "Failed to update member",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="bg-card border-b px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/members")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Edit Member</h1>
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading member details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/members")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Edit Member</h1>
            <p className="text-sm text-muted-foreground">{member?.name}</p>
          </div>
        </div>
      </header>

      <main className="p-4">
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h3 className="font-semibold mb-3">Personal Details</h3>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      placeholder="Enter full name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="9876543210"
                      maxLength={10}
                      value={formData.phone}
                      onChange={(e) => {
                        // Only allow digits and max 10 characters
                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setFormData({ ...formData, phone: cleaned });
                      }}
                      required
                    />
                    {formData.phone && formData.phone.length !== 10 && (
                      <p className="text-xs text-destructive">Please enter 10 digits</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email (Optional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth (Optional)</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bloodGroup">Blood Group (Optional)</Label>
                    <select
                      id="bloodGroup"
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      value={formData.bloodGroup}
                      onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    >
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profession">Profession (Optional)</Label>
                    <Input
                      id="profession"
                      placeholder="e.g. Engineer, Teacher"
                      value={formData.profession}
                      onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="education">Education (Optional)</Label>
                    <Input
                      id="education"
                      placeholder="e.g. B.Tech, Masters"
                      value={formData.education}
                      onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monthlyBaithulMaal">Monthly Baithul Maal (Optional)</Label>
                    <Input
                      id="monthlyBaithulMaal"
                      type="number"
                      placeholder="Enter monthly amount (e.g., 100)"
                      min="0"
                      step="1"
                      value={formData.monthlyBaithulMaal}
                      onChange={(e) => setFormData({ ...formData, monthlyBaithulMaal: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address (Optional)</Label>
                    <Textarea
                      id="address"
                      placeholder="Enter full address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={3}
                      className="min-h-[80px] resize-vertical"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Status</h3>
                <div className="space-y-2">
                  <Label htmlFor="status">Member Status</Label>
                  <select
                    id="status"
                    className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Abroad">Abroad</option>
                    <option value="Applicant">Applicant</option>
                    <option value="Age over">Age over</option>
                    <option value="Dismissed">Dismissed</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/members")}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-success hover:bg-success/90"
                  disabled={saving}
                >
                  {saving ? "Updating..." : "Update Member"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EditMemberDetails;
