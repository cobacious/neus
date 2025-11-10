-- AlterTable
ALTER TABLE "Cluster" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Cluster_archived_idx" ON "Cluster"("archived");
