import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { authAPI, memberAuthAPI } from "@/utils/api";

type UserRole = "state_admin" | "district_admin" | "group_admin" | "member";

interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  district?: {
    _id: string;
    name: string;
    code: string;
  };
  group?: {
    _id: string;
    name: string;
    code: string;
  };
  roleTag?: {
    type: "state" | "district" | "area" | "unit";
    name?: string;
  };
  permissions: string[];
  isActive: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  userRole: UserRole | null;
  userDistrict: string | null;
  userGroup: string | null;
  token: string | null;
  login: (token: string, userData: User, userType?: string) => void;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userDistrict, setUserDistrict] = useState<string | null>(null);
  const [userGroup, setUserGroup] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Check if user is authenticated on app load
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async (): Promise<boolean> => {
    const storedToken = localStorage.getItem('token');
    const userType = localStorage.getItem('userType');

    if (!storedToken) {
      return false;
    }

    setToken(storedToken);

    try {
      // Use different API based on user type
      const result = userType === 'member' ?
        await memberAuthAPI.getProfile() :
        await authAPI.getProfile();

      if (result && result.data) {
        let userData;

        if (userType === 'member') {
          // For members, the profile data structure is different
          userData = {
            id: result.data.profile.id,
            name: result.data.profile.name,
            phone: result.data.profile.phone,
            email: result.data.profile.email,
            role: 'member' as UserRole,
            district: result.data.profile.district,
            group: result.data.profile.group,
            permissions: [],
            isActive: result.data.profile.status === 'Active'
          };
        } else {
          userData = result.data;
        }

        setIsAuthenticated(true);
        setUser(userData);
        setUserRole(userData.role);
        setUserDistrict(userData.district?.name || null);
        setUserGroup(userData.group?.name || null);

        return true;
      } else {
        // Token is invalid, remove it
        localStorage.removeItem('token');
        localStorage.removeItem('userType');
        return false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('userType');
      return false;
    }
  };

  const login = (tokenValue: string, userData: User, userType?: string) => {
    const normalizedUserData: User = userType === "member"
      ? {
          ...userData,
          role: "member",
        }
      : userData;

    localStorage.setItem('token', tokenValue);
    if (userType) {
      localStorage.setItem('userType', userType);
    }
    setToken(tokenValue);
    setIsAuthenticated(true);
    setUser(normalizedUserData);
    setUserRole(normalizedUserData.role);
    setUserDistrict(normalizedUserData.district?.name || null);
    setUserGroup(normalizedUserData.group?.name || null);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    setToken(null);
    setIsAuthenticated(false);
    setUser(null);
    setUserRole(null);
    setUserDistrict(null);
    setUserGroup(null);
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      userRole,
      userDistrict,
      userGroup,
      token,
      login,
      logout,
      checkAuth
    }}>
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
