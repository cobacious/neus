import { prisma } from '../client';
import { generateSlug } from '../clusters/generateSlug';

export async function ensureClusterStory(
  clusterId: string,
  headline: string,
  summary?: string | null,
  embedding?: number[] | null
) {
  const cluster = await prisma.cluster.findUnique({
    where: { id: clusterId },
    select: {
      id: true,
      storyId: true,
      headline: true,
      summary: true,
      embedding: true,
      createdAt: true,
    },
  });

  if (!cluster) return null;

  if (cluster.storyId) {
    const story = await prisma.story.findUnique({
      where: { id: cluster.storyId },
      include: { _count: { select: { clusters: true } } },
    });
    if (story && story._count.clusters === 1) {
      return prisma.story.update({
        where: { id: story.id },
        data: {
          title: headline,
          overview: summary || undefined,
          embedding: (embedding || cluster.embedding) as any,
        },
      });
    }
    return story;
  }

  let slug = generateSlug(headline);
  const existingSlug = await prisma.story.findUnique({ where: { slug } });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}-${clusterId.slice(-4)}`;
  }

  const newStory = await prisma.story.create({
    data: {
      title: headline,
      slug,
      overview: summary || null,
      status: 'breaking',
      embedding: (embedding || cluster.embedding) as any,
      createdAt: cluster.createdAt,
    },
  });

  await prisma.cluster.update({
    where: { id: clusterId },
    data: {
      storyId: newStory.id,
      storyAngle: 'Main',
    },
  });

  return newStory;
}
