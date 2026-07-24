import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search } from "lucide-react";
import { baithulMaalAPI, membersAPI } from "@/utils/api";
import { getMonthOptions, toMonthValue } from "@/lib/months";

interface MemberOption {
  _id: string;
  name: string;
  phone: string;
  baithulMaal?: { monthlyAmount: number };
  group?: { name: string };
  district?: { name: string };
}

interface BaithulEnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const BaithulEnrollDialog = ({ open, onOpenChange, onSaved }: BaithulEnrollDialogProps) => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<MemberOption[]>([]);
  const [selected, setSelected] = useState<MemberOption | null>(null);
  const [amount, setAmount] = useState("");
  const [startMonth, setStartMonth] = useState(toMonthValue(new Date()));
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSearch("");
      setResults([]);
      setSelected(null);
      setAmount("");
      setStartMonth(toMonthValue(new Date()));
    }
  }, [open]);

  // Load role-scoped members on open; debounce filtering while typing
  useEffect(() => {
    if (!open) return;
    const term = search.trim();
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const params: Record<string, string> = { limit: "20" };
        if (term.length >= 2) params.search = term;
        const result = await membersAPI.getMembers(params);
        setResults(result.data || []);
      } catch (error) {
        console.error("Member search failed:", error);
      } finally {
        setSearching(false);
      }
    }, term ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, open]);

  const handleSave = async () => {
    if (!selected || !amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      const result = await baithulMaalAPI.updateMemberAmount(selected._id, {
        monthlyAmount: Number(amount),
        startMonth,
      });
      if (result && result.success !== false) {
        toast({ title: "Success", description: `${selected.name} enrolled with ₹${amount}/month` });
        onSaved();
        onOpenChange(false);
      } else {
        toast({ title: "Error", description: result?.message || "Failed to save", variant: "destructive" });
      }
    } catch (error) {
      console.error("Enroll failed:", error);
      toast({ title: "Error", description: "Failed to save Baithul Maal amount", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Member to Baithul Maal</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Search a member and set their monthly contribution amount.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search member by name or phone"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(null);
              }}
            />
          </div>

          {searching && <p className="text-sm text-muted-foreground">Searching...</p>}

          {!selected && results.length > 0 && (
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {results.map((m) => (
                <Card
                  key={m._id}
                  className="cursor-pointer p-3 hover:bg-muted/60"
                  onClick={() => {
                    setSelected(m);
                    setAmount(m.baithulMaal?.monthlyAmount ? String(m.baithulMaal.monthlyAmount) : "");
                  }}
                >
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.phone}
                    {m.group?.name ? ` · ${m.group.name}` : ""}
                    {m.baithulMaal?.monthlyAmount ? ` · Current: ₹${m.baithulMaal.monthlyAmount}/month` : ""}
                  </p>
                </Card>
              ))}
            </div>
          )}

          {selected && (
            <Card className="space-y-3 p-4">
              <div>
                <p className="font-medium">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{selected.phone}</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Monthly Amount (₹) *</label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Start From Month *</label>
                <Select value={startMonth} onValueChange={setStartMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {getMonthOptions(24, 2).map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pending is counted from this month, not the joining date.
                </p>
              </div>
            </Card>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={saving || !selected || !amount || Number(amount) <= 0}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BaithulEnrollDialog;
