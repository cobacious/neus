/*
  Warnings:

  - A unique constraint covering the columns `[articleId]` on the table `ArticleClusterAssignment` will be added. If there are existing duplicate values, this will fail.
*/
-- CreateIndex
CREATE UNIQUE INDEX "ArticleClusterAssignment_articleId_key" ON "ArticleClusterAssignment"("articleId");
