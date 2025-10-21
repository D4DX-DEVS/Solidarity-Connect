import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface DistrictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  district?: { id: number; name: string } | null;
  mode: "add" | "edit";
}

const DistrictDialog = ({ open, onOpenChange, district, mode }: DistrictDialogProps) => {
  const [name, setName] = useState("");

  useEffect(() => {
    if (district && mode === "edit") {
      setName(district.name);
    } else {
      setName("");
    }
  }, [district, mode, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    toast({
      title: mode === "add" ? "District Added" : "District Updated",
      description: `${name} has been ${mode === "add" ? "added" : "updated"} successfully.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add New District" : "Edit District"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">District Name</label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter district name"
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
              {mode === "add" ? "Add District" : "Update District"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DistrictDialog;
