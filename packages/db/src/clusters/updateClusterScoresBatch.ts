import { Prisma } from '@prisma/client';
import { prisma } from '../client';

export interface ClusterScoreUpdate {
  id: string;
  score: number;
}

/**
 * Updates multiple cluster scores in batch using PostgreSQL UPDATE ... FROM VALUES.
 * Chunks updates in batches of 500 to keep parameter counts well within Postgres limits.
 */
export async function updateClusterScoresBatch(
  updates: ClusterScoreUpdate[]
): Promise<number> {
  if (updates.length === 0) return 0;

  const CHUNK_SIZE = 500;
  let totalUpdated = 0;

  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    const values = chunk.map((u) => Prisma.sql`(${u.id}::text, ${u.score}::float8)`);

    const updated = await prisma.$executeRaw(Prisma.sql`
      UPDATE "Cluster" AS c
      SET score = v.score
      FROM (VALUES ${Prisma.join(values)}) AS v(id, score)
      WHERE c.id = v.id
    `);
    totalUpdated += updated;
  }

  return totalUpdated;
}
