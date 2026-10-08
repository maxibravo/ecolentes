-- CreateEnum
CREATE TYPE "SocialNetwork" AS ENUM ('WHATSAPP', 'FACEBOOK', 'INSTAGRAM');

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "socialNetwork" "SocialNetwork";

-- AlterTable
ALTER TABLE "people" ADD COLUMN     "identityVerified" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "cases_channel_idx" ON "cases"("channel");
