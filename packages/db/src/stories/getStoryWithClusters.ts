import { prisma } from '../client';

export async function getStoryById(id: string) {
  return prisma.story.findUnique({
    where: { id },
    include: {
      clusters: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function getStoryBySlug(slug: string) {
  return prisma.story.findUnique({
    where: { slug },
    include: {
      clusters: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function getClusterWithStory(clusterId: string) {
  return prisma.cluster.findUnique({
    where: { id: clusterId },
    include: {
      story: {
        include: {
          clusters: {
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });
}
