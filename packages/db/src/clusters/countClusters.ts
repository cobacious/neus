import { Prisma } from '@prisma/client';
import { prisma } from '../client';

export async function countClusters(): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ count: number | bigint }>>(Prisma.sql`
    SELECT COUNT(*)::int as count FROM (
      SELECT DISTINCT ON (COALESCE("storyId", "id"))
        id
      FROM "Cluster"
      WHERE "headline" IS NOT NULL
        AND "headline" != ''
        AND "summary" IS NOT NULL
        AND "summary" != ''
        AND "archived" = false
    ) sub
  `);

  return Number(result[0]?.count ?? 0);
}
