import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { FormSkeleton } from "@/components/ui/loading-skeletons";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateMonthlyMeeting } from "@/hooks/useMeetings";
import { useDistricts } from "@/hooks/useDistricts";
import { District } from "@/lib/districts";
import { CreateMonthlyMeetingData, SessionData } from "@/lib/meetings";

// Mounted only for state admins so district admins never hit the districts API
const TargetDistrictsPicker = ({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (districtId: string) => void;
}) => {
  const { data: districtsResponse, isLoading } = useDistricts({ sort: "name", isActive: true });
  const districts: District[] = (districtsResponse?.data as District[]) ?? [];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading districts...</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {districts.map((district) => (
        <label
          key={district._id}
          className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm"
        >
          <Checkbox
            checked={selected.includes(district._id)}
            onCheckedChange={() => onToggle(district._id)}
          />
          <span className="truncate">{district.name}</span>
        </label>
      ))}
    </div>
  );
};

const CreateMeetingAgenda = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, userRole } = useAuth();
  const createMonthlyMeeting = useCreateMonthlyMeeting();

  const monthOptions = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const yearOptions = [
    { value: 2025, label: "2025" },
    { value: 2026, label: "2026" },
  ];

  const [formData, setFormData] = useState<CreateMonthlyMeetingData>({
    title: "",
    description: "",
    month: new Date().getMonth() + 1,
    year: 2025,
    sessions: [],
    targetAudience: "all",
    targetDistricts: [],
  });

  const toggleTargetDistrict = (districtId: string) => {
    setFormData((prev) => {
      const current = prev.targetDistricts || [];
      return {
        ...prev,
        targetDistricts: current.includes(districtId)
          ? current.filter((id) => id !== districtId)
          : [...current, districtId],
      };
    });
  };
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to access this page.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    if (userRole && !["state_admin", "district_admin"].includes(userRole)) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to create meetings.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [isAuthenticated, navigate, toast, userRole]);

  const handleInputChange = (
    field: keyof CreateMonthlyMeetingData,
    value: CreateMonthlyMeetingData[keyof CreateMonthlyMeetingData],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addSession = () => {
    const newSession: SessionData = {
      title: "",
      description: "",
      duration: 60,
    };

    setFormData((prev) => ({
      ...prev,
      sessions: [...(prev.sessions || []), newSession],
    }));
  };

  const removeSession = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      sessions: (prev.sessions || []).filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const updateSession = (
    index: number,
    field: keyof SessionData,
    value: SessionData[keyof SessionData],
  ) => {
    setFormData((prev) => ({
      ...prev,
      sessions: (prev.sessions || []).map((session, currentIndex) => (
        currentIndex === index ? { ...session, [field]: value } : session
      )),
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 10MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description) {
      toast({
        title: "Missing Information",
        description: `Please fill in title and description. Current values: title="${formData.title}", description="${formData.description}"`,
        variant: "destructive",
      });
      return;
    }

    if (
      userRole === "state_admin" &&
      formData.targetAudience === "specific_districts" &&
      (formData.targetDistricts || []).length === 0
    ) {
      toast({
        title: "No Districts Selected",
        description: "Select at least one district for a district-specific meeting.",
        variant: "destructive",
      });
      return;
    }

    if ((formData.sessions || []).length === 0) {
      toast({
        title: "No Sessions Added",
        description: "Add at least one session — progress cannot be tracked without sessions.",
        variant: "destructive",
      });
      return;
    }

    for (let index = 0; index < (formData.sessions || []).length; index += 1) {
      const session = (formData.sessions || [])[index];
      if (!session.title) {
        toast({
          title: "Incomplete Session",
          description: `Please enter title for session ${index + 1}.`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      await createMonthlyMeeting.mutateAsync({
        ...formData,
        // District admins are force-scoped to their own district by the backend
        targetAudience: userRole === "state_admin" ? formData.targetAudience : undefined,
        file: selectedFile,
      });
      toast({
        title: "Monthly Meeting Created",
        description: "Monthly meeting with sessions has been created successfully.",
      });
      navigate("/state-admin/meeting-agenda");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create monthly meeting.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <PageShell>
        <PageHero
          title="Create Monthly Meeting"
          subtitle="Prepare the monthly agenda, sessions, and supporting file."
          eyebrow="Meetings"
          icon={<Calendar className="h-6 w-6" />}
        />
        <SectionCard title="Checking Access" description="Verifying your authentication and permissions.">
          <FormSkeleton fields={3} />
        </SectionCard>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        title="Create Monthly Meeting"
        subtitle="Prepare the monthly agenda, sessions, and supporting file."
        eyebrow="Meetings"
        icon={<Calendar className="h-6 w-6" />}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <SectionCard title="Meeting Information" description="Define the monthly meeting basics and optionally attach a supporting file.">
          <div>
            <label className="mb-2 block text-sm font-medium">Meeting Title *</label>
            <Input
              required
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="e.g. Monthly State Meeting"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Description *</label>
            <Textarea
              required
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Meeting description and agenda details"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Month *</label>
              <Select value={formData.month.toString()} onValueChange={(value) => handleInputChange("month", parseInt(value, 10))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Year *</label>
              <Select value={formData.year.toString()} onValueChange={(value) => handleInputChange("year", parseInt(value, 10))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year.value} value={year.value.toString()}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {userRole === "state_admin" ? (
            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-sm font-medium">Target Audience *</label>
                <Select
                  value={formData.targetAudience}
                  onValueChange={(value) =>
                    handleInputChange("targetAudience", value as CreateMonthlyMeetingData["targetAudience"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everyone (all districts)</SelectItem>
                    <SelectItem value="district_admins">District Admins Only</SelectItem>
                    <SelectItem value="specific_districts">Specific Districts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.targetAudience === "specific_districts" && (
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Districts * ({(formData.targetDistricts || []).length} selected)
                  </label>
                  <TargetDistrictsPicker
                    selected={formData.targetDistricts || []}
                    onToggle={toggleTargetDistrict}
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              This meeting will be visible only to your district's area admins and members.
            </p>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium">Upload File (Optional)</label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.ppt,.pptx,.jpg,.jpeg,.png,.gif"
                className="flex-1"
              />
              {selectedFile && (
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedFile(null)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {selectedFile && (
              <p className="mt-1 text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Sessions"
          description="Add session blocks for the monthly series and fill in each title, notes, and duration."
          action={
            <Button type="button" variant="outline" size="sm" onClick={addSession}>
              <Plus className="mr-2 h-4 w-4" />
              Add Session
            </Button>
          }
        >
          {(formData.sessions || []).length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No sessions added yet. Click "Add Session" to get started.</p>
            </div>
          ) : (
            (formData.sessions || []).map((session, index) => (
              <Card key={index} className="surface-card border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="font-medium">Session {index + 1}</h4>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeSession(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Session Title *</label>
                      <Input
                        required
                        value={session.title}
                        onChange={(e) => updateSession(index, "title", e.target.value)}
                        placeholder="e.g. Leadership Fundamentals"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Description</label>
                      <Textarea
                        value={session.description}
                        onChange={(e) => updateSession(index, "description", e.target.value)}
                        placeholder="Session description"
                        rows={2}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Duration (minutes)</label>
                      <Input
                        type="number"
                        min="30"
                        max="240"
                        value={session.duration}
                        onChange={(e) => updateSession(index, "duration", parseInt(e.target.value, 10))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </SectionCard>

        <SectionCard title="Actions" description="Save the monthly meeting or return to the agenda list.">
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/state-admin/meeting-agenda")}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={createMonthlyMeeting.isPending}>
              <Calendar className="mr-2 h-4 w-4" />
              {createMonthlyMeeting.isPending ? "Creating..." : "Create Monthly Meeting"}
            </Button>
          </div>
        </SectionCard>
      </form>
    </PageShell>
  );
};

export default CreateMeetingAgenda;
