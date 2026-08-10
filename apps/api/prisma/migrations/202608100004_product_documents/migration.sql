CREATE TABLE "ProductDocument" (
  "id" TEXT PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
  "sortOrder" INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE "ProductDocument" ADD CONSTRAINT "ProductDocument_productId_fkey" FOREIGN KEY("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ProductDocument_productId_sortOrder_idx" ON "ProductDocument"("productId","sortOrder");
