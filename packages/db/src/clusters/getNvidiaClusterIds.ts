import { prisma } from '../client';

/**
 * Returns cluster IDs associated with Nvidia / Jensen Huang articles in the database.
 */
export async function getNvidiaClusterIds(): Promise<string[]> {
  const clusters = await prisma.cluster.findMany({
    where: {
      archived: false,
      articleAssignments: {
        some: {
          article: {
            OR: [
              { title: { contains: 'Jensen', mode: 'insensitive' } },
              { title: { contains: 'Huang', mode: 'insensitive' } },
              { title: { contains: 'Nvidia', mode: 'insensitive' } },
            ],
          },
        },
      },
    },
    select: { id: true },
  });

  return clusters.map((c) => c.id);
}
