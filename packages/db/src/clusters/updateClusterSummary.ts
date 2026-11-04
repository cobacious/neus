import { prisma } from '../client';
import { generateSlug } from './generateSlug';

export async function updateClusterSummary(
  id: string,
  headline: string,
  summary: string,
  tags?: string[]
) {
  const slug = generateSlug(headline);
  const data: Record<string, any> = { headline, summary, slug };
  if (tags !== undefined) {
    data.tags = tags;
  }

  try {
    await prisma.cluster.update({
      where: { id },
      data,
    });
  } catch (error: any) {
    // If slug is not unique, add a suffix with part of the cluster ID
    if (error.code === 'P2002') {
      const uniqueSlug = `${slug}-${id.slice(-6)}`;
      await prisma.cluster.update({
        where: { id },
        data: { ...data, slug: uniqueSlug },
      });
    } else {
      throw error;
    }
  }
}
