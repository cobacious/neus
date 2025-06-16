/*
  Warnings:

  - Added the required column `sourceId` to the `Article` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "homepageUrl" TEXT,
    "rssFeedUrl" TEXT NOT NULL,
    "faviconUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT,
    "content" TEXT,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "rawHtml" TEXT,
    "embedding" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Article_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Article" ("content", "createdAt", "embedding", "id", "publishedAt", "rawHtml", "snippet", "source", "title", "url") SELECT "content", "createdAt", "embedding", "id", "publishedAt", "rawHtml", "snippet", "source", "title", "url" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE UNIQUE INDEX "Article_url_key" ON "Article"("url");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
