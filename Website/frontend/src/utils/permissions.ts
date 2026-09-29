import type { Role } from '../contexts/AuthContext';

// Role to allowed route prefixes mapping
export const ROLE_ROUTE_PREFIXES: Record<NonNullable<Role>, string[]> = {
  examiner: ['/examiner'],
  moderator: ['/moderator'],
  controller: ['/controller'],
};

export const ROLE_HOME_ROUTES: Record<NonNullable<Role>, string> = {
  examiner: '/examiner',
  moderator: '/moderator',
  controller: '/controller',
};

/**
 * Checks if a given role is allowed to access a specific path
 */
export function isRouteAllowedForRole(role: Role, pathname: string): boolean {
  if (!role) return false;
  const prefixes = ROLE_ROUTE_PREFIXES[role];
  if (!prefixes) return false;
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
