/*
  Warnings:

  - A unique constraint covering the columns `[articleId,clusterId]` on the table `ArticleClusterAssignment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ArticleClusterAssignment_articleId_clusterId_key" ON "ArticleClusterAssignment"("articleId", "clusterId");
