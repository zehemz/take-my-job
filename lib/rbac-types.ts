export interface EffectivePermissions {
  isAdmin: boolean;
  /** Agent roles this user can interact with. null = unrestricted (wildcard). */
  allowedAgentRoles: Set<string> | null;
  /** Environment IDs this user can interact with. null = unrestricted (wildcard). */
  allowedEnvironments: Set<string> | null;
}
