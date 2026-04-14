-- CreateEnum
CREATE TYPE "ColumnType" AS ENUM ('inactive', 'active', 'review', 'revision', 'terminal');

-- AlterTable Column
ALTER TABLE "Column" ADD COLUMN "columnType" "ColumnType" NOT NULL DEFAULT 'inactive';

-- AlterTable Card
ALTER TABLE "Card" ADD COLUMN "movedToColumnAt" TIMESTAMP(3),
ADD COLUMN "revisionContextNote" TEXT,
ADD COLUMN "approvedBy" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3);

-- AlterTable AgentRun
ALTER TABLE "AgentRun" ADD COLUMN "columnId" TEXT;

-- Backfill columnType from booleans + column name heuristic
UPDATE "Column"
SET "columnType" = CASE
  WHEN "isTerminalState" = true THEN 'terminal'::"ColumnType"
  WHEN "isActiveState" = true AND lower("name") LIKE '%review%' THEN 'review'::"ColumnType"
  WHEN "isActiveState" = true THEN 'active'::"ColumnType"
  ELSE 'inactive'::"ColumnType"
END;
