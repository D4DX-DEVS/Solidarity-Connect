import { createContext, useContext, useState, ReactNode } from "react";

type UserRole = "state_admin" | "district_admin" | "group_admin";

interface AuthContextType {
  isAuthenticated: boolean;
  userRole: UserRole | null;
  userDistrict: string | null;
  userGroup: string | null;
  login: (role: UserRole, district?: string, group?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userDistrict, setUserDistrict] = useState<string | null>(null);
  const [userGroup, setUserGroup] = useState<string | null>(null);

  const login = (role: UserRole, district?: string, group?: string) => {
    setIsAuthenticated(true);
    setUserRole(role);
    
    // Set district and group based on role
    if (role === "district_admin") {
      setUserDistrict(district || "Thrissur"); // Mock: In real app, get from API
      setUserGroup(null);
    } else if (role === "group_admin") {
      setUserDistrict(district || "Thrissur"); // Mock: In real app, get from API
      setUserGroup(group || "Varantharappalli"); // Mock: In real app, get from API
    } else {
      setUserDistrict(null);
      setUserGroup(null);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    setUserDistrict(null);
    setUserGroup(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userRole, userDistrict, userGroup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
