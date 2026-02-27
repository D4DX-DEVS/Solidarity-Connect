import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";
import { membersAPI, districtsAPI, groupsAPI } from "@/utils/api";

interface UserContext {
  userRole: string;
  canSelectDistrict: boolean;
  canSelectGroup: boolean;
  showDistrictField: boolean;
  showGroupField: boolean;
  assignedDistrict?: {
    _id: string;
    name: string;
    code: string;
  };
  assignedGroup?: {
    _id: string;
    name: string;
    code: string;
  };
  permissions: {
    canCreateMember: boolean;
    canEditMember: boolean;
    canDeleteMember: boolean;
    canApproveMember: boolean;
    canViewReports: boolean;
    canBulkImport: boolean;
  };
}

interface District {
  _id: string;
  name: string;
  code: string;
}

interface Group {
  _id: string;
  name: string;
  code: string;
  district: string;
}

const AddMember = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    district: "",
    group: "",
    email: "",
    dateOfBirth: "",
    bloodGroup: "",
    profession: "",
    education: "",
    address: "",
    monthlyBaithulMaal: "",
  });

  // Fetch user context and initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Fetch user context
        const contextResult = await membersAPI.getUserContext();
        
        if (contextResult && contextResult.data) {
          setUserContext(contextResult.data);

          // Auto-fill district and group for group admins
          if (contextResult.data.userRole === 'group_admin') {
            setFormData(prev => ({
              ...prev,
              district: contextResult.data.assignedDistrict?._id || '',
              group: contextResult.data.assignedGroup?._id || ''
            }));
          } else if (contextResult.data.userRole === 'district_admin') {
            setFormData(prev => ({
              ...prev,
              district: contextResult.data.assignedDistrict?._id || ''
            }));
          }

          // Fetch districts only if user can select district
          if (contextResult.data.canSelectDistrict) {
            const districtsResult = await districtsAPI.getDistricts({ limit: 100 });
            setDistricts(districtsResult.data || []);
          }
        } else {
          toast({
            title: "Error",
            description: "Failed to load user context",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
        toast({
          title: "Error",
          description: "Failed to load initial data",
          variant: "destructive"
        });
      } finally {
        setInitialLoading(false);
      }
    };

    fetchInitialData();
  }, [toast]);

  // Fetch groups when district changes
  useEffect(() => {
    if (formData.district && userContext?.canSelectGroup) {
      const fetchGroups = async () => {
        try {
          const token = localStorage.getItem('token');
          const result = await districtsAPI.getDistrictGroups(formData.district, { limit: 100 });
          setGroups(result.data || []);
        } catch (error) {
          console.error('Failed to fetch groups:', error);
        }
      };

      fetchGroups();
    }
  }, [formData.district, userContext]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number format
    if (!/^[6-9]\d{9}$/.test(formData.phone)) {
      toast({
        title: "Invalid Phone Number",
        description: "Phone number must be 10 digits starting with 6, 7, 8, or 9",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);

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
      
      console.log('Sending member data:', cleanedData);
      
      const result = await membersAPI.createMember(cleanedData);
      
      toast({
        title: "Success",
        description: "Member added successfully",
      });
      navigate("/members");
    } catch (error) {
      console.error('Failed to add member:', error);
      toast({
        title: "Error",
        description: "Failed to add member",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/members")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Add New Member</h1>
        </div>
      </header>

      <main className="p-4">
        <Card className="p-4 shadow-sm">
          {initialLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            </div>
          ) : !userContext?.permissions.canCreateMember ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">You don't have permission to add members.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Name *</label>
              <Input
                required
                placeholder="Enter full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Phone Number *</label>
              <Input
                type="tel"
                placeholder="9876543210"
                required
                maxLength={10}
                value={formData.phone}
                onChange={(e) => {
                  // Only allow digits and max 10 characters
                  const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setFormData({ ...formData, phone: cleaned });
                }}
              />
              {formData.phone && formData.phone.length !== 10 && (
                <p className="text-xs text-destructive mt-1">Please enter 10 digits</p>
              )}
              {formData.phone && formData.phone.length === 10 && !/^[6-9]/.test(formData.phone) && (
                <p className="text-xs text-destructive mt-1">Phone number must start with 6, 7, 8, or 9</p>
              )}
            </div>

            {userContext?.showDistrictField && (
              <div>
                <label className="text-sm font-medium mb-2 block">District *</label>
                {userContext.canSelectDistrict ? (
                  <select
                    required
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={formData.district}
                    onChange={(e) => {
                      setFormData({ ...formData, district: e.target.value, group: "" });
                      setGroups([]); // Clear groups when district changes
                    }}
                  >
                    <option value="">Select District</option>
                    {districts.map((district) => (
                      <option key={district._id} value={district._id}>
                        {district.name} ({district.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full px-3 py-2 border rounded-md bg-muted">
                    {userContext.assignedDistrict?.name} ({userContext.assignedDistrict?.code})
                  </div>
                )}
              </div>
            )}

            {userContext?.showGroupField && (
              <div>
                <label className="text-sm font-medium mb-2 block">Group *</label>
                {userContext.canSelectGroup ? (
                  <select
                    required
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    disabled={!formData.district}
                  >
                    <option value="">Select Group</option>
                    {groups.map((group) => (
                      <option key={group._id} value={group._id}>
                        {group.name} ({group.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full px-3 py-2 border rounded-md bg-muted">
                    {userContext.assignedGroup?.name} ({userContext.assignedGroup?.code})
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Email (Optional)</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Date of Birth</label>
              <Input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Blood Group (Optional)</label>
              <select
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

            <div>
              <label className="text-sm font-medium mb-2 block">Profession (Optional)</label>
              <Input
                placeholder="e.g. Engineer, Teacher"
                value={formData.profession}
                onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Education (Optional)</label>
              <Input
                placeholder="e.g. B.Tech, Masters"
                value={formData.education}
                onChange={(e) => setFormData({ ...formData, education: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Monthly Baithul Maal (Optional)</label>
              <Input
                type="number"
                placeholder="Enter monthly amount (e.g., 100)"
                min="0"
                step="1"
                value={formData.monthlyBaithulMaal}
                onChange={(e) => setFormData({ ...formData, monthlyBaithulMaal: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Address (Optional)</label>
              <Textarea
                placeholder="Enter full address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="min-h-[80px] resize-vertical"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/members")}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-success hover:bg-success/90"
                disabled={loading || !userContext?.permissions.canCreateMember}
              >
                {loading ? "Adding..." : "Add Member"}
              </Button>
            </div>
          </form>
          )}
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default AddMember;
