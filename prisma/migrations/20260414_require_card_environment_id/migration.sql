-- Make Card.environmentId required (non-nullable).
-- Backfill any existing NULLs with empty string before adding the constraint.
UPDATE "Card" SET "environmentId" = '' WHERE "environmentId" IS NULL;
ALTER TABLE "Card" ALTER COLUMN "environmentId" SET NOT NULL;
ALTER TABLE "Card" ALTER COLUMN "environmentId" SET DEFAULT '';
