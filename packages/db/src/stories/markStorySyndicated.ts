import { prisma } from '../client';

export async function markStorySyndicated(storyId: string, blueskyUri: string): Promise<void> {
  await prisma.story.update({
    where: { id: storyId },
    data: {
      postedToBlueskyAt: new Date(),
      blueskyUri,
    },
  });
}
