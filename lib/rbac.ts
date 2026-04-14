import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { EffectivePermissions } from './rbac-types';

/**
 * Resolve effective permissions for a GitHub username.
 * Returns null if user does not exist in the User table (unauthorized).
 */
export async function resolvePermissions(
  githubUsername: string | null | undefined
): Promise<EffectivePermissions | null> {
  if (!githubUsername) return null;
  const user = await prisma.user.findUnique({
    where: { githubUsername: githubUsername.toLowerCase() },
    include: {
      groupMemberships: {
        include: {
          group: {
            include: {
              agentAccess: true,
              envAccess: true,
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  if (user.isAdmin) {
    return { isAdmin: true, allowedAgentRoles: null, allowedEnvironments: null };
  }

  let allRoles = false;
  let allEnvs = false;
  const roles = new Set<string>();
  const envs = new Set<string>();

  for (const membership of user.groupMemberships) {
    const group = membership.group;

    for (const access of group.agentAccess) {
      if (access.agentRole === '*') {
        allRoles = true;
      } else {
        roles.add(access.agentRole);
      }
    }

    for (const access of group.envAccess) {
      if (access.environmentId === '*') {
        allEnvs = true;
      } else {
        envs.add(access.environmentId);
      }
    }
  }

  return {
    isAdmin: false,
    allowedAgentRoles: allRoles ? null : roles,
    allowedEnvironments: allEnvs ? null : envs,
  };
}

/**
 * Resolve the environment ID for a card.
 * Card-level override takes priority; falls back to the role's AgentConfig.
 */
export async function resolveCardEnvironment(
  agentRole: string | null,
  cardEnvironmentId?: string | null,
): Promise<string | null> {
  if (cardEnvironmentId) return cardEnvironmentId;
  if (!agentRole) return null;

  const config = await prisma.agentConfig.findUnique({
    where: { role: agentRole },
    select: { anthropicEnvironmentId: true },
  });

  return config?.anthropicEnvironmentId ?? null;
}

/**
 * Check whether a user has access to a specific agent role + environment.
 */
export async function checkCardAccess(
  githubUsername: string | null | undefined,
  agentRole: string | null,
  environmentId: string | null
): Promise<boolean> {
  const perms = await resolvePermissions(githubUsername);
  if (!perms) return false;
  if (perms.isAdmin) return true;

  if (agentRole && perms.allowedAgentRoles !== null) {
    if (!perms.allowedAgentRoles.has(agentRole)) return false;
  }

  if (environmentId && perms.allowedEnvironments !== null) {
    if (!perms.allowedEnvironments.has(environmentId)) return false;
  }

  return true;
}

/**
 * High-level guard: given a card, check if the user has access.
 * Card-level environment override takes priority over the role default.
 */
export async function guardCardAccess(
  githubUsername: string | null | undefined,
  card: { role: string | null; environmentId?: string | null }
): Promise<boolean> {
  const environmentId = await resolveCardEnvironment(card.role, card.environmentId);
  return checkCardAccess(githubUsername, card.role, environmentId);
}

/**
 * RBAC guard that returns a 403 NextResponse if the user lacks access, or null
 * if access is granted.  Callers use: `const forbidden = await requireCardAccess(...); if (forbidden) return forbidden;`
 */
export async function requireCardAccess(
  username: string | null | undefined,
  card: { role: string | null },
): Promise<NextResponse | null> {
  const hasAccess = await guardCardAccess(username, card);
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: no access to this agent role/environment' },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Check if a user is an admin.
 */
export async function isAdmin(githubUsername: string | null | undefined): Promise<boolean> {
  if (!githubUsername) return false;
  const user = await prisma.user.findUnique({
    where: { githubUsername: githubUsername.toLowerCase() },
    select: { isAdmin: true },
  });
  return user?.isAdmin === true;
}

/**
 * Require admin access. Returns a 403 Response if not admin, null if OK.
 */
export async function requireAdmin(
  githubUsername: string
): Promise<Response | null> {
  if (!(await isAdmin(githubUsername))) {
    return Response.json(
      { error: 'Forbidden: admin access required' },
      { status: 403 }
    );
  }
  return null;
}
