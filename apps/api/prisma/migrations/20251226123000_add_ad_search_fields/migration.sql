-- AlterTable
ALTER TABLE "Ad" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Ad" ADD COLUMN "price" INTEGER;
ALTER TABLE "Ad" ADD COLUMN "lat" DOUBLE PRECISION;
ALTER TABLE "Ad" ADD COLUMN "lng" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Ad_price_idx" ON "Ad"("price");
CREATE INDEX "Ad_lat_lng_idx" ON "Ad"("lat", "lng");
