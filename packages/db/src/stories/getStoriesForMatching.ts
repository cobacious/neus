import { prisma } from '../client';

/**
 * Fetches existing stories (both active and dormant) with their titles, overviews, and embeddings
 * so the clustering pipeline can evaluate if new clusters attach to existing stories.
 */
export async function getStoriesForMatching() {
  return prisma.story.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      overview: true,
      status: true,
      embedding: true,
      updatedAt: true,
      _count: {
        select: { clusters: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}
