import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ── Board with all column types ──────────────────────────────────────────
  const existingBoard = await prisma.board.findFirst({ where: { name: "Default Board" } });
  if (!existingBoard) {
    const board = await prisma.board.create({
      data: {
        name: "Default Board",
        columns: {
          create: [
            { name: "Backlog",     position: 0, columnType: "inactive", isActiveState: false, isTerminalState: false },
            { name: "In Progress", position: 1, columnType: "active",   isActiveState: true,  isTerminalState: false },
            { name: "Blocked",     position: 2, columnType: "blocked",  isActiveState: false, isTerminalState: false },
            { name: "Review",      position: 3, columnType: "review",   isActiveState: false, isTerminalState: false },
            { name: "Revision",    position: 4, columnType: "revision", isActiveState: false, isTerminalState: false },
            { name: "Done",        position: 5, columnType: "terminal", isActiveState: false, isTerminalState: true  },
          ],
        },
      },
      include: { columns: true },
    });
    console.log(`Seed: Created board "${board.name}" with ${board.columns.length} columns.`);
  } else {
    console.log("Seed: Default Board already exists, skipping.");
  }

  // ── E2E test user (admin) ────────────────────────────────────────────────
  // The Playwright fixtures sign in as "testuser" (see e2e/fixtures.ts).
  // Without a User row the RBAC layer returns 403 on every authenticated call.
  const testUsername = process.env.TEST_GITHUB_USERNAME ?? "testuser";
  const existingUser = await prisma.user.findUnique({
    where: { githubUsername: testUsername },
  });
  if (!existingUser) {
    await prisma.user.create({
      data: { githubUsername: testUsername, isAdmin: true },
    });
    console.log(`Seed: Created admin user "${testUsername}".`);
  } else {
    console.log(`Seed: User "${testUsername}" already exists, skipping.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
