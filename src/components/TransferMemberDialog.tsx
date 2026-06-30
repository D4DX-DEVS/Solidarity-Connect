import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { districtsAPI, transferRequestsAPI, membersAPI } from "@/utils/api";

interface District {
  _id: string;
  name: string;
  code: string;
}

interface Group {
  _id: string;
  name: string;
  code: string;
}

interface Member {
  _id: string;
  name: string;
  phone: string;
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

interface TransferMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member | null;
  // Called after a successful transfer/move so the parent can refresh its list.
  onTransferred?: () => void;
}

const TransferMemberDialog = ({ open, onOpenChange, member, onTransferred }: TransferMemberDialogProps) => {
  const { toast } = useToast();
  const { userRole } = useAuth();
  // State admins move the member directly (no approval workflow); other roles
  // create a TransferRequest that goes through the approval pipeline.
  const isDirectMove = userRole === 'state_admin';
  const [loading, setLoading] = useState(false);
  const [districts, setDistricts] = useState<District[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [formData, setFormData] = useState({
    targetDistrict: "",
    targetGroup: "",
    reason: ""
  });

  // Fetch districts when dialog opens
  useEffect(() => {
    if (open) {
      fetchDistricts();
      setFormData({
        targetDistrict: "",
        targetGroup: "",
        reason: ""
      });
      setGroups([]);
    }
  }, [open]);

  // Fetch groups when district changes
  useEffect(() => {
    if (formData.targetDistrict) {
      fetchGroups(formData.targetDistrict);
    } else {
      setGroups([]);
      setFormData(prev => ({ ...prev, targetGroup: "" }));
    }
  }, [formData.targetDistrict]);

  const fetchDistricts = async () => {
    try {
      const token = localStorage.getItem('token');
      const result = await districtsAPI.getDistricts({ limit: 100 });
      setDistricts(result.data || []);
    } catch (error) {
      console.error('Failed to fetch districts:', error);
    }
  };

  const fetchGroups = async (districtId: string) => {
    try {
      const token = localStorage.getItem('token');
      const result = await districtsAPI.getDistrictGroups(districtId, { limit: 100 });
      setGroups(result.data || []);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;

    // For state admins doing a direct move, the "reason" note is informational only.
    if (isDirectMove && (!formData.targetDistrict || !formData.targetGroup)) {
      toast({
        title: "Missing Target Location",
        description: "Please select both a target district and group.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      if (isDirectMove) {
        // ── State admin path: move the member directly via PUT /api/members/:id ──
        // No TransferRequest / approval workflow — state admins are the highest
        // authority and can relocate a member anywhere immediately.
        await membersAPI.updateMember(member._id, {
          district: formData.targetDistrict,
          group: formData.targetGroup,
        });

        toast({
          title: "Member Moved",
          description: `${member.name} has been transferred to the new district/group.`,
        });
      } else {
        // ── Group admin path: create a TransferRequest for approval ──
        await transferRequestsAPI.createTransferRequest({
          member: member._id,
          targetDistrict: formData.targetDistrict,
          targetGroup: formData.targetGroup,
          reason: formData.reason
        });

        toast({
          title: "Transfer Request Submitted",
          description: "The transfer request has been submitted and will be reviewed by the appropriate admin.",
        });
      }

      onTransferred?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to submit transfer request:', error);
      toast({
        title: "Error",
        description: isDirectMove
          ? "Failed to transfer member. Please try again."
          : "Failed to submit transfer request",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isDirectMove ? `Move ${member.name}` : `Transfer ${member.name}`}
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-muted rounded-md">
          <p className="text-sm font-medium">Current Location:</p>
          <p className="text-sm text-muted-foreground">
            {member.group.name} ({member.group.code}) - {member.district.name} ({member.district.code})
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Target District *</label>
            <Select
              value={formData.targetDistrict}
              onValueChange={(val) => setFormData({ ...formData, targetDistrict: val })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select District" />
              </SelectTrigger>
              <SelectContent>
                {districts.map((district) => (
                  <SelectItem key={district._id} value={district._id}>
                    {district.name} ({district.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Target Group *</label>
            <Select
              value={formData.targetGroup}
              onValueChange={(val) => setFormData({ ...formData, targetGroup: val })}
              disabled={loading || !formData.targetDistrict}
            >
              <SelectTrigger>
                <SelectValue placeholder={formData.targetDistrict ? "Select Group" : "Select district first"} />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group._id} value={group._id}>
                    {group.name} ({group.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Reason for Transfer {isDirectMove ? '(Optional)' : '*'}
            </label>
            <Textarea
              placeholder={isDirectMove
                ? "Optional note about this move (for your records)…"
                : "Please provide a detailed reason for this transfer request..."
              }
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              required={!isDirectMove}
              disabled={loading}
              rows={3}
              minLength={isDirectMove ? undefined : 10}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formData.reason.length}/500 characters{isDirectMove ? '' : ' (minimum 10)'}
            </p>
          </div>

          <div className={isDirectMove
            ? "bg-amber-50 border border-amber-200 rounded-md p-3"
            : "bg-blue-50 border border-blue-200 rounded-md p-3"}>
            <p className={`text-sm ${isDirectMove ? 'text-amber-800' : 'text-blue-800'}`}>
              {isDirectMove ? (
                <>
                  <strong>Note:</strong> As a state admin, the member will be moved to the
                  target district/group <strong>immediately</strong> — no approval required.
                </>
              ) : (
                <>
                  <strong>Note:</strong> This transfer request will be sent for approval to the appropriate admin.
                  {formData.targetDistrict && member.district._id !== formData.targetDistrict
                    ? " Cross-district transfers require State Admin approval."
                    : " Within-district transfers require District Admin approval."}
                </>
              )}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-success hover:bg-success/90"
              disabled={loading}
            >
              {loading
                ? (isDirectMove ? "Moving..." : "Submitting...")
                : (isDirectMove ? "Move Member" : "Submit Transfer Request")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TransferMemberDialog;
