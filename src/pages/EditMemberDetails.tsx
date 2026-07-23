import { useEffect, useState } from "react";
import { ArrowLeft, Building2, MapPin, PencilLine, ShieldCheck, User } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { FormSkeleton } from "@/components/ui/loading-skeletons";
import { useToast } from "@/hooks/use-toast";
import { membersAPI, districtsAPI } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

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

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const MEMBER_STATUSES = ["Active", "Inactive", "Abroad", "Applicant", "Age over", "Dismissed"];

const EditMemberDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const { userRole } = useAuth();

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [districts, setDistricts] = useState<{ _id: string; name: string }[]>([]);
  const [groups, setGroups] = useState<{ _id: string; name: string }[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [loadingGroups, setLoadingGroups] = useState(false);
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

  // Fetch districts for state_admin
  useEffect(() => {
    if (userRole !== 'state_admin') return;
    const fetchDistricts = async () => {
      try {
        const result = await districtsAPI.getDistricts();
        if (result?.data) setDistricts(result.data);
      } catch (error) {
        console.error('Failed to fetch districts:', error);
      }
    };
    fetchDistricts();
  }, [userRole]);

  // Fetch groups when district changes
  useEffect(() => {
    if (!selectedDistrict) { setGroups([]); return; }
    const fetchGroups = async () => {
      setLoadingGroups(true);
      try {
        const result = await districtsAPI.getDistrictGroups(selectedDistrict);
        if (result?.data) setGroups(result.data);
      } catch (error) {
        console.error('Failed to fetch groups:', error);
      } finally {
        setLoadingGroups(false);
      }
    };
    fetchGroups();
  }, [selectedDistrict]);

  // Fetch member data
  useEffect(() => {
    const fetchMember = async () => {
      try {
        const result = await membersAPI.getMember(id!);
        
        if (result && result.data) {
          const memberData = result.data;
          setMember(memberData);
          setSelectedDistrict(memberData.district?._id || "");
          setSelectedGroup(memberData.group?._id || "");

          // Format date for the <input type="date"> field. Stored values that fall outside
          // the 0000-9999 year range (a known data-corruption artifact from old migrations)
          // serialise to extended ISO like "+031227-12-31T18:30:00.000Z", which the native
          // date input cannot render and `isISO8601()` rejects. Strip those to "" so we
          // never re-send a value that will trip the backend validator on save.
          const dobRaw = memberData.dateOfBirth
            ? String(memberData.dateOfBirth).split('T')[0]
            : "";
          // Native date input only accepts YYYY-MM-DD with a 4-digit year.
          const dobForInput = /^\d{4}-\d{2}-\d{2}$/.test(dobRaw) ? dobRaw : "";

          // Populate form with existing data
          setFormData({
            name: memberData.name || "",
            email: memberData.email || "",
            phone: memberData.phone ? memberData.phone.replace('+91', '') : "", // Remove +91 for editing
            address: memberData.address || "",
            status: memberData.status || "",
            dateOfBirth: dobForInput,
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

    if (!formData.name.trim() || !formData.phone.trim()) {
      toast({
        title: "Missing Required Fields",
        description: "Name and phone number are required before updating the member.",
        variant: "destructive"
      });
      return;
    }

    if (!/^[6-9]\d{9}$/.test(formData.phone)) {
      toast({
        title: "Invalid Phone Number",
        description: "Phone number must be 10 digits starting with 6, 7, 8, or 9",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);

    try {
      // Clean the form data - remove empty optional fields
      const cleanedData: any = { ...formData };
      if (!cleanedData.email) delete cleanedData.email;
      // Only forward a DOB that is a valid YYYY-MM-DD; anything else (including
      // corrupted stored values the input couldn't render) is dropped so the
      // backend's isISO8601() validator never trips.
      if (!cleanedData.dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(cleanedData.dateOfBirth)) {
        delete cleanedData.dateOfBirth;
      }
      if (!cleanedData.bloodGroup) delete cleanedData.bloodGroup;
      if (!cleanedData.profession) delete cleanedData.profession;
      if (!cleanedData.education) delete cleanedData.education;
      if (!cleanedData.address) delete cleanedData.address;
      if (!cleanedData.monthlyBaithulMaal) delete cleanedData.monthlyBaithulMaal;

      // Add district/group if state_admin changed them
      if (userRole === 'state_admin') {
        if (selectedDistrict && selectedDistrict !== member?.district?._id) {
          cleanedData.district = selectedDistrict;
        }
        if (selectedGroup && selectedGroup !== member?.group?._id) {
          cleanedData.group = selectedGroup;
        }
      }

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

  const renderMemberStatus = (status: string) => {
    if (status === "Active") {
      return (
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <span>{status}</span>
        </div>
      );
    }

    const classes =
      status === "Applicant"
        ? "bg-orange-100 text-orange-800"
        : status === "Abroad"
          ? "bg-blue-100 text-blue-800"
          : status === "Dismissed"
            ? "bg-red-100 text-red-700"
            : "bg-gray-100 text-gray-800";

    return <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${classes}`}>{status}</div>;
  };

  if (loading) {
    return (
      <PageShell>
        <PageHero
          title="Edit Member"
          subtitle="Loading the current member record before opening the edit form."
          eyebrow="Members"
          icon={<PencilLine className="h-6 w-6" />}
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate("/members")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Members
            </Button>
          }
        />
        <SectionCard title="Preparing Edit Form" description="Fetching member details and current organization mapping.">
          <FormSkeleton fields={6} />
        </SectionCard>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        title="Edit Member"
        subtitle={member?.name || "Update the member profile without changing their organization mapping."}
        eyebrow="Members"
        icon={<PencilLine className="h-6 w-6" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/members")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Members
          </Button>
        }
        details={
          <>
            <div className="min-w-[180px] flex-1 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</p>
              <div className="mt-2">{renderMemberStatus(formData.status || member?.status || "Unknown")}</div>
            </div>
            <div className="min-w-[180px] flex-1 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">District</p>
              <div className="mt-2 flex items-start gap-2 text-sm font-semibold text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="min-w-0 break-words leading-5">{member?.district?.name} ({member?.district?.code})</span>
              </div>
            </div>
            <div className="min-w-[180px] flex-1 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Group</p>
              <div className="mt-2 flex items-start gap-2 text-sm font-semibold text-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="min-w-0 break-words leading-5">{member?.group?.name} ({member?.group?.code})</span>
              </div>
            </div>
          </>
        }
      />

      <SectionCard title="Editable Profile" description="Update personal details, optional background information, and the current member status.">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
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
                  const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setFormData({ ...formData, phone: cleaned });
                }}
                required
              />
              {formData.phone && formData.phone.length !== 10 ? (
                <p className="text-xs text-destructive">Please enter 10 digits.</p>
              ) : null}
              {formData.phone && formData.phone.length === 10 && !/^[6-9]/.test(formData.phone) ? (
                <p className="text-xs text-destructive">Phone number must start with 6, 7, 8, or 9.</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
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
              <Select
                value={formData.bloodGroup || "none"}
                onValueChange={(val) => setFormData({ ...formData, bloodGroup: val === "none" ? "" : val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Blood Group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select Blood Group</SelectItem>
                  {BLOOD_GROUPS.map((bloodGroup) => (
                    <SelectItem key={bloodGroup} value={bloodGroup}>
                      {bloodGroup}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                placeholder="Enter monthly amount"
                min="0"
                step="1"
                value={formData.monthlyBaithulMaal}
                onChange={(e) => setFormData({ ...formData, monthlyBaithulMaal: e.target.value })}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address (Optional)</Label>
              <Textarea
                id="address"
                placeholder="Enter full address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={4}
                className="min-h-[110px] resize-y"
              />
            </div>
          </div>

          {userRole === 'state_admin' && (
            <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-foreground">Location (District & Group)</h3>
                <p className="text-sm text-muted-foreground">Change the member's district and group directly. Only state admins can do this.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>District</Label>
                  <Select
                    value={selectedDistrict}
                    onValueChange={(val) => {
                      setSelectedDistrict(val);
                      setSelectedGroup("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select District" />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map((d) => (
                        <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Group</Label>
                  <Select
                    value={selectedGroup}
                    onValueChange={setSelectedGroup}
                    disabled={!selectedDistrict || loadingGroups}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingGroups ? "Loading..." : "Select Group"} />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g._id} value={g._id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">Member Status</h3>
                <p className="text-sm text-muted-foreground">Update the current operating status for this member profile.</p>
              </div>
              {renderMemberStatus(formData.status || "Unknown")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val) => setFormData({ ...formData, status: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row">
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
      </SectionCard>
    </PageShell>
  );
};

export default EditMemberDetails;
