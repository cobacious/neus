import { deleteCluster, reassignClusterArticles } from '@neus/db';
import {
  findDuplicateClusterGroups,
  printDuplicateClusterGroups,
} from './duplicateUtils';

async function main() {
  const groups = await findDuplicateClusterGroups();

  if (!groups.length) {
    console.log('No duplicate clusters found.');
    return;
  }

  printDuplicateClusterGroups(groups);

  for (const group of groups) {
    const keeper = group.reduce((best, c) =>
      c.articleAssignments.length > best.articleAssignments.length ? c : best
    );
    for (const c of group) {
      if (c.id === keeper.id) continue;
      if (c.articleAssignments.length > 0) {
        try {
          await reassignClusterArticles(c.id, keeper.id);
          console.log(
            `Moved ${c.articleAssignments.length} articles from ${c.id} to ${keeper.id}`
          );
        } catch (err) {
          console.error(`Failed to move articles from ${c.id}:`, err);
          continue;
        }
      }
      try {
        await deleteCluster(c.id);
        console.log(`Deleted cluster ${c.id}`);
      } catch (err) {
        console.error(`Failed to delete ${c.id}:`, err);
      }
    }
  }
}

main().catch((err) => {
  console.error('[dedupeClusters] Error:', err);
  process.exit(1);
});

