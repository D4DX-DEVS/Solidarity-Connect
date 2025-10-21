import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Building2, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";

const RoleSelection = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleRoleSelect = (role: "state_admin" | "district_admin" | "group_admin") => {
    login(role);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="SOLIDARITY" className="h-16 mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Select Your Role</h1>
          <p className="text-muted-foreground text-sm mt-2">Choose your admin level to continue</p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => handleRoleSelect("state_admin")}
            className="w-full h-auto py-4 flex items-center gap-4 bg-primary hover:bg-primary/90"
          >
            <div className="bg-primary-foreground/20 p-3 rounded-lg">
              <Shield className="h-6 w-6" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold">State Admin</div>
              <div className="text-xs opacity-90">Full system control</div>
            </div>
          </Button>

          <Button
            onClick={() => handleRoleSelect("district_admin")}
            className="w-full h-auto py-4 flex items-center gap-4 bg-primary hover:bg-primary/90"
          >
            <div className="bg-primary-foreground/20 p-3 rounded-lg">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold">District Admin</div>
              <div className="text-xs opacity-90">Supervision & approval</div>
            </div>
          </Button>

          <Button
            onClick={() => handleRoleSelect("group_admin")}
            className="w-full h-auto py-4 flex items-center gap-4 bg-primary hover:bg-primary/90"
          >
            <div className="bg-primary-foreground/20 p-3 rounded-lg">
              <Users className="h-6 w-6" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold">Members Group Admin</div>
              <div className="text-xs opacity-90">Manage your group</div>
            </div>
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default RoleSelection;
