import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useCreateDistrict, useUpdateDistrict } from "@/hooks/useDistricts";
import { District } from "@/lib/districts";
import { Loader2 } from "lucide-react";

interface DistrictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  district?: District | null;
  mode: "add" | "edit";
}

const DistrictDialog = ({ open, onOpenChange, district, mode }: DistrictDialogProps) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const createDistrictMutation = useCreateDistrict();
  const updateDistrictMutation = useUpdateDistrict();

  const isLoading = createDistrictMutation.isPending || updateDistrictMutation.isPending;

  useEffect(() => {
    if (district && mode === "edit") {
      setName(district.name);
      setCode(district.code);
    } else {
      setName("");
      setCode("");
    }
  }, [district, mode, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    try {
      if (mode === "add") {
        await createDistrictMutation.mutateAsync({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          isActive: true,
        });
        toast({
          title: "District Added",
          description: `${name} has been added successfully.`,
        });
      } else if (district) {
        await updateDistrictMutation.mutateAsync({
          id: district._id,
          data: {
            name: name.trim(),
            code: code.trim().toUpperCase(),
          },
        });
        toast({
          title: "District Updated",
          description: `${name} has been updated successfully.`,
        });
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${mode} district`,
        variant: "destructive",
      });
    }
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
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">District Code</label>
            <Input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter district code (e.g., TSR, MLM)"
              maxLength={10}
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-primary hover:bg-primary/90"
              disabled={isLoading || !name.trim() || !code.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {mode === "add" ? "Adding..." : "Updating..."}
                </>
              ) : (
                mode === "add" ? "Add District" : "Update District"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DistrictDialog;
