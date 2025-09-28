-- CreateTable
CREATE TABLE "public"."CommandLog" (
    "id" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandLog_pkey" PRIMARY KEY ("id")
);
