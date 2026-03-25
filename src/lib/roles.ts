export const ROLES = ['member', 'steering', 'admin'] as const;
export type Role = (typeof ROLES)[number];

const ROLE_LEVEL: Record<Role, number> = { member: 0, steering: 1, admin: 2 };

/** Check if user's role meets or exceeds the minimum required role */
export function hasRole(userRole: string, minRole: Role): boolean {
  return (ROLE_LEVEL[userRole as Role] ?? 0) >= ROLE_LEVEL[minRole];
}
