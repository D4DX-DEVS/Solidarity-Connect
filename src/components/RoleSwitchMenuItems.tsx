import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth, type LoginAccount } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getRoleDisplay } from "@/lib/adminKinds";
import { getHomeRouteByRole } from "@/lib/roleRoutes";

// ponytail: same switcher block HeaderWithLogout has, extracted so the hand-rolled
// dashboard menus (StateAdmin, DistrictAdmin) get it without a third copy.
//
// Switches by account id rather than role name: Area Admin, Murabi Admin and
// Coordinator Admin all share role "group_admin", so a role-keyed list would
// collapse them into one entry and make two of them unreachable.
export function RoleSwitchMenuItems() {
  const { availableAccounts, user, switchAccount } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const others = availableAccounts.filter((account) => account.id !== user?.id);
  if (others.length === 0) return null;

  const handleSwitch = async (account: LoginAccount) => {
    if (switchingId) return;
    setSwitchingId(account.id);
    try {
      await switchAccount(account);
      toast({ title: "Account switched", description: `You are now using ${account.label}.` });
      navigate(account.type === "member" ? "/member-dashboard" : getHomeRouteByRole(account.role));
    } catch (error) {
      toast({
        title: "Switch failed",
        description: error instanceof Error ? error.message : "Could not switch account.",
        variant: "destructive",
      });
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <>
      <DropdownMenuLabel className="px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Switch account
      </DropdownMenuLabel>
      {others.map((account) => {
        const { icon: Icon } = getRoleDisplay(account.role, account.adminKind);
        return (
          <DropdownMenuItem
            key={account.id}
            disabled={Boolean(switchingId)}
            onClick={() => handleSwitch(account)}
            className="cursor-pointer rounded-xl px-3 py-2.5 font-medium"
          >
            <Icon className="mr-2 h-4 w-4" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{account.label}</span>
              {account.scope && (
                <span className="truncate text-xs font-normal text-muted-foreground">{account.scope}</span>
              )}
            </span>
          </DropdownMenuItem>
        );
      })}
      <DropdownMenuSeparator />
    </>
  );
}
