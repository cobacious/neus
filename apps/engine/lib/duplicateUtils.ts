import { getClustersWithArticles, Cluster } from '@neus/db';
import { cosineSimilarity, jaccard } from '../core/pipeline/utils';

const EMBEDDING_THRESHOLD = 0.9;

export async function findDuplicateClusterGroups(): Promise<Cluster[][]> {
  const clusters = await getClustersWithArticles();
  if (!clusters.length) return [];

  const clusterMap = new Map(clusters.map((c) => [c.id, c]));
  const edges: [string, string][] = [];

  for (let i = 0; i < clusters.length; i++) {
    const a = clusters[i];
    const aEmb = Array.isArray(a.embedding) ? (a.embedding as number[]) : null;
    const aIds = a.articleAssignments.map((aa) => aa.articleId);
    for (let j = i + 1; j < clusters.length; j++) {
      const b = clusters[j];
      const bEmb = Array.isArray(b.embedding) ? (b.embedding as number[]) : null;
      const bIds = b.articleAssignments.map((aa) => aa.articleId);

      let similar = false;
      if (aEmb && bEmb && cosineSimilarity(aEmb, bEmb) > EMBEDDING_THRESHOLD) {
        similar = true;
      } else if (jaccard(aIds, bIds) > 0.8) {
        similar = true;
      }
      if (similar) edges.push([a.id, b.id]);
    }
  }

  const visited = new Set<string>();
  const groups: Cluster[][] = [];
  for (const cluster of clusters) {
    if (visited.has(cluster.id)) continue;
    const stack = [cluster.id];
    const ids: string[] = [];
    while (stack.length) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      ids.push(id);
      edges
        .filter((e) => e[0] === id || e[1] === id)
        .map((e) => (e[0] === id ? e[1] : e[0]))
        .forEach((n) => {
          if (!visited.has(n)) stack.push(n);
        });
    }
    if (ids.length > 1) {
      groups.push(ids.map((id) => clusterMap.get(id)!));
    }
  }

  return groups;
}

export function printDuplicateClusterGroups(groups: Cluster[][]) {
  console.log(`Found ${groups.length} duplicate cluster groups.`);
  groups.forEach((group, i) => {
    console.log('-'.repeat(80));
    console.log(`Group ${i + 1}:`);
    group.forEach((c) => {
      const headline = c.headline ? ` ${c.headline}` : '';
      console.log(`  ID: ${c.id}${headline} (articles: ${c.articleAssignments.length})`);
    });
  });
}
