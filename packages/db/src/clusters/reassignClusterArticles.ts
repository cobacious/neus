import { prisma } from '../client';

export async function reassignClusterArticles(fromId: string, toId: string) {
  await prisma.articleClusterAssignment.updateMany({
    where: { clusterId: fromId },
    data: { clusterId: toId },
  });
}
