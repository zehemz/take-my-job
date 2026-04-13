-- CreateTable
CREATE TABLE "RunEvent" (
    "id" SERIAL NOT NULL,
    "cardId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardEvent" (
    "id" SERIAL NOT NULL,
    "boardId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RunEvent_cardId_id_idx" ON "RunEvent"("cardId", "id");

-- CreateIndex
CREATE INDEX "BoardEvent_boardId_id_idx" ON "BoardEvent"("boardId", "id");
