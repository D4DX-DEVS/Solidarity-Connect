import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  // Unit name — the org stores it in member.address
  address?: string;
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
  const { userRole, user } = useAuth();
  // State admins move the member directly to ANY district/group (PUT /api/members/:id,
  // no approval workflow).
  // District admins move the member directly WITHIN their own district
  // (PATCH /api/members/:id/move, which enforces the district); picking another
  // district turns the dialog into a TransferRequest that goes straight to the
  // state admin for approval.
  // Group admins create a TransferRequest that goes through the approval pipeline.
  // Every path can also set a new unit; blank keeps the current one.
  const ownDistrictId = userRole === 'district_admin' ? user?.district?._id : null;
  const [loading, setLoading] = useState(false);
  const [districts, setDistricts] = useState<District[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [formData, setFormData] = useState({
    targetDistrict: "",
    targetGroup: "",
    unit: "",
    reason: ""
  });
  const isDistrictAdminRequest = !!ownDistrictId
    && !!formData.targetDistrict
    && formData.targetDistrict !== ownDistrictId;
  const isDirectMove = userRole === 'state_admin'
    || (userRole === 'district_admin' && !isDistrictAdminRequest);

  // Fetch districts when dialog opens
  useEffect(() => {
    if (open) {
      fetchDistricts();
      setFormData({
        // District admins: pre-select their own district (the common, instant-move case).
        targetDistrict: ownDistrictId || "",
        targetGroup: "",
        unit: "",
        reason: ""
      });
      setGroups([]);
    }
  }, [open, ownDistrictId]);

  // Safety net: if the dialog is open and the own district id resolves later
  // (e.g. auth restoration finishes after the dialog opens), pre-select it.
  // Avoids a race where the group dropdown would otherwise stay on
  // "Select district first".
  useEffect(() => {
    if (open && ownDistrictId && !formData.targetDistrict) {
      setFormData(prev => ({ ...prev, targetDistrict: ownDistrictId, targetGroup: "" }));
    }
  }, [open, ownDistrictId, formData.targetDistrict]);

  // Fetch groups when the dialog opens or the district changes. `open` is a
  // dependency because the dialog stays mounted between uses: reopening on the
  // same district would otherwise leave the list empty. Responses for a district
  // that is no longer selected are dropped so they can't overwrite the list.
  useEffect(() => {
    if (!open) return;
    setGroups([]);
    if (!formData.targetDistrict) {
      setFormData(prev => ({ ...prev, targetGroup: "" }));
      return;
    }
    let cancelled = false;
    // Not /districts/:id/groups — that one is scoped to the caller's own
    // district, which would leave the picker empty for cross-district requests.
    districtsAPI.getTransferTargetGroups(formData.targetDistrict)
      .then((result) => {
        if (!cancelled) setGroups(result.data || []);
      })
      .catch((error: unknown) => {
        if (!cancelled) console.error('Failed to fetch groups:', error);
      });
    return () => { cancelled = true; };
  }, [open, formData.targetDistrict]);

  const fetchDistricts = async () => {
    try {
      const token = localStorage.getItem('token');
      const result = await districtsAPI.getDistricts({ limit: 100 });
      setDistricts(result.data || []);
    } catch (error) {
      console.error('Failed to fetch districts:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;

    // Every path needs a target; for direct moves the "reason" note is informational only.
    if (!formData.targetDistrict || !formData.targetGroup) {
      toast({
        title: "Missing Target Location",
        description: "Please select both a target district and group.",
        variant: "destructive"
      });
      return;
    }

    // Group-admin path requires a substantive reason (mirrors backend validation:
    // `body('reason').trim().isLength({ min: 10, max: 500 })`).
    if (!isDirectMove && formData.reason.trim().length < 10) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason of at least 10 characters.",
        variant: "destructive"
      });
      return;
    }

    // Direct-move sanity check: don't allow moving to the member's current group.
    if (isDirectMove && formData.targetGroup === member.group?._id) {
      toast({
        title: "No Change",
        description: "The member is already in the selected group.",
        variant: "destructive"
      });
      return;
    }

    // Blank unit = keep the member's current unit.
    const unit = formData.unit.trim();

    setLoading(true);
    try {
      if (isDirectMove) {
        // ── Direct-move path (state_admin OR district_admin) ──
        // No TransferRequest / approval workflow — the member is moved immediately.
        if (userRole === 'state_admin') {
          // State admins can target any district/group.
          await membersAPI.updateMember(member._id, {
            district: formData.targetDistrict,
            group: formData.targetGroup,
            ...(unit ? { address: unit } : {}),
          });
        } else {
          // District admins: own district only (the backend enforces it).
          await membersAPI.moveMemberWithinDistrict(member._id, {
            group: formData.targetGroup,
            ...(unit ? { unit } : {}),
          });
        }

        toast({
          title: "Member Moved",
          description: `${member.name} has been transferred to the new district/group.`,
        });
      } else {
        // ── Request path: create a TransferRequest for approval ──
        // group_admin: group_admin initiates → district_admin(s) approve → state_admin final-approves + executes.
        // district_admin (cross-district): goes straight to the state_admin, who approves + executes.
        await transferRequestsAPI.createTransferRequest({
          member: member._id,
          targetDistrict: formData.targetDistrict,
          targetGroup: formData.targetGroup,
          ...(unit ? { targetUnit: unit } : {}),
          reason: formData.reason
        });

        toast({
          title: "Transfer Request Submitted",
          description: isDistrictAdminRequest
            ? "The transfer request has been sent to the State Admin for approval."
            : "The transfer request has been submitted and will be reviewed by the appropriate admin.",
        });
      }

      onTransferred?.();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error('Failed to submit transfer request:', error);
      toast({
        title: "Error",
        // Surface the backend's actual message when available (e.g.
        // "You can only transfer members within your district"); fall back to
        // a generic message otherwise.
        description: (error instanceof Error && error.message)
          || (isDirectMove
            ? "Failed to transfer member. Please try again."
            : "Failed to submit transfer request"),
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
          <p className="text-sm text-muted-foreground">Unit: {member.address || "No unit"}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Target District *</label>
            <Select
              value={formData.targetDistrict}
              onValueChange={(val) => setFormData({ ...formData, targetDistrict: val, targetGroup: "" })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select District" />
              </SelectTrigger>
              <SelectContent>
                {districts.map((district) => (
                  <SelectItem key={district._id} value={district._id}>
                    {district.name} ({district.code}){district._id === ownDistrictId ? " · your district" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ownDistrictId && (
              <p className="text-xs text-muted-foreground mt-1">
                Within your district the member is moved immediately.
                Choosing another district sends a transfer request to the State Admin for approval.
              </p>
            )}
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
            {/* Stored in member.address — the org uses it for the unit name */}
            <label htmlFor="transfer-unit" className="text-sm font-medium mb-2 block">New Unit (Optional)</label>
            <Input
              id="transfer-unit"
              placeholder="e.g. Vaduthala"
              maxLength={100}
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank to keep the current unit{member.address ? ` (${member.address})` : ""}.
            </p>
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
                  <strong>Note:</strong> {userRole === 'state_admin'
                    ? <>As a state admin, the member will be moved to the target district/group <strong>immediately</strong> — no approval required.</>
                    : <>As a district admin, the member will be moved to the new group within your district <strong>immediately</strong> — no approval required.</>}
                </>
              ) : isDistrictAdminRequest ? (
                <>
                  <strong>Note:</strong> This request goes <strong>straight to the State Admin</strong> for approval.
                  The member stays in their current group until it is approved.
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
