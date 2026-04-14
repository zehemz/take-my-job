-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "githubUsername" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGroupMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupAgentAccess" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "agentRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupAgentAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupEnvironmentAccess" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupEnvironmentAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubUsername_key" ON "User"("githubUsername");

-- CreateIndex
CREATE UNIQUE INDEX "UserGroup_name_key" ON "UserGroup"("name");

-- CreateIndex
CREATE INDEX "UserGroupMember_userId_idx" ON "UserGroupMember"("userId");

-- CreateIndex
CREATE INDEX "UserGroupMember_groupId_idx" ON "UserGroupMember"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGroupMember_userId_groupId_key" ON "UserGroupMember"("userId", "groupId");

-- CreateIndex
CREATE INDEX "GroupAgentAccess_groupId_idx" ON "GroupAgentAccess"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupAgentAccess_groupId_agentRole_key" ON "GroupAgentAccess"("groupId", "agentRole");

-- CreateIndex
CREATE INDEX "GroupEnvironmentAccess_groupId_idx" ON "GroupEnvironmentAccess"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupEnvironmentAccess_groupId_environmentId_key" ON "GroupEnvironmentAccess"("groupId", "environmentId");

-- AddForeignKey
ALTER TABLE "UserGroupMember" ADD CONSTRAINT "UserGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGroupMember" ADD CONSTRAINT "UserGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAgentAccess" ADD CONSTRAINT "GroupAgentAccess_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupEnvironmentAccess" ADD CONSTRAINT "GroupEnvironmentAccess_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
