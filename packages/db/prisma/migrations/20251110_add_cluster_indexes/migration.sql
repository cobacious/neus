-- AlreadyApplied
-- CreateIndex on Cluster(headline)
CREATE INDEX IF NOT EXISTS "Cluster_headline_idx" ON "Cluster"("headline");

-- CreateIndex on Cluster(score)
CREATE INDEX IF NOT EXISTS "Cluster_score_idx" ON "Cluster"("score");

-- CreateIndex on Cluster(summary)
CREATE INDEX IF NOT EXISTS "Cluster_summary_idx" ON "Cluster"("summary");
