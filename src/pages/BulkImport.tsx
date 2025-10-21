import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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
    console.log("Uploading file:", selectedFile.name, { district, group });
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
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/members")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Bulk Import Members</h1>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 mb-4">
              <FileSpreadsheet className="h-5 w-5 text-primary mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Import Instructions</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Download the CSV template below</li>
                  <li>• Fill in member details following the format</li>
                  <li>• Required fields: Name, Phone Number</li>
                  <li>• Upload the completed CSV file</li>
                  <li>• Imported members will require admin approval</li>
                </ul>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleDownloadTemplate}
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV Template
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-4">
            {(userRole === "state_admin" || userRole === "district_admin") && (
              <div>
                <label className="text-sm font-medium mb-2 block">District</label>
                <select
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                >
                  <option value="">Select District</option>
                  <option value="Thrissur">Thrissur</option>
                  <option value="Malappuram">Malappuram</option>
                  <option value="Kozhikode">Kozhikode</option>
                </select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">
                {userRole === "group_admin" ? "Your Group" : "Target Group"}
              </label>
              <select
                required={userRole === "group_admin"}
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
              >
                <option value="">Select Group</option>
                <option value="Varantharappalli">Varantharappalli</option>
                <option value="Perumpilavu">Perumpilavu</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Upload CSV File</label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer text-primary hover:underline"
                >
                  Click to upload CSV file
                </label>
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/members")}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                className="flex-1 bg-success hover:bg-success/90"
                disabled={!selectedFile}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Members
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default BulkImport;
