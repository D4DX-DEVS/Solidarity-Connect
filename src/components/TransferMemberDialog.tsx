import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

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
}

const TransferMemberDialog = ({ open, onOpenChange, member }: TransferMemberDialogProps) => {
  const { toast } = useToast();
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
      const response = await fetch('/api/districts?limit=100', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setDistricts(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch districts:', error);
    }
  };

  const fetchGroups = async (districtId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/districts/${districtId}/groups?limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setGroups(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transfer-requests', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          member: member._id,
          targetDistrict: formData.targetDistrict,
          targetGroup: formData.targetGroup,
          reason: formData.reason
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Transfer request submitted successfully. It will be reviewed by the appropriate admin.",
        });
        onOpenChange(false);
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to submit transfer request",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Failed to submit transfer request:', error);
      toast({
        title: "Error",
        description: "Failed to submit transfer request",
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
          <DialogTitle>Transfer {member.name}</DialogTitle>
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
            <select
              className="w-full px-3 py-2 border rounded-md bg-background"
              value={formData.targetDistrict}
              onChange={(e) => setFormData({ ...formData, targetDistrict: e.target.value })}
              required
              disabled={loading}
            >
              <option value="">Select District</option>
              {districts.map((district) => (
                <option key={district._id} value={district._id}>
                  {district.name} ({district.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Target Group *</label>
            <select
              className="w-full px-3 py-2 border rounded-md bg-background"
              value={formData.targetGroup}
              onChange={(e) => setFormData({ ...formData, targetGroup: e.target.value })}
              required
              disabled={loading || !formData.targetDistrict}
            >
              <option value="">Select Group</option>
              {groups.map((group) => (
                <option key={group._id} value={group._id}>
                  {group.name} ({group.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Reason for Transfer *</label>
            <Textarea
              placeholder="Please provide a detailed reason for this transfer request..."
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              required
              disabled={loading}
              rows={3}
              minLength={10}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formData.reason.length}/500 characters (minimum 10)
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This transfer request will be sent for approval to the appropriate admin. 
              {formData.targetDistrict && member.district._id !== formData.targetDistrict 
                ? " Cross-district transfers require State Admin approval."
                : " Within-district transfers require District Admin approval."
              }
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
              {loading ? "Submitting..." : "Submit Transfer Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TransferMemberDialog;
