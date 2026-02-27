export type AppUserRole = "state_admin" | "district_admin" | "group_admin" | "member";

export const getHomeRouteByRole = (role?: string | null): string => {
  if (role === "state_admin") return "/state-admin";
  if (role === "district_admin") return "/district-admin";
  if (role === "member") return "/member-dashboard";
  return "/dashboard";
};
