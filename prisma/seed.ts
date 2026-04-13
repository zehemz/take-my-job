import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.board.findFirst({ where: { name: "Default Board" } });
  if (existing) {
    console.log("Seed: Default Board already exists, skipping.");
    return;
  }

  const board = await prisma.board.create({
    data: {
      name: "Default Board",
      columns: {
        create: [
          { name: "Backlog", position: 0, isActiveState: false, isTerminalState: false },
          { name: "In Progress", position: 1, isActiveState: true, isTerminalState: false },
          { name: "Review", position: 2, isActiveState: true, isTerminalState: false },
          { name: "Done", position: 3, isActiveState: false, isTerminalState: true },
        ],
      },
    },
    include: { columns: true },
  });

  console.log(`Seed: Created board "${board.name}" with ${board.columns.length} columns.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
