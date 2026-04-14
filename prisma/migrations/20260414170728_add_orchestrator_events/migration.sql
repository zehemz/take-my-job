-- CreateTable
CREATE TABLE "OrchestratorEvent" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "runId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrchestratorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrchestratorEvent_cardId_createdAt_idx" ON "OrchestratorEvent"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "OrchestratorEvent_boardId_type_createdAt_idx" ON "OrchestratorEvent"("boardId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_cardId_status_idx" ON "AgentRun"("cardId", "status");

-- CreateIndex
CREATE INDEX "AgentRun_status_retryAfterMs_idx" ON "AgentRun"("status", "retryAfterMs");

-- AddForeignKey
ALTER TABLE "OrchestratorEvent" ADD CONSTRAINT "OrchestratorEvent_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrchestratorEvent" ADD CONSTRAINT "OrchestratorEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
