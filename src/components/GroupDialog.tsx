import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useCreateGroup, useUpdateGroup } from "@/hooks/useGroups";
import { Group } from "@/lib/groups";
import { District } from "@/lib/districts";
import { Loader2 } from "lucide-react";

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: Group | null;
  mode: "add" | "edit";
  selectedDistrictId?: string;
  districts: District[];
}

const GroupDialog = ({ open, onOpenChange, group, mode, selectedDistrictId, districts }: GroupDialogProps) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [districtId, setDistrictId] = useState("");

  const createGroupMutation = useCreateGroup();
  const updateGroupMutation = useUpdateGroup();

  const isLoading = createGroupMutation.isPending || updateGroupMutation.isPending;

  useEffect(() => {
    if (group && mode === "edit") {
      setName(group.name);
      setCode(group.code);
      setDistrictId(group.district._id);
    } else {
      setName("");
      setCode("");
      setDistrictId(selectedDistrictId || "");
    }
  }, [group, mode, open, selectedDistrictId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !districtId) return;

    try {
      if (mode === "add") {
        await createGroupMutation.mutateAsync({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          district: districtId,
          isActive: true,
        });
        toast({
          title: "Group Added",
          description: `${name} has been added successfully.`,
        });
      } else if (group) {
        await updateGroupMutation.mutateAsync({
          id: group._id,
          data: {
            name: name.trim(),
            code: code.trim().toUpperCase(),
            district: districtId,
          },
        });
        toast({
          title: "Group Updated",
          description: `${name} has been updated successfully.`,
        });
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${mode} group`,
        variant: "destructive",
      });
    }
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
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              disabled={isLoading}
            >
              <option value="">Select District</option>
              {districts.map((district) => (
                <option key={district._id} value={district._id}>
                  {district.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Group Name</label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Group Code</label>
            <Input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter group code (e.g., VRP, PMP)"
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
              disabled={isLoading || !name.trim() || !code.trim() || !districtId}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {mode === "add" ? "Adding..." : "Updating..."}
                </>
              ) : (
                mode === "add" ? "Add Group" : "Update Group"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GroupDialog;
