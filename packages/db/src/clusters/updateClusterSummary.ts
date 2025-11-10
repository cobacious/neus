import { prisma } from '../client';
import { generateSlug } from './generateSlug';

export async function updateClusterSummary(id: string, headline: string, summary: string) {
  const slug = generateSlug(headline);

  try {
    await prisma.cluster.update({
      where: { id },
      data: { headline, summary, slug },
    });
  } catch (error: any) {
    // If slug is not unique, add a suffix with part of the cluster ID
    if (error.code === 'P2002') {
      const uniqueSlug = `${slug}-${id.slice(-6)}`;
      await prisma.cluster.update({
        where: { id },
        data: { headline, summary, slug: uniqueSlug },
      });
    } else {
      throw error;
    }
  }
}
