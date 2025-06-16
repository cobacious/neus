/*
  Warnings:

  - A unique constraint covering the columns `[rssFeedUrl]` on the table `Source` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Source_rssFeedUrl_key" ON "Source"("rssFeedUrl");
