-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT,
    "content" TEXT,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "author" TEXT,
    "categories" TEXT,
    "rawHtml" TEXT,
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cluster" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT,
    "origin" TEXT NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "embedding" JSONB,
    "score" DOUBLE PRECISION DEFAULT 0,

    CONSTRAINT "Cluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "homepageUrl" TEXT,
    "rssFeedUrl" TEXT NOT NULL,
    "faviconUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "trustScore" DOUBLE PRECISION DEFAULT 0,
    "lastFetchedAt" TIMESTAMP(3),

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleClusterAssignment" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION,
    "method" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleClusterAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_url_key" ON "Article"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Source_rssFeedUrl_key" ON "Source"("rssFeedUrl");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleClusterAssignment_articleId_key" ON "ArticleClusterAssignment"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleClusterAssignment_articleId_clusterId_key" ON "ArticleClusterAssignment"("articleId", "clusterId");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleClusterAssignment" ADD CONSTRAINT "ArticleClusterAssignment_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleClusterAssignment" ADD CONSTRAINT "ArticleClusterAssignment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
