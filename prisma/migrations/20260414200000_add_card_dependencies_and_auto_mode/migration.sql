-- AlterTable
ALTER TABLE "Board" ADD COLUMN "autoMode" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable (implicit many-to-many join table for Card.dependsOn)
CREATE TABLE "_CardDependency" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CardDependency_A_fkey" FOREIGN KEY ("A") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CardDependency_B_fkey" FOREIGN KEY ("B") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_CardDependency_AB_unique" ON "_CardDependency"("A", "B");

-- CreateIndex
CREATE INDEX "_CardDependency_B_index" ON "_CardDependency"("B");
