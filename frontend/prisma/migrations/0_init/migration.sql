-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "FlowType" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('REVENUE', 'PAYROLL', 'OPERATING_EXPENSES', 'SOFTWARE', 'TAXES', 'MARKETING', 'OTHER');

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "type" "FlowType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecasted_data" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "predictedInflow" DECIMAL(14,2) NOT NULL,
    "predictedOutflow" DECIMAL(14,2) NOT NULL,
    "predictedBalance" DECIMAL(14,2) NOT NULL,
    "model" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecasted_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "transactions_category_idx" ON "transactions"("category");

-- CreateIndex
CREATE UNIQUE INDEX "forecasted_data_date_key" ON "forecasted_data"("date");

-- CreateIndex
CREATE INDEX "forecasted_data_date_idx" ON "forecasted_data"("date");

