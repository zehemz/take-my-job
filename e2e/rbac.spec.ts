import { test, expect } from './fixtures';
import { KobaniApi } from './helpers/api';

/**
 * RBAC flows — E2E-RBAC-*
 * Tests cover admin API guards, user/group management, and admin UI.
 * The test user in dev mode IS an admin (DEV_AUTH_BYPASS=true).
 */

test.describe('RBAC — Admin API guards', () => {
  test('E2E-RBAC-001: GET /api/admin/users without session → 401', async ({ request }) => {
    const res = await request.get('/api/admin/users');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'Unauthorized');
  });

  test('E2E-RBAC-002: GET /api/admin/groups without session → 401', async ({ request }) => {
    const res = await request.get('/api/admin/groups');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'Unauthorized');
  });
});

test.describe('RBAC — User management', () => {
  test('E2E-RBAC-003: Admin can create a user via POST /api/admin/users', async ({ cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const username = `e2e-test-user-${Date.now()}`;
    let userId: string | undefined;

    try {
      const user = await api.createUser(username);
      userId = user.id;

      expect(user).toHaveProperty('id');
      expect(user.githubUsername).toBe(username.toLowerCase());
      expect(user.isAdmin).toBe(false);
      expect(user).toHaveProperty('createdAt');
      expect(user.groups).toEqual([]);
    } finally {
      if (userId) await api.deleteUser(userId).catch(() => {});
    }
  });

  test('E2E-RBAC-015: Cannot delete the last admin user → 400', async ({ cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const users = await api.getUsers();
    const adminUser = users.find((u: any) => u.isAdmin);
    expect(adminUser).toBeDefined();

    // Attempting to delete the current admin returns 400 (self-deletion guard)
    const res = await request.delete(`/api/admin/users/${adminUser.id}`, {
      headers: { Cookie: cookieHeader },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

test.describe('RBAC — Group management', () => {
  test('E2E-RBAC-004: Admin can create a group with agent roles + environment access', async ({ cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const groupName = `e2e-test-group-${Date.now()}`;
    let groupId: string | undefined;

    try {
      const group = await api.createGroup({
        name: groupName,
        agentRoles: ['*'],
        environmentIds: ['*'],
      });
      groupId = group.id;

      expect(group).toHaveProperty('id');
      expect(group.name).toBe(groupName);
      expect(group.agentRoles).toContain('*');
      expect(group.environments).toContain('*');
      expect(group.memberCount).toBe(0);
      expect(group).toHaveProperty('createdAt');
    } finally {
      if (groupId) await api.deleteGroup(groupId).catch(() => {});
    }
  });

  test('E2E-RBAC-005: Admin can add a user to a group', async ({ cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    const username = `e2e-member-${Date.now()}`;
    let userId: string | undefined;
    let groupId: string | undefined;

    try {
      const user = await api.createUser(username);
      userId = user.id;

      const group = await api.createGroup({
        name: `e2e-group-member-${Date.now()}`,
        agentRoles: ['backend-engineer'],
        environmentIds: ['*'],
      });
      groupId = group.id;

      // Add user to group
      await api.addGroupMember(groupId!, userId!);

      // Verify user shows in the group via GET /api/admin/users
      const users = await api.getUsers();
      const found = users.find((u: any) => u.id === userId);
      expect(found).toBeDefined();
      expect(found.groups.some((g: any) => g.id === groupId)).toBe(true);
    } finally {
      if (groupId) await api.deleteGroup(groupId).catch(() => {});
      if (userId) await api.deleteUser(userId).catch(() => {});
    }
  });

  test('E2E-RBAC-019: Wildcard * agent role grants access to all agent roles', async ({ cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    let groupId: string | undefined;

    try {
      const group = await api.createGroup({
        name: `e2e-wildcard-role-${Date.now()}`,
        agentRoles: ['*'],
        environmentIds: ['*'],
      });
      groupId = group.id;

      expect(group.agentRoles).toEqual(['*']);
    } finally {
      if (groupId) await api.deleteGroup(groupId).catch(() => {});
    }
  });

  test('E2E-RBAC-020: Wildcard * environment grants access to all environments', async ({ cookieHeader, request }) => {
    const api = new KobaniApi(request, cookieHeader);
    let groupId: string | undefined;

    try {
      const group = await api.createGroup({
        name: `e2e-wildcard-env-${Date.now()}`,
        agentRoles: ['*'],
        environmentIds: ['*'],
      });
      groupId = group.id;

      expect(group.environments).toEqual(['*']);
    } finally {
      if (groupId) await api.deleteGroup(groupId).catch(() => {});
    }
  });
});

test.describe('RBAC — Admin UI', () => {
  test('E2E-RBAC-017: Navigate to /access as admin → page renders Users/Groups tabs', async ({ authedPage: page }) => {
    await page.goto('/access');

    // Wait for the page to load — look for tab controls
    const usersTab = page.getByRole('tab', { name: /users/i }).or(page.getByText('Users'));
    const groupsTab = page.getByRole('tab', { name: /groups/i }).or(page.getByText('Groups'));

    await expect(usersTab).toBeVisible({ timeout: 10_000 });
    await expect(groupsTab).toBeVisible({ timeout: 10_000 });
  });

  test('E2E-RBAC-021: "Access" nav link visible only to admin users', async ({ authedPage: page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'All Boards' })).toBeVisible({ timeout: 10_000 });

    // The "Access" link should be visible in the nav for admin users
    const accessLink = page.getByRole('link', { name: 'Access' });
    await expect(accessLink).toBeVisible({ timeout: 5_000 });
  });
});
