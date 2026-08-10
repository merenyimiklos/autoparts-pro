CREATE TABLE "CustomerGroup" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "priceMultiplier" DECIMAL(6,4) NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX "CustomerGroup_name_key" ON "CustomerGroup"("name");
ALTER TABLE "User" ADD COLUMN "customerGroupId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_customerGroupId_fkey" FOREIGN KEY("customerGroupId") REFERENCES "CustomerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_customerGroupId_idx" ON "User"("customerGroupId");
CREATE TABLE "SystemSetting" (
  "key" TEXT PRIMARY KEY,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
