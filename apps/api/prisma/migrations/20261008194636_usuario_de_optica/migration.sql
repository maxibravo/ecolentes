-- AlterTable
ALTER TABLE "users" ADD COLUMN     "opticianId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_opticianId_fkey" FOREIGN KEY ("opticianId") REFERENCES "opticians"("id") ON DELETE SET NULL ON UPDATE CASCADE;
