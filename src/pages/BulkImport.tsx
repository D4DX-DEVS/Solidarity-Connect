import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const formSelectClassName = "w-full rounded-[1rem] border border-border/70 bg-background px-4 py-3 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

const BulkImport = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [district, setDistrict] = useState("");
  const [group, setGroup] = useState("");

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

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to upload.",
        variant: "destructive",
      });
      return;
    }

    if (userRole === "group_admin" && !group) {
      toast({
        title: "Select Group",
        description: "Please select a group for import.",
        variant: "destructive",
      });
      return;
    }

    // Simulate upload
    toast({
      title: "Import Started",
      description: `Importing members from ${selectedFile.name}. This may take a few moments.`,
    });

    // Simulate success after delay
    setTimeout(() => {
      toast({
        title: "Import Successful",
        description: "Members have been imported successfully. Pending approval from admin.",
      });
      navigate("/members");
    }, 2000);
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
                  onChange={(e) => setDistrict(e.target.value)}
                >
                  <option value="">Select District</option>
                  <option value="Thrissur">Thrissur</option>
                  <option value="Malappuram East">Malappuram East</option>
                  <option value="Malappuram West">Malappuram West</option>
                  <option value="Kozhikode">Kozhikode</option>
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="bulk-group" className="text-sm font-medium text-foreground">
                {userRole === "group_admin" ? "Your Group" : "Target Group"}
              </label>
              <select
                id="bulk-group"
                required={userRole === "group_admin"}
                className={formSelectClassName}
                value={group}
                onChange={(e) => setGroup(e.target.value)}
              >
                <option value="">Select Group</option>
                <option value="Varantharappalli">Varantharappalli</option>
                <option value="Perumpilavu">Perumpilavu</option>
              </select>
            </div>
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
              disabled={!selectedFile}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Members
            </Button>
          </div>
        </div>
      </SectionCard>
    </PageShell>
  );
};

export default BulkImport;
