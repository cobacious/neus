import { prisma } from '../client';

const storyClusterInclude = {
  clusters: {
    where: { archived: false },
    orderBy: { createdAt: 'asc' as const },
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
};

export async function getStoryById(id: string) {
  return prisma.story.findUnique({
    where: { id },
    include: storyClusterInclude,
  });
}

export async function getStoryBySlug(slug: string) {
  return prisma.story.findUnique({
    where: { slug },
    include: storyClusterInclude,
  });
}

export async function getStories(options?: { status?: string; limit?: number; offset?: number }) {
  const where: any = {};
  if (options?.status) {
    where.status = options.status;
  }
  return prisma.story.findMany({
    where,
    include: storyClusterInclude,
    orderBy: { updatedAt: 'desc' },
    take: options?.limit,
    skip: options?.offset,
  });
}

export async function getClusterWithStory(clusterId: string) {
  return prisma.cluster.findUnique({
    where: { id: clusterId },
    include: {
      story: {
        include: storyClusterInclude,
      },
    },
  });
}

