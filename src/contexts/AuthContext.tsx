import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { authAPI, memberAuthAPI } from "@/utils/api";
import type { AdminKind } from "@/lib/adminKinds";

type UserRole = "state_admin" | "district_admin" | "group_admin" | "member";

interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  // Which flavour of area-level admin. Only meaningful when role is "group_admin";
  // Murabi and Coordinator admins share that role and differ only here.
  adminKind?: AdminKind | null;
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
    type: "state" | "district" | "area" | "unit" | "murabi" | "coordinator";
    name?: string;
  };
  permissions: string[];
  isActive: boolean;
}

// Minimal data cached in localStorage for PWA offline restore
interface CachedUser {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  adminKind?: AdminKind | null;
  district?: { _id: string; name: string; code: string };
  group?: { _id: string; name: string; code: string };
}

/** One selectable account on the signed-in phone number. Mirrors the API shape. */
export interface LoginAccount {
  id: string;
  type: "admin" | "member";
  role: UserRole;
  adminKind: AdminKind | null;
  label: string;
  name: string;
  scope: string | null;
  lastLogin: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isRefreshing: boolean;
  user: User | null;
  userRole: UserRole | null;
  userDistrict: string | null;
  userGroup: string | null;
  token: string | null;
  availableRoles: UserRole[];
  availableAccounts: LoginAccount[];
  login: (token: string, userData: User, userType?: string) => void;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  switchRole: (targetRole: UserRole) => Promise<void>;
  switchAccount: (account: LoginAccount) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userDistrict, setUserDistrict] = useState<string | null>(null);
  const [userGroup, setUserGroup] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<LoginAccount[]>([]);

  // Discover every account this phone holds (admin accounts + member) for the switcher.
  // Accounts are the richer list — two area-level accounts (Area + Murabi) collapse to
  // a single entry under `availableRoles`, so prefer `availableAccounts` in new UI.
  const refreshAvailableRoles = useCallback(async (phone: string | undefined) => {
    if (!phone) {
      setAvailableRoles([]);
      setAvailableAccounts([]);
      return;
    }
    try {
      const result = await authAPI.listAccounts();
      const accounts = (result.data?.accounts || []) as LoginAccount[];
      setAvailableAccounts(accounts);
      setAvailableRoles([...new Set(accounts.map((a) => a.role))]);
    } catch {
      setAvailableRoles([]);
      setAvailableAccounts([]);
    }
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    localStorage.removeItem('userData');
    setToken(null);
    setIsAuthenticated(false);
    setUser(null);
    setUserRole(null);
    setUserDistrict(null);
    setUserGroup(null);
    setAvailableRoles([]);
    setAvailableAccounts([]);
  }, []);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    const storedToken = localStorage.getItem('token');
    const userType = localStorage.getItem('userType');

    if (!storedToken) {
      return false;
    }

    setToken(storedToken);

    // Step 1: Restore cached user immediately (fast PWA startup)
    const cachedRaw = localStorage.getItem('userData');
    let hasCachedSession = false;
    if (storedToken && cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as CachedUser;
        const restoredUser: User = {
          ...cached,
          permissions: [],
          isActive: true,
        };
        setIsAuthenticated(true);
        setUser(restoredUser);
        setUserRole(restoredUser.role);
        setUserDistrict(restoredUser.district?.name || null);
        setUserGroup(restoredUser.group?.name || null);
        hasCachedSession = true;
      } catch {
        // corrupted cache, will validate via network
      }
    }

    // Step 2: Validate token in background (server is source of truth)
    setIsRefreshing(true);
    try {
      const result = userType === 'member' ?
        await memberAuthAPI.getProfile() :
        await authAPI.getProfile();

      if (result && result.data) {
        let userData: User;

        if (userType === 'member') {
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

        // Cache only minimal UI-needed data
        const toCache: CachedUser = {
          id: userData.id,
          name: userData.name,
          phone: userData.phone,
          role: userData.role,
          adminKind: userData.adminKind ?? null,
          district: userData.district,
          group: userData.group,
        };
        localStorage.setItem('userData', JSON.stringify(toCache));

        refreshAvailableRoles(userData.phone);

        return true;
      } else {
        // Server explicitly says no valid session
        clearSession();
        return false;
      }
    } catch (error: unknown) {
      console.error('Auth check failed:', error);

      // Detect auth errors (401/403) from our apiCall utility
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403) {
        clearSession();
        return false;
      }

      // Network/server error — keep cached session alive for PWA
      return hasCachedSession;
    } finally {
      setIsRefreshing(false);
    }
  }, [clearSession, refreshAvailableRoles]);

  // Check if user is authenticated on app load
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = (tokenValue: string, userData: User, userType?: string) => {
    // Member payloads from login/select-account are raw Member docs — normalize the
    // fields the admin shape guarantees so downstream reads never hit undefined.
    const normalizedUserData: User = userType === "member"
      ? {
          ...userData,
          role: "member",
          permissions: userData.permissions ?? [],
          isActive: userData.isActive ?? true,
        }
      : userData;

    localStorage.setItem('token', tokenValue);
    if (userType) {
      localStorage.setItem('userType', userType);
    }
    // Cache only minimal data needed for PWA offline restore
    const toCache: CachedUser = {
      id: normalizedUserData.id,
      name: normalizedUserData.name,
      phone: normalizedUserData.phone,
      role: normalizedUserData.role,
      adminKind: normalizedUserData.adminKind ?? null,
      district: normalizedUserData.district,
      group: normalizedUserData.group,
    };
    localStorage.setItem('userData', JSON.stringify(toCache));
    setToken(tokenValue);
    setIsAuthenticated(true);
    setUser(normalizedUserData);
    setUserRole(normalizedUserData.role);
    setUserDistrict(normalizedUserData.district?.name || null);
    setUserGroup(normalizedUserData.group?.name || null);
    refreshAvailableRoles(normalizedUserData.phone);
  };

  const logout = () => {
    clearSession();
  };

  // Switch active role in-session (no new OTP). Server revalidates identity
  // from DB and issues a fresh token for the target role.
  const switchRole = async (targetRole: UserRole) => {
    const result = await authAPI.switchRole(targetRole);
    const { token: newToken, member, user: adminUser } = result.data;

    if (targetRole === 'member') {
      const memberUser: User = {
        id: member.id,
        name: member.name,
        phone: member.phone,
        email: member.email,
        role: 'member',
        district: member.district,
        group: member.group,
        permissions: [],
        isActive: member.status === 'Active',
      };
      login(newToken, memberUser, 'member');
    } else {
      login(newToken, adminUser, targetRole);
    }
  };

  // Switch to a specific account by id. Unlike switchRole this can tell two
  // area-level accounts apart (e.g. Area Admin vs Murabi Admin on one number).
  const switchAccount = async (account: LoginAccount) => {
    const result = await authAPI.switchAccount(account.id, account.type);
    const { token: newToken, member, user: adminUser } = result.data;

    if (account.type === 'member') {
      const memberUser: User = {
        id: member.id,
        name: member.name,
        phone: member.phone,
        email: member.email,
        role: 'member',
        district: member.district,
        group: member.group,
        permissions: [],
        isActive: member.status === 'Active',
      };
      login(newToken, memberUser, 'member');
      return;
    }

    login(newToken, adminUser, adminUser.role);
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isRefreshing,
      user,
      userRole,
      userDistrict,
      userGroup,
      token,
      availableRoles,
      availableAccounts,
      login,
      logout,
      checkAuth,
      switchRole,
      switchAccount
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
