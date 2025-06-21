import { findDuplicateClusterGroups, printDuplicateClusterGroups } from './duplicateUtils';

async function main() {
  const groups = await findDuplicateClusterGroups();
  if (!groups.length) {
    console.log('No duplicate clusters found.');
    return;
  }

  printDuplicateClusterGroups(groups);
}

main().catch((err) => {
  console.error('[listDuplicateClusters] Error:', err);
  process.exit(1);
});
