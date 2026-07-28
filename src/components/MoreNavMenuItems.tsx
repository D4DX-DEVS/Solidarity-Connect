import { useNavigate } from "react-router-dom";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { getMoreNavItems } from "@/lib/navSections";

// ponytail: one list feeds both the header hamburger and the footer "More" button —
// whatever the bottom nav already shows is filtered out in getMoreNavItems.
export function MoreNavMenuItems() {
  const navigate = useNavigate();
  const { userRole } = useAuth();

  return (
    <>
      {getMoreNavItems(userRole).map((item) => (
        <DropdownMenuItem
          key={item.path}
          onClick={() => navigate(item.path)}
          className="cursor-pointer rounded-xl px-3 py-2.5 font-medium"
        >
          <item.icon className="mr-2 h-4 w-4" />
          {item.label}
        </DropdownMenuItem>
      ))}
    </>
  );
}
