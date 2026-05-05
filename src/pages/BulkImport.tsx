import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiCall, districtsAPI, groupsAPI } from "@/utils/api";

const formSelectClassName = "w-full rounded-[1rem] border border-border/70 bg-background px-4 py-3 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

const BulkImport = () => {
  const navigate = useNavigate();
  const { userRole, user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [district, setDistrict] = useState("");
  const [group, setGroup] = useState("");
  const [uploading, setUploading] = useState(false);
  const [districts, setDistricts] = useState<{ _id: string; name: string }[]>([]);
  const [groups, setGroups] = useState<{ _id: string; name: string }[]>([]);

  useEffect(() => {
    if (userRole === "state_admin" || userRole === "district_admin") {
      districtsAPI.getDistricts({ limit: 100, isActive: true }).then((res: any) => {
        setDistricts(res.data || []);
        // Auto-select district for district_admin
        if (userRole === "district_admin" && user?.district?._id) {
          setDistrict(user.district._id);
        }
      }).catch(() => {});
    } else if (userRole === "group_admin" && user?.group?._id) {
      // Auto-set for group_admin
      setDistrict(user.district?._id || "");
      setGroup(user.group._id);
    }
  }, [userRole, user]);

  useEffect(() => {
    if (district) {
      groupsAPI.getGroups({ district, limit: 200, isActive: true }).then((res: any) => {
        setGroups(res.data || []);
      }).catch(() => {});
    } else {
      setGroups([]);
    }
  }, [district]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Invalid File",
          description: "Please upload a CSV file only.",
          variant: "destructive",
        });
      }
    }
  };

  const handleDownloadTemplate = () => {
    // CSV template structure
    const csvContent = `Name,Phone Number,Email,Date of Birth,Blood Group,Profession,Education,Status
Abdullah Nadeer,+919846058901,email@example.com,1990-01-15,A+,Engineer,Masters,Active
Adhil Salim Noor,+918891323881,,1995-05-20,B+,Teacher,Bachelors,Active`;

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "members_import_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "Use this template to format your member data.",
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to upload.",
        variant: "destructive",
      });
      return;
    }

    if (!district || !group) {
      toast({
        title: "Missing Selection",
        description: "Please select both a district and group for import.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("csvFile", selectedFile);
      formData.append("district", district);
      formData.append("group", group);

      const token = localStorage.getItem("token");
      const API_BASE_URL = import.meta.env.VITE_API_URL || "https://solidarity-app-api-erv6h.ondigitalocean.app/api";
      const response = await fetch(`${API_BASE_URL}/bulk-import/members`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Import failed");
      }

      toast({
        title: "Import Successful",
        description: `${result.data?.imported || 0} members imported. ${result.data?.skipped || 0} skipped.`,
      });
      navigate("/members");
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import members",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <PageShell>
      <PageHero
        title="Bulk Import Members"
        subtitle="Upload a CSV, map it to the right district or group, and queue members for approval."
        eyebrow="Members"
        icon={<FileSpreadsheet className="h-6 w-6" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/members")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Members
          </Button>
        }
      />

      <SectionCard
        title="Import Instructions"
        description="Use the provided template so column order and required fields match the expected format."
        action={
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download CSV Template
          </Button>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            "Download the CSV template first.",
            "Keep the column order unchanged.",
            "Required fields: Name and Phone Number.",
            "Upload only .csv files.",
            "Imported members still require admin approval."
          ].map((instruction) => (
            <div key={instruction} className="data-strip text-sm text-muted-foreground">
              {instruction}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Import Setup" description="Choose the target structure and upload the completed CSV file.">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {(userRole === "state_admin" || userRole === "district_admin") && (
              <div className="space-y-2">
                <label htmlFor="bulk-district" className="text-sm font-medium text-foreground">District</label>
                <select
                  id="bulk-district"
                  className={formSelectClassName}
                  value={district}
                  onChange={(e) => { setDistrict(e.target.value); setGroup(""); }}
                  disabled={userRole === "district_admin"}
                >
                  <option value="">Select District</option>
                  {districts.map((d) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {userRole !== "group_admin" && (
              <div className="space-y-2">
                <label htmlFor="bulk-group" className="text-sm font-medium text-foreground">Target Group</label>
                <select
                  id="bulk-group"
                  className={formSelectClassName}
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  disabled={!district}
                >
                  <option value="">Select Group</option>
                  {groups.map((g) => (
                    <option key={g._id} value={g._id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            {userRole === "group_admin" && (
              <div className="space-y-2">
                <label htmlFor="bulk-group" className="text-sm font-medium text-foreground">Your Group</label>
                <select
                  id="bulk-group"
                  className={formSelectClassName}
                  value={group}
                  disabled
                >
                  <option value={user?.group?._id || ""}>{user?.group?.name || "Your Group"}</option>
                </select>
              </div>
            )}
          </div>

          <div className="rounded-[1.6rem] border-2 border-dashed border-border/70 bg-background/75 p-8 text-center shadow-sm">
            <Upload className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer text-sm font-semibold text-primary hover:underline">
              Click to upload CSV file
            </label>
            <p className="mt-1 text-xs text-muted-foreground">Only CSV files are accepted for bulk import.</p>
            {selectedFile ? (
              <div className="mx-auto mt-4 max-w-md rounded-[1rem] border border-border/60 bg-white/80 px-4 py-3 text-sm text-foreground shadow-sm">
                Selected: {selectedFile.name}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/members")}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              className="flex-1 bg-success hover:bg-success/90"
              disabled={!selectedFile || !district || !group || uploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Importing..." : "Import Members"}
            </Button>
          </div>
        </div>
      </SectionCard>
    </PageShell>
  );
};

export default BulkImport;
