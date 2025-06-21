-- AlterTable
ALTER TABLE "Article" ADD COLUMN "author" TEXT;
ALTER TABLE "Article" ADD COLUMN "categories" TEXT;
ALTER TABLE "Article" ADD COLUMN "updatedAt" DATETIME;

-- AlterTable
ALTER TABLE "Cluster" ADD COLUMN "score" REAL DEFAULT 0;

-- AlterTable
ALTER TABLE "Source" ADD COLUMN "trustScore" REAL DEFAULT 0;
