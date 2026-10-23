import { prisma } from '../client';
import { generateSlug } from '../clusters/generateSlug';

export type StoryThreadInput = {
  clusterId: string;
  thread: string;
};

// Backward compatibility alias
export type StoryAngleInput = {
  clusterId: string;
  angle: string;
};

export type StoryInput = {
  storyTitle: string;
  existingStoryId?: string;
  status?: string;
  overview?: string;
  embedding?: number[] | null;
  threads?: StoryThreadInput[];
  angles?: StoryAngleInput[];
};

export async function syncStoryWithThreads(input: StoryInput) {
  const normalizedThreads: StoryThreadInput[] =
    input.threads ||
    (input.angles ? input.angles.map((a) => ({ clusterId: a.clusterId, thread: a.angle })) : []);

  if (!normalizedThreads || normalizedThreads.length === 0) {
    return null;
  }

  const clusterIds = normalizedThreads.map((t) => t.clusterId);

  // 1. Check if an explicit story ID was provided or if any clusters already belong to an existing Story
  let targetStoryId: string | null | undefined = input.existingStoryId;

  if (!targetStoryId) {
    const existingClusters = await prisma.cluster.findMany({
      where: { id: { in: clusterIds } },
      select: { id: true, storyId: true },
    });
    targetStoryId = existingClusters.find((c) => c.storyId)?.storyId;
  }

  let story;
  if (targetStoryId) {
    // Update existing story details and reactivate status
    const updateData: Record<string, any> = {
      title: input.storyTitle,
      overview: input.overview,
      status: input.status || 'developing',
    };
    if (input.embedding) {
      updateData.embedding = input.embedding;
    }

    story = await prisma.story.update({
      where: { id: targetStoryId },
      data: updateData,
    });
  } else {
    // Create a new Story
    let slug = generateSlug(input.storyTitle);
    const existingSlug = await prisma.story.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    story = await prisma.story.create({
      data: {
        title: input.storyTitle,
        slug,
        overview: input.overview,
        status: input.status || 'developing',
        embedding: input.embedding ? (input.embedding as any) : undefined,
      },
    });
  }

  // 2. Assign each cluster to this story and tag its thread (stored in cluster.storyAngle)
  for (const item of normalizedThreads) {
    await prisma.cluster.update({
      where: { id: item.clusterId },
      data: {
        storyId: story.id,
        storyAngle: item.thread,
      },
    });
  }

  // 3. Detach any clusters previously assigned to this story that are not in the new threads
  await prisma.cluster.updateMany({
    where: {
      storyId: story.id,
      id: { notIn: clusterIds },
    },
    data: {
      storyId: null,
      storyAngle: null,
    },
  });

  return story;
}

// Backward compatibility alias
export const syncStoryWithAngles = syncStoryWithThreads;
