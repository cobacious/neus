import { prisma } from '../client';

export async function updateStoryTags(id: string, tags: string[]) {
  return prisma.story.update({
    where: { id },
    data: { tags },
  });
}
