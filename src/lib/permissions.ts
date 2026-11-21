// What each clinic role can see and do in the admin panel. The database
// enforces the same rules (RLS policies and admin_* functions); this only
// decides what to show, so a hidden button is never the only protection.

export type StaffRole = "admin" | "staff" | "doctor";

const permissions = {
  viewDashboard: ["admin", "staff", "doctor"],
  viewPatients: ["admin", "staff", "doctor"],
  viewAppointments: ["admin", "staff", "doctor"],
  viewBilling: ["admin", "staff"],
  viewMessages: ["admin", "staff"],
  viewFeedback: ["admin"],
  viewReports: ["admin"],
  manageTeam: ["admin"],
  deleteRecords: ["admin"],
} satisfies Record<string, StaffRole[]>;

export type Permission = keyof typeof permissions;

export const can = (role: StaffRole | null, permission: Permission) =>
  role !== null && (permissions[permission] as StaffRole[]).includes(role);

// Highest role wins when someone has several
export const highestRole = (roles: string[]): StaffRole | null => {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("staff")) return "staff";
  if (roles.includes("doctor")) return "doctor";
  return null;
};

export const roleLabels: Record<StaffRole, string> = {
  admin: "Admin",
  staff: "Front desk",
  doctor: "Doctor",
};
