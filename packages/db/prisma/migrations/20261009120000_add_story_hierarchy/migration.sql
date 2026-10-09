-- AlterTable
ALTER TABLE "Cluster" ADD COLUMN     "storyAngle" TEXT,
ADD COLUMN     "storyId" TEXT;

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "overview" TEXT,
    "status" TEXT NOT NULL DEFAULT 'developing',
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Story_slug_key" ON "Story"("slug");

-- CreateIndex
CREATE INDEX "Story_status_idx" ON "Story"("status");

-- CreateIndex
CREATE INDEX "Cluster_storyId_idx" ON "Cluster"("storyId");

-- AddForeignKey
ALTER TABLE "Cluster" ADD CONSTRAINT "Cluster_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE SET NULL ON UPDATE CASCADE;
