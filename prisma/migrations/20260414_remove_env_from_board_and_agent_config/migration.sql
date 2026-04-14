-- AlterTable: remove environment columns from Board and AgentConfig
-- Environment is now only tracked at the Card level.

ALTER TABLE "Board" DROP COLUMN IF EXISTS "anthropicEnvironmentId";
ALTER TABLE "AgentConfig" DROP COLUMN IF EXISTS "anthropicEnvironmentId";
