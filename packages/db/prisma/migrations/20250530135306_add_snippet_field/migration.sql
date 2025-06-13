-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "snippet" TEXT,
    "content" TEXT,
    "source" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "rawHtml" TEXT,
    "embedding" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Article" ("content", "createdAt", "embedding", "id", "publishedAt", "rawHtml", "source", "title") SELECT "content", "createdAt", "embedding", "id", "publishedAt", "rawHtml", "source", "title" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
