-- AlterTable
ALTER TABLE "Cluster" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Cluster_slug_key" ON "Cluster"("slug");
