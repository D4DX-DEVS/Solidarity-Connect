import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: { id: number; name: string; district: string } | null;
  mode: "add" | "edit";
  selectedDistrict?: string;
}

const GroupDialog = ({ open, onOpenChange, group, mode, selectedDistrict }: GroupDialogProps) => {
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");

  useEffect(() => {
    if (group && mode === "edit") {
      setName(group.name);
      setDistrict(group.district);
    } else {
      setName("");
      setDistrict(selectedDistrict || "");
    }
  }, [group, mode, open, selectedDistrict]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !district) return;

    toast({
      title: mode === "add" ? "Group Added" : "Group Updated",
      description: `${name} has been ${mode === "add" ? "added" : "updated"} successfully.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add New Group" : "Edit Group"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">District</label>
            <select
              required
              className="w-full px-3 py-2 border rounded-md bg-background"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            >
              <option value="">Select District</option>
              <option value="Thrissur">Thrissur</option>
              <option value="Malappuram">Malappuram</option>
              <option value="Kozhikode">Kozhikode</option>
              <option value="Kannur">Kannur</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Group Name</label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
              {mode === "add" ? "Add Group" : "Update Group"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GroupDialog;
