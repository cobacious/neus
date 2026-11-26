import { prisma } from '../src/client';

interface ReplayBatch {
  name: string;
  startDate: string;
  endDate: string;
}

const NVIDIA_BATCHES: ReplayBatch[] = [
  {
    name: 'Wave 1: Investigation & Affair Admission',
    startDate: '2026-11-08T00:00:00Z',
    endDate: '2026-11-11T23:59:59Z',
  },
  {
    name: 'Wave 2: Resignation & Stock Plunge',
    startDate: '2026-11-12T00:00:00Z',
    endDate: '2026-11-14T23:59:59Z',
  },
  {
    name: 'Wave 3: Industry Support & Q3 Earnings',
    startDate: '2026-11-15T00:00:00Z',
    endDate: '2026-11-20T23:59:59Z',
  },
  {
    name: 'Wave 4: Trump Intervention & Reinstatement',
    startDate: '2026-11-21T00:00:00Z',
    endDate: '2026-11-25T23:59:59Z',
  },
];

async function runTimeMachine() {
  console.log('[TIME MACHINE] Starting historical replay analysis for Nvidia saga in Sandbox DB...');

  for (let i = 0; i < NVIDIA_BATCHES.length; i++) {
    const batch = NVIDIA_BATCHES[i];
    const articles = await prisma.article.findMany({
      where: {
        OR: [
          { title: { contains: 'Jensen', mode: 'insensitive' } },
          { title: { contains: 'Huang', mode: 'insensitive' } },
          { title: { contains: 'Nvidia', mode: 'insensitive' } },
        ],
        publishedAt: {
          gte: new Date(batch.startDate),
          lte: new Date(batch.endDate),
        },
      },
      select: {
        id: true,
        title: true,
        publishedAt: true,
        source: true,
        clusterAssignments: {
          select: {
            clusterId: true,
            cluster: {
              select: {
                id: true,
                headline: true,
                storyId: true,
                storyAngle: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { publishedAt: 'asc' },
    });

    console.log(`\n======================================================`);
    console.log(`BATCH ${i + 1}: ${batch.name}`);
    console.log(`Window: ${batch.startDate.split('T')[0]} to ${batch.endDate.split('T')[0]}`);
    console.log(`Articles in batch: ${articles.length}`);
    console.log(`======================================================`);

    const clusterMap = new Map<string, { headline: string; storyId: string | null; count: number }>();
    let unclusteredCount = 0;

    for (const a of articles) {
      const assignment = a.clusterAssignments[0];
      if (!assignment || !assignment.cluster) {
        unclusteredCount++;
        continue;
      }
      const c = assignment.cluster;
      const existing = clusterMap.get(c.id) || {
        headline: c.headline || 'Untitled',
        storyId: c.storyId,
        count: 0,
      };
      existing.count++;
      clusterMap.set(c.id, existing);
    }

    console.log(`Clusters active in this batch: ${clusterMap.size}`);
    for (const [id, info] of clusterMap.entries()) {
      console.log(`  - [${id}] (${info.count} arts, storyId: ${info.storyId ? info.storyId.slice(0, 10) : 'null'}) "${info.headline.slice(0, 45)}..."`);
    }
    if (unclusteredCount > 0) {
      console.log(`  - Unclustered articles: ${unclusteredCount}`);
    }
  }
}

runTimeMachine()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
