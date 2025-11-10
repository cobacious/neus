import { prisma } from '../client.js';
import { generateSlug } from './generateSlug.js';

export async function updateClusterSlug(clusterId: string, headline: string) {
  const slug = generateSlug(headline);

  return prisma.cluster.update({
    where: { id: clusterId },
    data: { slug },
  });
}
