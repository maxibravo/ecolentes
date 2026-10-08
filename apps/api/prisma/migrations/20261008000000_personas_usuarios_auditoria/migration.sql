-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OPERATOR', 'OPHTHALMOLOGIST', 'OPTICIAN', 'DIRECTOR', 'SOCIAL_DESK', 'ADMIN');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('FEMENINO', 'MASCULINO', 'OTRO');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('VIEW', 'CREATE', 'UPDATE', 'LOGIN', 'LOGIN_FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "ageAtIntake" INTEGER,
    "ageTakenAt" TIMESTAMP(3),
    "sex" "Sex",
    "phone" TEXT,
    "address" TEXT,
    "neighborhood" TEXT,
    "representativeName" TEXT,
    "representativePhone" TEXT,
    "representativeBond" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "changes" JSONB,
    "userId" TEXT,
    "username" TEXT,
    "ipAddress" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "people_dni_key" ON "people"("dni");

-- CreateIndex
CREATE INDEX "people_lastName_firstName_idx" ON "people"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "people_neighborhood_idx" ON "people"("neighborhood");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_occurredAt_idx" ON "audit_logs"("occurredAt");

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

