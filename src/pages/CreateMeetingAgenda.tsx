import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateMonthlyMeeting } from "@/hooks/useMeetings";
import { CreateMonthlyMeetingData, SessionData } from "@/lib/meetings";

const CreateMeetingAgenda = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, user, userRole } = useAuth();
  const createMonthlyMeeting = useCreateMonthlyMeeting();

  // Hardcoded options
  const monthOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const yearOptions = [
    { value: 2025, label: '2025' },
    { value: 2026, label: '2026' }
  ];

  const [formData, setFormData] = useState<CreateMonthlyMeetingData>({
    title: "",
    description: "",
    month: new Date().getMonth() + 1, // Current month as default
    year: 2025, // Default to 2025
    sessions: [], // Optional sessions array
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Check authentication and permissions
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

    if (userRole && !['state_admin', 'district_admin'].includes(userRole)) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to create meetings.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }
  }, [isAuthenticated, userRole, navigate, toast]);



  const handleInputChange = (field: keyof CreateMonthlyMeetingData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addSession = () => {
    const newSession: SessionData = {
      title: "",
      description: "",
      duration: 60,
    };
    setFormData(prev => ({
      ...prev,
      sessions: [...(prev.sessions || []), newSession],
    }));
  };

  const removeSession = (index: number) => {
    setFormData(prev => ({
      ...prev,
      sessions: (prev.sessions || []).filter((_, i) => i !== index),
    }));
  };

  const updateSession = (index: number, field: keyof SessionData, value: any) => {
    setFormData(prev => ({
      ...prev,
      sessions: (prev.sessions || []).map((session, i) => 
        i === index ? { ...session, [field]: value } : session
      ),
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 10MB.",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Debug: Log form data and auth status
    console.log('Form data being submitted:', formData);
    console.log('Title:', formData.title);
    console.log('Description:', formData.description);
    console.log('Month:', formData.month);
    console.log('Year:', formData.year);
    console.log('User authenticated:', isAuthenticated);
    console.log('User role:', userRole);
    console.log('User info:', user);
    console.log('Token in localStorage:', localStorage.getItem('token') ? 'Present' : 'Missing');

    // Validate required fields
    if (!formData.title || !formData.description) {
      toast({
        title: "Missing Information",
        description: `Please fill in title and description. Current values: title="${formData.title}", description="${formData.description}"`,
        variant: "destructive",
      });
      return;
    }

    // Validate sessions (only if sessions exist)
    for (let i = 0; i < (formData.sessions || []).length; i++) {
      const session = (formData.sessions || [])[i];
      if (!session.title) {
        toast({
          title: "Incomplete Session",
          description: `Please enter title for session ${i + 1}.`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      await createMonthlyMeeting.mutateAsync({
        ...formData,
        file: selectedFile,
      });
      toast({
        title: "Monthly Meeting Created",
        description: "Monthly meeting with sessions has been created successfully.",
      });
      navigate("/state-admin/meeting-agenda");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create monthly meeting.",
        variant: "destructive",
      });
    }
  };

  // Show loading state for authentication only
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="bg-card border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/state-admin/meeting-agenda")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Create Monthly Meeting</h1>
        </div>
      </header>

      <main className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Meeting Information */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Meeting Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Meeting Title *</label>
                <Input
                  required
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="e.g. Monthly State Meeting"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description *</label>
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
                  <label className="text-sm font-medium mb-2 block">Month *</label>
                  <Select
                    value={formData.month.toString()}
                    onValueChange={(value) => handleInputChange("month", parseInt(value))}
                  >
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
                  <label className="text-sm font-medium mb-2 block">Year *</label>
                  <Select
                    value={formData.year.toString()}
                    onValueChange={(value) => handleInputChange("year", parseInt(value))}
                  >
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

              <div>
                <label className="text-sm font-medium mb-2 block">Upload File (Optional)</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.ppt,.pptx,.jpg,.jpeg,.png,.gif"
                    className="flex-1"
                  />
                  {selectedFile && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sessions */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Sessions</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSession}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Session
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {(formData.sessions || []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sessions added yet. Click "Add Session" to get started.</p>
                </div>
              ) : (
                (formData.sessions || []).map((session, index) => (
                  <Card key={index} className="border-l-4 border-l-primary">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Session {index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSession(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium mb-1 block">Session Title *</label>
                          <Input
                            required
                            value={session.title}
                            onChange={(e) => updateSession(index, "title", e.target.value)}
                            placeholder="e.g. Leadership Fundamentals"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-1 block">Description</label>
                          <Textarea
                            value={session.description}
                            onChange={(e) => updateSession(index, "description", e.target.value)}
                            placeholder="Session description"
                            rows={2}
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-1 block">Duration (minutes)</label>
                          <Input
                            type="number"
                            min="30"
                            max="240"
                            value={session.duration}
                            onChange={(e) => updateSession(index, "duration", parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/state-admin/meeting-agenda")}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-primary hover:bg-primary/90"
              disabled={createMonthlyMeeting.isPending}
            >
              <Calendar className="h-4 w-4 mr-2" />
              {createMonthlyMeeting.isPending ? "Creating..." : "Create Monthly Meeting"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default CreateMeetingAgenda;
