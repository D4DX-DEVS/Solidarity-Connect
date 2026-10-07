import { createContext, useContext } from "react";
import type { AdminKind } from "@/lib/adminKinds";

export type UserRole = "state_admin" | "district_admin" | "group_admin" | "member";

export interface User {
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
export interface CachedUser {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  adminKind?: AdminKind | null;
  district?: { _id: string; name: string; code: string };
  group?: { _id: string; name: string; code: string };
  // Area-level admins are told apart by roleTag.type — keep it so offline restore
  // doesn't treat them as unit admins.
  roleTag?: User["roleTag"];
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

export interface AuthContextType {
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

// The provider lives in AuthProvider.tsx; this file holds no components so Fast Refresh works
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
