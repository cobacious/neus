import { Prisma } from '@prisma/client';
import { prisma } from '../client';

export async function getRankedClusters(limit?: number, offset?: number) {
  // Query distinct feed representatives: for clusters belonging to a story, select
  // the highest-scoring cluster in that story; for standalone clusters (storyId is null),
  // each cluster represents itself. Order all representatives by score desc.
  const limitClause =
    limit !== undefined && limit !== null ? Prisma.sql`LIMIT ${limit}` : Prisma.empty;
  const offsetClause =
    offset !== undefined && offset !== null ? Prisma.sql`OFFSET ${offset}` : Prisma.empty;

  const rankedIdsResult = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM (
      SELECT DISTINCT ON (COALESCE("storyId", "id"))
        id,
        score,
        "createdAt"
      FROM "Cluster"
      WHERE "headline" IS NOT NULL
        AND "headline" != ''
        AND "summary" IS NOT NULL
        AND "summary" != ''
        AND "archived" = false
      ORDER BY COALESCE("storyId", "id"), score DESC NULLS LAST, "createdAt" DESC
    ) sub
    ORDER BY score DESC NULLS LAST, "createdAt" DESC
    ${limitClause}
    ${offsetClause}
  `);

  const ids = rankedIdsResult.map((r) => r.id);
  if (ids.length === 0) {
    return [];
  }

  const clusters = await prisma.cluster.findMany({
    where: {
      id: { in: ids },
    },
    include: {
      story: {
        include: {
          clusters: {
            where: { archived: false },
            orderBy: { createdAt: 'asc' },
            include: {
              articleAssignments: {
                select: {
                  createdAt: true,
                  article: {
                    select: {
                      id: true,
                      url: true,
                      title: true,
                      source: true,
                      publishedAt: true,
                      author: true,
                      sourceRel: {
                        select: {
                          id: true,
                          name: true,
                          faviconUrl: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      articleAssignments: {
        select: {
          createdAt: true,
          article: {
            select: {
              id: true,
              url: true,
              title: true,
              source: true,
              publishedAt: true,
              author: true,
              sourceRel: {
                select: {
                  id: true,
                  name: true,
                  faviconUrl: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Preserve the ranked ordering from the initial query
  const clusterMap = new Map(clusters.map((c) => [c.id, c]));
  return ids.map((id) => clusterMap.get(id)).filter(Boolean) as typeof clusters;
}
