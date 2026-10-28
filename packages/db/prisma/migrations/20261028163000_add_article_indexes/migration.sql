-- CreateIndex
CREATE INDEX IF NOT EXISTS "Article_publishedAt_idx" ON "Article"("publishedAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Article_createdAt_idx" ON "Article"("createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Article_sourceId_idx" ON "Article"("sourceId");
