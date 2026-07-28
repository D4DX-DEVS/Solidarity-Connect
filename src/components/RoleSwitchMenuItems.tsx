import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Repeat } from "lucide-react";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getHomeRouteByRole, type AppUserRole } from "@/lib/roleRoutes";

const roleLabels: Record<string, string> = {
  state_admin: "State Admin",
  district_admin: "District Admin",
  group_admin: "Area Admin",
  member: "Member",
};

// ponytail: same switcher block HeaderWithLogout has, extracted so the hand-rolled
// dashboard menus (StateAdmin, DistrictAdmin) get it without a third copy.
export function RoleSwitchMenuItems() {
  const { availableRoles, userRole, switchRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [switching, setSwitching] = useState(false);

  const otherRoles = availableRoles.filter((role) => role !== userRole);
  if (otherRoles.length === 0) return null;

  const handleSwitchRole = async (targetRole: AppUserRole) => {
    if (switching) return;
    setSwitching(true);
    try {
      await switchRole(targetRole);
      toast({ title: "Role switched", description: `You are now using ${roleLabels[targetRole] || targetRole}.` });
      navigate(getHomeRouteByRole(targetRole));
    } catch (error) {
      toast({
        title: "Switch failed",
        description: error instanceof Error ? error.message : "Could not switch role.",
        variant: "destructive",
      });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <>
      <DropdownMenuLabel className="px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Switch role
      </DropdownMenuLabel>
      {otherRoles.map((role) => (
        <DropdownMenuItem
          key={role}
          disabled={switching}
          onClick={() => handleSwitchRole(role)}
          className="cursor-pointer rounded-xl px-3 py-2.5 font-medium"
        >
          <Repeat className="mr-2 h-4 w-4" />
          {roleLabels[role] || role}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
    </>
  );
}
