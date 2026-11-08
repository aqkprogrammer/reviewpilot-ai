export const ROLE_INFO: Record<string, { label: string; description: string }> = {
  owner: { label: "Owner", description: "Full access including billing, team and every setting." },
  admin: { label: "Admin", description: "Manages locations, reviews, campaigns, customers, integrations and team (except owners)." },
  manager: { label: "Manager", description: "Replies to reviews, runs campaigns and manages customers — optionally for assigned locations only." },
  staff: { label: "Staff", description: "Reads reviews and manages customers. Can't run campaigns or change settings." },
  analyst: { label: "Analyst", description: "Read-only access to reviews and analytics." },
};

export const MATRIX: { label: string; roles: string[] }[] = [
  { label: "View reviews", roles: ["owner", "admin", "manager", "staff", "analyst"] },
  { label: "Reply to reviews", roles: ["owner", "admin", "manager"] },
  { label: "Run campaigns & QR", roles: ["owner", "admin", "manager"] },
  { label: "Manage customers", roles: ["owner", "admin", "manager", "staff"] },
  { label: "Use AI assistant", roles: ["owner", "admin", "manager", "staff"] },
  { label: "Analytics", roles: ["owner", "admin", "manager", "analyst"] },
  { label: "Locations & integrations", roles: ["owner", "admin"] },
  { label: "Team management", roles: ["owner", "admin"] },
  { label: "Billing", roles: ["owner"] },
];

export function assignableRoles(actorRole: string): string[] {
  if (actorRole === "owner") return ["owner", "admin", "manager", "staff", "analyst"];
  if (actorRole === "admin") return ["manager", "staff", "analyst"];
  return [];
}
