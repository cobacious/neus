-- AlterTable
ALTER TABLE "Cluster" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Story" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cluster_tags_idx" ON "Cluster" USING GIN ("tags");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Story_tags_idx" ON "Story" USING GIN ("tags");
