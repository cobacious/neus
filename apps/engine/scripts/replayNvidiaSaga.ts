import '../env';
import {
  resetNvidiaSagaSandbox,
  getNvidiaArticlesByDateRange,
  getNvidiaClusterIds,
  getStories,
} from '@neus/db';
import { clusterRecentArticles } from '../core/pipeline/clusterArticles';
import { summarizeClusters } from '../core/pipeline/summarizeClusters';
import { organizeStoryThreads } from '../core/pipeline/organizeStoryThreads';

interface ReplayWave {
  name: string;
  startDate: string;
  endDate: string;
}

const WAVES: ReplayWave[] = [
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

async function runReplay() {
  console.log('================================================================');
  console.log('TIME-MACHINE REPLAY HARNESS: NVIDIA SAGA (NOV 8-25)');
  console.log('Testing First-Class Stories and Temporal Burst Guardrails');
  console.log('================================================================');

  if (!process.env.DATABASE_URL?.includes('ep-aged-hill-abxepujh')) {
    throw new Error('Refusing to run replay on non-sandbox database!');
  }

  // 1. Reset Nvidia saga data in the Neon sandbox database
  console.log('\n[STAGE 0] Resetting sandbox database for Nvidia articles...');
  const resetResult = await resetNvidiaSagaSandbox();
  console.log(`Reset complete: ${resetResult.articleCount} articles ready, ${resetResult.clustersReset} old clusters deleted, ${resetResult.storiesReset} old stories deleted.`);

  // 2. Chronological Wave Ingestion
  for (let i = 0; i < WAVES.length; i++) {
    const wave = WAVES[i];
    console.log('\n----------------------------------------------------------------');
    console.log(`INGESTING WAVE ${i + 1}/${WAVES.length}: ${wave.name}`);
    console.log(`Window: ${wave.startDate.split('T')[0]} to ${wave.endDate.split('T')[0]}`);
    console.log('----------------------------------------------------------------');

    const waveArticles = await getNvidiaArticlesByDateRange(wave.startDate, wave.endDate);
    console.log(`Articles published in this wave: ${waveArticles.length}`);

    if (waveArticles.length === 0) {
      console.log('No articles found for this wave. Skipping.');
      continue;
    }

    // Step A: Cluster articles (with 48h temporal burst boundary)
    console.log(`\n[Wave ${i + 1}] Running article clustering...`);
    await clusterRecentArticles({ articles: waveArticles as any });

    // Step B: Summarise clusters & mint 1:1 stories
    console.log(`\n[Wave ${i + 1}] Running cluster summarisation & 1:1 story birth...`);
    await summarizeClusters();

    // Step C: Organize story threads via TypeSafe System One & Gemini copywriting
    const clusterIds = await getNvidiaClusterIds();
    console.log(`\n[Wave ${i + 1}] Running story organization (targeting ${clusterIds.length} Nvidia clusters)...`);
    await organizeStoryThreads({ clusterIds });

    // Inspect stories and clusters after this wave
    const allStories = await getStories({ limit: 100 });
    const nvidiaStories = allStories.filter(
      (s) =>
        s.title.toLowerCase().includes('nvidia') ||
        s.title.toLowerCase().includes('huang') ||
        s.title.toLowerCase().includes('jensen')
    );

    console.log(`\n[Wave ${i + 1} State] Active Nvidia stories in database: ${nvidiaStories.length}`);
    for (const s of nvidiaStories) {
      console.log(`\n  STORY: "${s.title}" (status: ${s.status}, clusters: ${s.clusters?.length || 0})`);
      console.log(`  OVERVIEW: "${s.overview}"`);
      if (s.clusters && s.clusters.length > 0) {
        console.log('  ANGLES:');
        for (const c of s.clusters) {
          console.log(`    - [${c.storyAngle || 'Main'}] "${c.headline}" (${c.articleAssignments?.length || 0} articles, ${new Date(c.createdAt).toISOString().split('T')[0]})`);
        }
      }
    }
  }

  // 3. Final Assertions
  console.log('\n================================================================');
  console.log('FINAL REPLAY VERIFICATION & ASSERTIONS');
  console.log('================================================================');

  const finalStories = await getStories({ limit: 100 });
  const finalNvidiaStories = finalStories.filter(
    (s) =>
      s.title.toLowerCase().includes('nvidia') ||
      s.title.toLowerCase().includes('huang') ||
      s.title.toLowerCase().includes('jensen')
  );

  console.log(`Total Nvidia stories: ${finalNvidiaStories.length}`);
  if (finalNvidiaStories.length === 1) {
    console.log('✓ PASS: Exactly 1 unified Story exists across all 4 waves (Zero saga splits)');
  } else {
    console.warn(`✗ WARNING: Expected 1 story, found ${finalNvidiaStories.length} stories.`);
  }

  const primaryStory = finalNvidiaStories[0];
  if (primaryStory) {
    const angleCount = primaryStory.clusters?.length || 0;
    console.log(`Total angles in story: ${angleCount}`);
    if (angleCount >= 3) {
      console.log(`✓ PASS: Multiple distinct angles preserved (${angleCount} angles)`);
    }

    const titleLower = primaryStory.title.toLowerCase();
    const hasReinstatement =
      titleLower.includes('reinstat') ||
      titleLower.includes('return') ||
      titleLower.includes('trump') ||
      titleLower.includes('ceo');

    if (hasReinstatement) {
      console.log(`✓ PASS: Headline recency validated: leads with current reality: "${primaryStory.title}"`);
    } else {
      console.warn(`✗ WARNING: Headline does not lead with reinstatement: "${primaryStory.title}"`);
    }
  }

  console.log('\n================================================================');
  console.log('TIME-MACHINE REPLAY COMPLETE');
  console.log('================================================================\n');
}

runReplay()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Replay error:', err);
    process.exit(1);
  });
