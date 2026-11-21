import { createContext, useContext } from "react";
import { can, type Permission, type StaffRole } from "@/lib/permissions";

const StaffRoleContext = createContext<StaffRole | null>(null);

export const StaffRoleProvider = StaffRoleContext.Provider;

// Usage: const { role, can } = useStaffRole(); if (can("viewBilling")) ...
export const useStaffRole = () => {
  const role = useContext(StaffRoleContext);
  return {
    role,
    can: (permission: Permission) => can(role, permission),
  };
};
