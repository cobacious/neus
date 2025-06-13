import { prisma } from '../client';

export type ClusterAssignment = {
  articleId: string;
  clusterId: string;
  similarity: number;
  method: string;
};

export async function createArticleAssignments(assignments: ClusterAssignment[]) {
  await prisma.articleClusterAssignment.createMany({ data: assignments });
}
