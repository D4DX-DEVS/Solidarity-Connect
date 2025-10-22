import { createContext, useContext, useState, ReactNode, useEffect } from "react";

type UserRole = "state_admin" | "district_admin" | "group_admin";

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
  permissions: string[];
  isActive: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  userRole: UserRole | null;
  userDistrict: string | null;
  userGroup: string | null;
  login: (token: string, userData: User) => void;
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

  // Check if user is authenticated on app load
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async (): Promise<boolean> => {
    const token = localStorage.getItem('token');
    if (!token) {
      return false;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        const userData = result.data;
        
        setIsAuthenticated(true);
        setUser(userData);
        setUserRole(userData.role);
        setUserDistrict(userData.district?.name || null);
        setUserGroup(userData.group?.name || null);
        
        return true;
      } else {
        // Token is invalid, remove it
        localStorage.removeItem('token');
        return false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      return false;
    }
  };

  const login = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
    setUser(userData);
    setUserRole(userData.role);
    setUserDistrict(userData.district?.name || null);
    setUserGroup(userData.group?.name || null);
  };

  const logout = () => {
    localStorage.removeItem('token');
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
