import { prisma } from '../src/client.js';
import { generateSlug } from '../src/clusters/generateSlug.js';

async function populateSlugs() {
  console.log('Fetching clusters with headlines but no slugs...');

  const clusters = await prisma.cluster.findMany({
    where: {
      headline: { not: null },
      slug: null,
    },
    select: {
      id: true,
      headline: true,
    },
  });

  console.log(`Found ${clusters.length} clusters to update`);

  let updated = 0;
  let skipped = 0;

  for (const cluster of clusters) {
    if (!cluster.headline) {
      skipped++;
      continue;
    }

    try {
      const slug = generateSlug(cluster.headline);

      await prisma.cluster.update({
        where: { id: cluster.id },
        data: { slug },
      });

      updated++;
      console.log(`✓ Updated cluster ${cluster.id}: ${slug}`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation - slug already exists
        // Try adding a suffix
        const slug = generateSlug(cluster.headline);
        const newSlug = `${slug}-${cluster.id.slice(-6)}`;

        try {
          await prisma.cluster.update({
            where: { id: cluster.id },
            data: { slug: newSlug },
          });
          updated++;
          console.log(`✓ Updated cluster ${cluster.id} with suffix: ${newSlug}`);
        } catch (retryError) {
          console.error(`✗ Failed to update cluster ${cluster.id}:`, retryError);
          skipped++;
        }
      } else {
        console.error(`✗ Failed to update cluster ${cluster.id}:`, error);
        skipped++;
      }
    }
  }

  console.log(`\nCompleted: ${updated} updated, ${skipped} skipped`);

  await prisma.$disconnect();
}

populateSlugs().catch((error) => {
  console.error('Error populating slugs:', error);
  process.exit(1);
});
