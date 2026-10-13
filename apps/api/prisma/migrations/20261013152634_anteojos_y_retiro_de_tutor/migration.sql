-- CreateEnum
CREATE TYPE "GlassesKind" AS ENUM ('LEJOS', 'CERCA');

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "receivedByDni" TEXT;

-- CreateTable
CREATE TABLE "glasses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" "GlassesKind" NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "glasses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "glasses_code_key" ON "glasses"("code");

-- CreateIndex
CREATE INDEX "glasses_caseId_idx" ON "glasses"("caseId");

-- AddForeignKey
ALTER TABLE "glasses" ADD CONSTRAINT "glasses_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
