import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const raw = process.env.ALLOWED_GITHUB_USERS ?? '';
  const usernames = raw
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);

  if (usernames.length === 0) {
    console.log('ALLOWED_GITHUB_USERS is empty, skipping RBAC seed.');
    return;
  }

  // Upsert all users
  const users = await Promise.all(
    usernames.map((username, index) =>
      prisma.user.upsert({
        where: { githubUsername: username },
        update: {},
        create: {
          githubUsername: username,
          isAdmin: index === 0,
        },
      })
    )
  );

  // Create the legacy group with wildcard access
  const group = await prisma.userGroup.upsert({
    where: { name: 'legacy-allowlist' },
    update: {},
    create: {
      name: 'legacy-allowlist',
      description:
        'Auto-created from ALLOWED_GITHUB_USERS during RBAC migration',
    },
  });

  // Wildcard agent access
  await prisma.groupAgentAccess.upsert({
    where: { groupId_agentRole: { groupId: group.id, agentRole: '*' } },
    update: {},
    create: { groupId: group.id, agentRole: '*' },
  });

  // Wildcard environment access
  await prisma.groupEnvironmentAccess.upsert({
    where: {
      groupId_environmentId: { groupId: group.id, environmentId: '*' },
    },
    update: {},
    create: { groupId: group.id, environmentId: '*' },
  });

  // Add all users to the group
  await Promise.all(
    users.map((user) =>
      prisma.userGroupMember.upsert({
        where: {
          userId_groupId: { userId: user.id, groupId: group.id },
        },
        update: {},
        create: { userId: user.id, groupId: group.id },
      })
    )
  );

  console.log(`Seeded ${users.length} users into group "${group.name}".`);
  console.log(`Admin: ${usernames[0]}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
