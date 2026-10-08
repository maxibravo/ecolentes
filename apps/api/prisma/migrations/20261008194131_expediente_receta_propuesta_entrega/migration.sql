-- CreateEnum
CREATE TYPE "CaseStage" AS ENUM ('REQUEST', 'ASSESSMENT', 'OPTICIAN_QUOTE', 'APPROVAL', 'PRODUCTION', 'RECEIVED', 'READY_FOR_PICKUP', 'DELIVERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IntakeChannel" AS ENUM ('NEIGHBORHOOD_SURVEY', 'COUNCIL_REQUEST', 'INDIVIDUAL_REQUEST', 'TRAILER', 'CAC', 'SCHOOL', 'SOCIAL_MEDIA', 'PUBLIC_FORM');

-- CreateEnum
CREATE TYPE "CaseHold" AS ENUM ('MISSING_DOCUMENTS', 'QUOTE_OBSERVED', 'REJECTED', 'DELAYED', 'NOT_LOCATED', 'WITHDRAWN', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'OBSERVED');

-- CreateTable
CREATE TABLE "operations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "ophthalmologistId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opticians" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "opticians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "stage" "CaseStage" NOT NULL DEFAULT 'REQUEST',
    "hold" "CaseHold",
    "holdNote" TEXT,
    "channel" "IntakeChannel" NOT NULL,
    "operationId" TEXT,
    "opticianId" TEXT,
    "pairs" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT,
    "stageSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "farRightSphere" DECIMAL(4,2),
    "farRightCylinder" DECIMAL(4,2),
    "farRightAxis" INTEGER,
    "farLeftSphere" DECIMAL(4,2),
    "farLeftCylinder" DECIMAL(4,2),
    "farLeftAxis" INTEGER,
    "nearAddition" DECIMAL(4,2),
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "opticianId" TEXT NOT NULL,
    "lenses" TEXT NOT NULL,
    "frame" TEXT NOT NULL,
    "leadDays" INTEGER,
    "amount" DECIMAL(12,2),
    "notes" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'SUBMITTED',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "receivedBy" TEXT NOT NULL,
    "isRepresentative" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "handedById" TEXT,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_events" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromStage" "CaseStage",
    "toStage" "CaseStage",
    "hold" "CaseHold",
    "note" TEXT,
    "userId" TEXT,
    "username" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operations_date_idx" ON "operations"("date");

-- CreateIndex
CREATE UNIQUE INDEX "opticians_name_key" ON "opticians"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cases_code_key" ON "cases"("code");

-- CreateIndex
CREATE INDEX "cases_stage_idx" ON "cases"("stage");

-- CreateIndex
CREATE INDEX "cases_personId_idx" ON "cases"("personId");

-- CreateIndex
CREATE INDEX "cases_opticianId_idx" ON "cases"("opticianId");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_caseId_key" ON "prescriptions"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_caseId_version_key" ON "quotes"("caseId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_caseId_key" ON "deliveries"("caseId");

-- CreateIndex
CREATE INDEX "case_events_caseId_occurredAt_idx" ON "case_events"("caseId", "occurredAt");

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_ophthalmologistId_fkey" FOREIGN KEY ("ophthalmologistId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_opticianId_fkey" FOREIGN KEY ("opticianId") REFERENCES "opticians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_opticianId_fkey" FOREIGN KEY ("opticianId") REFERENCES "opticians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_handedById_fkey" FOREIGN KEY ("handedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
