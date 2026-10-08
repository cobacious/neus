import { prisma } from '../client';
import { generateSlug } from '../clusters/generateSlug';

export type StoryAngleInput = {
  clusterId: string;
  angle: string;
};

export type StoryInput = {
  storyTitle: string;
  status?: string;
  overview?: string;
  angles: StoryAngleInput[];
};

export async function syncStoryWithAngles(input: StoryInput) {
  if (!input.angles || input.angles.length === 0) {
    return null;
  }

  const clusterIds = input.angles.map((a) => a.clusterId);

  // 1. Check if any of these clusters already belong to an existing Story
  const existingClusters = await prisma.cluster.findMany({
    where: { id: { in: clusterIds } },
    select: { id: true, storyId: true },
  });

  const existingStoryId = existingClusters.find((c) => c.storyId)?.storyId;

  let story;
  if (existingStoryId) {
    // Update existing story details
    story = await prisma.story.update({
      where: { id: existingStoryId },
      data: {
        title: input.storyTitle,
        overview: input.overview,
        status: input.status || 'evolving',
      },
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
        status: input.status || 'evolving',
      },
    });
  }

  // 2. Assign each cluster to this story and tag its angle
  for (const item of input.angles) {
    await prisma.cluster.update({
      where: { id: item.clusterId },
      data: {
        storyId: story.id,
        storyAngle: item.angle,
      },
    });
  }

  return story;
}
