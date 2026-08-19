import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, MapPin, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { FormSkeleton } from "@/components/ui/loading-skeletons";
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

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const ROLE_LABELS: Record<string, string> = {
  state_admin: "State Admin",
  district_admin: "District Admin",
  group_admin: "Area Admin",
};

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
    isActive: true,
  });

  // Fetch user context and initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
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

    if (
      !formData.name.trim() ||
      !formData.phone.trim() ||
      (userContext?.showDistrictField && !formData.district) ||
      (userContext?.showGroupField && !formData.group)
    ) {
      toast({
        title: "Missing Required Fields",
        description: "Please complete the required member details before saving.",
        variant: "destructive"
      });
      return;
    }
    
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
      // Clean the form data - remove empty optional fields
      const cleanedData: Record<string, unknown> = { ...formData };
      if (!cleanedData.email) delete cleanedData.email;
      if (!cleanedData.dateOfBirth) delete cleanedData.dateOfBirth;
      if (!cleanedData.bloodGroup) delete cleanedData.bloodGroup;
      if (!cleanedData.profession) delete cleanedData.profession;
      if (!cleanedData.education) delete cleanedData.education;
      if (!cleanedData.address) delete cleanedData.address;
      if (!cleanedData.monthlyBaithulMaal) delete cleanedData.monthlyBaithulMaal;

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

  const roleLabel = userContext?.userRole ? ROLE_LABELS[userContext.userRole] || userContext.userRole : "Restricted";

  return (
    <PageShell>
      <PageHero
        title="Add New Member"
        subtitle="Create a member profile with the right district, group, and optional background details."
        eyebrow="Members"
        icon={<UserPlus className="h-6 w-6" />}
        details={
          <>
            <div className="hidden rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm md:block">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Access</p>
              <div className="mt-2 flex min-w-0 items-start gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span className="min-w-0 break-words leading-5">{roleLabel}</span>
              </div>
            </div>
            <div className="hidden rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm md:block">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">District</p>
              <div className="mt-2 flex min-w-0 items-start gap-2 text-sm font-semibold text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="min-w-0 break-words leading-5">{userContext?.assignedDistrict?.code || "Selectable"}</span>
              </div>
            </div>
            <div className="hidden rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm md:block">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Group</p>
              <div className="mt-2 flex min-w-0 items-start gap-2 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                <span className="min-w-0 break-words leading-5">{userContext?.assignedGroup?.code || "Selectable"}</span>
              </div>
            </div>
          </>
        }
      />

      <SectionCard
        title="Member Profile"
        description="Required details come first, followed by optional identity and contribution information."
      >
        {initialLoading ? (
          <FormSkeleton fields={6} />
        ) : !userContext?.permissions.canCreateMember ? (
          <div className="space-y-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
            <p className="text-sm font-medium text-foreground">You do not have permission to add members.</p>
            <p className="text-sm text-muted-foreground">Return to the members directory or switch to an account with member-creation access.</p>
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => navigate("/members")}>
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back to Members</span>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="member-name" className="text-sm font-medium text-foreground">Name *</label>
                <Input
                  id="member-name"
                  required
                  placeholder="Enter full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="member-phone" className="text-sm font-medium text-foreground">Phone Number *</label>
                <Input
                  id="member-phone"
                  type="tel"
                  placeholder="9876543210"
                  required
                  maxLength={10}
                  value={formData.phone}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setFormData({ ...formData, phone: cleaned });
                  }}
                />
                {formData.phone && formData.phone.length !== 10 ? (
                  <p className="text-xs text-destructive">Please enter 10 digits.</p>
                ) : null}
                {formData.phone && formData.phone.length === 10 && !/^[6-9]/.test(formData.phone) ? (
                  <p className="text-xs text-destructive">Phone number must start with 6, 7, 8, or 9.</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="member-email" className="text-sm font-medium text-foreground">Email (Optional)</label>
                <Input
                  id="member-email"
                  type="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              {userContext?.showDistrictField ? (
                <div className="space-y-2">
                  <label htmlFor="member-district" className="text-sm font-medium text-foreground">District *</label>
                  {userContext.canSelectDistrict ? (
                    <Select
                      value={formData.district || "placeholder"}
                      onValueChange={(val) => {
                        const v = val === "placeholder" ? "" : val;
                        setFormData({ ...formData, district: v, group: "" });
                        setGroups([]);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select district" />
                      </SelectTrigger>
                      <SelectContent>
                        {districts.map((district) => (
                          <SelectItem key={district._id} value={district._id}>
                            {district.name} ({district.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="data-strip flex items-center gap-2 text-sm text-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>{userContext.assignedDistrict?.name} ({userContext.assignedDistrict?.code})</span>
                    </div>
                  )}
                </div>
              ) : null}

              {userContext?.showGroupField ? (
                <div className="space-y-2">
                  <label htmlFor="member-group" className="text-sm font-medium text-foreground">Group *</label>
                  {userContext.canSelectGroup ? (
                    <Select
                      value={formData.group || "placeholder"}
                      onValueChange={(val) => setFormData({ ...formData, group: val === "placeholder" ? "" : val })}
                      disabled={!formData.district}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={formData.district ? "Select group" : "Select district first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group._id} value={group._id}>
                            {group.name} ({group.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="data-strip flex items-center gap-2 text-sm text-foreground">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span>{userContext.assignedGroup?.name} ({userContext.assignedGroup?.code})</span>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="space-y-2">
                <label htmlFor="member-dob" className="text-sm font-medium text-foreground">Date of Birth</label>
                <Input
                  id="member-dob"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="member-blood-group" className="text-sm font-medium text-foreground">Blood Group (Optional)</label>
                <Select
                  value={formData.bloodGroup || "none"}
                  onValueChange={(val) => setFormData({ ...formData, bloodGroup: val === "none" ? "" : val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select blood group</SelectItem>
                    {BLOOD_GROUPS.map((bloodGroup) => (
                      <SelectItem key={bloodGroup} value={bloodGroup}>
                        {bloodGroup}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="member-profession" className="text-sm font-medium text-foreground">Profession (Optional)</label>
                <Input
                  id="member-profession"
                  placeholder="e.g. Engineer, Teacher"
                  value={formData.profession}
                  onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="member-education" className="text-sm font-medium text-foreground">Education (Optional)</label>
                <Input
                  id="member-education"
                  placeholder="e.g. B.Tech, Masters"
                  value={formData.education}
                  onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="member-baithul" className="text-sm font-medium text-foreground">Monthly Baithul Maal (Optional)</label>
                <Input
                  id="member-baithul"
                  type="number"
                  placeholder="Enter monthly amount"
                  min="0"
                  step="1"
                  value={formData.monthlyBaithulMaal}
                  onChange={(e) => setFormData({ ...formData, monthlyBaithulMaal: e.target.value })}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="member-address" className="text-sm font-medium text-foreground">Address (Optional)</label>
                <Textarea
                  id="member-address"
                  placeholder="Enter full address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={4}
                  className="min-h-[110px] resize-y"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Member Status</p>
                    <p className="text-xs text-muted-foreground">
                      {formData.isActive ? "Active — member is visible and included in reports" : "Inactive — member is hidden from active lists"}
                    </p>
                  </div>
                  <Switch
                    id="member-active"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-border/60 pt-5">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/members")} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-success hover:bg-success/90"
                disabled={loading || !userContext?.permissions.canCreateMember}
              >
                {loading ? (
                  <>
                    <span className="mr-2 inline-flex h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                    Adding Member...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Member
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </SectionCard>
    </PageShell>
  );
};

export default AddMember;
