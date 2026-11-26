import {
  getActiveClustersForStories,
  syncStoryWithThreads,
  mergeClusters,
  getStoriesForMatching,
  markDormantStories,
  getStoryArticlesForRealignment,
  realignStoryArticles,
  dissociateClusters,
  cleanEmptyStories,
  ensureClusterStory,
} from '@neus/db';
import {
  logger,
  logPipelineStep,
  logPipelineSection,
  PipelineStep,
} from '../../lib/pipelineLogger';
import {
  CandidateStory,
  ClusterWithEmbedding,
  buildNeighborhoods,
  computeCentroidEmbedding,
  findCandidateStoriesForNeighborhood,
  isSettledNeighborhood,
} from './storyThreads/storyNeighborhoods';
import {
  synthesizeStoryCopy,
  StoryCopyResult,
} from './storyThreads/synthesizeStoryCopy';
import { classifyArticleThreads } from './storyThreads/classifyArticleThreads';
import {
  detectDuplicateClusters,
  detectStorySagas,
  CandidateClusterForMerge,
} from '../../lib/typesafeClient';

export interface OrganizeStoryThreadsDependencies {
  detectDuplicateClusters?: typeof detectDuplicateClusters;
  detectStorySagas?: typeof detectStorySagas;
  synthesizeStoryCopy?: typeof synthesizeStoryCopy;
  classifyArticleThreads?: typeof classifyArticleThreads;
}

export async function organizeStoryThreads(
  options: {
    timeBudgetMs?: number;
    clusterIds?: string[];
  } = {},
  deps: OrganizeStoryThreadsDependencies = {}
) {
  const detectDuplicatesFn = deps.detectDuplicateClusters ?? detectDuplicateClusters;
  const detectSagasFn = deps.detectStorySagas ?? detectStorySagas;
  const synthesizeCopyFn = deps.synthesizeStoryCopy ?? synthesizeStoryCopy;
  const classifyThreadsFn = deps.classifyArticleThreads ?? classifyArticleThreads;

  logPipelineStep(
    PipelineStep.Organize,
    'Organizing clusters into story threads & merging duplicates...'
  );

  const activeClusters = (await getActiveClustersForStories(30)) as ClusterWithEmbedding[];

  if (activeClusters.length < 2) {
    logger.info(
      `[${PipelineStep.Organize}] Fewer than 2 active clusters found (${activeClusters.length}). Skipping story thread organization.`
    );
    await cleanEmptyStories();
    await markDormantStories(7);
    return;
  }

  const existingStories = await getStoriesForMatching();

  const similarityThreshold = process.env.STORY_SIMILARITY_THRESHOLD
    ? parseFloat(process.env.STORY_SIMILARITY_THRESHOLD)
    : 0.78;

  const allNeighborhoods = buildNeighborhoods(activeClusters, similarityThreshold);
  const neighborhoods =
    options.clusterIds && options.clusterIds.length > 0
      ? allNeighborhoods.filter((n) => n.some((c) => options.clusterIds!.includes(c.id)))
      : allNeighborhoods;

  logPipelineSection(
    PipelineStep.Organize,
    `Evaluated ${activeClusters.length} clusters: found ${allNeighborhoods.length} total neighborhoods (${neighborhoods.length} targeted, threshold >= ${similarityThreshold})`
  );

  if (neighborhoods.length === 0) {
    logger.info(
      `[${PipelineStep.Organize}] No cluster neighborhoods detected above threshold. All clusters are standalone.`
    );
    await cleanEmptyStories();
    const dormantCount = await markDormantStories(7);
    if (dormantCount > 0) {
      logger.info(
        `[${PipelineStep.Organize}] Marked ${dormantCount} inactive stories as dormant (no updates in 7+ days)`
      );
    }
    return;
  }

  let totalMerged = 0;
  let totalStoriesSynced = 0;
  let totalSkippedSettled = 0;

  // Pre-calculate active cluster count per story in the 30-day window
  const activeStoryClusterCounts = new Map<string, number>();
  for (const c of activeClusters) {
    if (c.storyId) {
      activeStoryClusterCounts.set(
        c.storyId,
        (activeStoryClusterCounts.get(c.storyId) || 0) + 1
      );
    }
  }

  const RECENT_ACTIVITY_HOURS = 48;
  const activityCutoff = new Date(Date.now() - RECENT_ACTIVITY_HOURS * 60 * 60 * 1000);

  const timeBudgetMs =
    options.timeBudgetMs ??
    (process.env.ORGANIZE_TIME_BUDGET_MS
      ? parseInt(process.env.ORGANIZE_TIME_BUDGET_MS, 10)
      : 8 * 60 * 1000);
  const organizeStart = Date.now();
  let totalEvaluated = 0;
  let totalDeferred = 0;

  const hasRecentActivityIn = (n: ClusterWithEmbedding[]) =>
    n.some((c) => {
      const isNewCluster = new Date(c.createdAt) >= activityCutoff;
      const latestArticleAt = c.articleAssignments?.[0]?.createdAt;
      const hasNewArticle = latestArticleAt && new Date(latestArticleAt) >= activityCutoff;
      return isNewCluster || Boolean(hasNewArticle);
    });

  const latestActivityMs = (n: ClusterWithEmbedding[]) =>
    Math.max(
      ...n.map((c) =>
        Math.max(
          new Date(c.createdAt).getTime(),
          c.articleAssignments?.[0]?.createdAt
            ? new Date(c.articleAssignments[0].createdAt).getTime()
            : 0
        )
      )
    );

  const orderedNeighborhoods = [...neighborhoods].sort(
    (a, b) => latestActivityMs(b) - latestActivityMs(a)
  );

  for (let i = 0; i < orderedNeighborhoods.length; i++) {
    const neighborhood = orderedNeighborhoods[i];

    if (!hasRecentActivityIn(neighborhood)) {
      totalSkippedSettled++;
      logger.info(
        `[${PipelineStep.Organize}] Skipping inactive neighborhood ${i + 1}/${orderedNeighborhoods.length} (${neighborhood.length} clusters) (no new clusters or articles in past ${RECENT_ACTIVITY_HOURS}h)`
      );
      continue;
    }

    const settledCheck = isSettledNeighborhood(
      neighborhood,
      existingStories,
      activityCutoff,
      activeStoryClusterCounts
    );
    if (settledCheck.settled) {
      totalSkippedSettled++;
      logger.info(
        `[${PipelineStep.Organize}] Skipping settled story neighborhood for "${settledCheck.storyTitle}" (no new clusters or articles in past ${RECENT_ACTIVITY_HOURS}h)`
      );
      continue;
    }

    if (Date.now() - organizeStart >= timeBudgetMs) {
      totalDeferred = orderedNeighborhoods.slice(i).filter(hasRecentActivityIn).length;
      logger.warn(
        `[${PipelineStep.Organize}] Time budget of ${Math.round(timeBudgetMs / 1000)}s reached after ${totalEvaluated} evaluations. Deferring ${totalDeferred} active neighborhood(s) to the next run.`
      );
      break;
    }
    totalEvaluated++;

    const neighborhoodClusterIds = new Set(neighborhood.map((c) => c.id));
    const mergedSourceIds = new Set<string>();
    const assignedClusterIds = new Set<string>();

    // 1. Evaluate candidate duplicate clusters in the neighborhood via TypeSafe Jev (Noul)
    const candidatesForMerge: CandidateClusterForMerge[] = neighborhood.map((c) => ({
      id: c.id,
      headline: c.headline ?? null,
      summary: c.summary ?? null,
      storyId: c.storyId,
      articleCount: c._count?.articleAssignments ?? 0,
      createdAt: c.createdAt,
      embedding: (Array.isArray(c.embedding) ? c.embedding : null) as number[] | null,
    }));

      const merges = await detectDuplicatesFn(candidatesForMerge, {
        minCosineSimilarity: 0.78,
        minDuplicateProbability: 0.85,
        step: PipelineStep.Organize,
      });

      for (const m of merges) {
        const validSources = m.sourceClusterIds.filter(
          (s) =>
            s !== m.targetClusterId &&
            neighborhoodClusterIds.has(s) &&
            !mergedSourceIds.has(s)
        );

        if (validSources.length > 0 && neighborhoodClusterIds.has(m.targetClusterId)) {
          await mergeClusters(m.targetClusterId, validSources);
          validSources.forEach((id) => mergedSourceIds.add(id));
          totalMerged += validSources.length;
          logger.info(
            `[${PipelineStep.Organize}] Merged ${validSources.length} duplicate cluster(s) into ${m.targetClusterId}`
          );
        }
      }

      const survivingNeighborhood = neighborhood.filter((c) => !mergedSourceIds.has(c.id));
      if (survivingNeighborhood.length < 2) {
        logger.info(
          `[${PipelineStep.Organize}] Only ${survivingNeighborhood.length} cluster(s) remain in neighborhood after merging duplicates. Skipping story umbrella evaluation.`
        );
        continue;
      }

      const candidateStories = findCandidateStoriesForNeighborhood(
        survivingNeighborhood,
        existingStories
      );

      // 2. Evaluate story sagas using TypeSafe System One (Noul pairwise judgments)
      const candidatesForSaga: CandidateClusterForMerge[] = survivingNeighborhood.map((c) => ({
        id: c.id,
        headline: c.headline ?? null,
        summary: c.summary ?? null,
        storyId: c.storyId,
        articleCount: c._count?.articleAssignments ?? 0,
        createdAt: c.createdAt,
        embedding: (Array.isArray(c.embedding) ? c.embedding : null) as number[] | null,
      }));

      const sagaDecisions = await detectSagasFn(candidatesForSaga, candidateStories, {
        step: PipelineStep.Organize,
        minSagaProbability: process.env.MIN_SAGA_PROBABILITY
          ? parseFloat(process.env.MIN_SAGA_PROBABILITY)
          : 0.75,
      });

      if (sagaDecisions.length === 0) {
        logger.info(
          `[${PipelineStep.Organize}] System One identified no multi-thread sagas in neighborhood (${survivingNeighborhood.length} clusters remain standalone). Skipping copywriting.`
        );
      }

      // 3. For each confirmed saga (>= 2 clusters), invoke Gemini strictly for copywriting
      for (const saga of sagaDecisions) {
        const targetStoryId =
          saga.existingStoryId ||
          survivingNeighborhood.find((c) => saga.clusterIds.includes(c.id) && c.storyId)?.storyId;

        // Fetch any existing member clusters of this story across active clusters
        const existingMemberClusters = targetStoryId
          ? activeClusters.filter((c) => c.storyId === targetStoryId && !mergedSourceIds.has(c.id))
          : [];

        // Pool together existing clusters of this story and newly joined clusters from this saga
        const combinedClusterMap = new Map<string, ClusterWithEmbedding>();
        for (const c of existingMemberClusters) {
          combinedClusterMap.set(c.id, c);
        }
        for (const c of survivingNeighborhood) {
          if (saga.clusterIds.includes(c.id)) {
            combinedClusterMap.set(c.id, c);
          }
        }
        const sagaClusters = Array.from(combinedClusterMap.values());
        if (sagaClusters.length < 2) continue;

        const existingStory = targetStoryId
          ? existingStories.find((s) => s.id === targetStoryId)
          : null;

        // Skip expensive LLM copywriting if this is an established story whose cluster composition has not changed
        const canReuseExistingCopy =
          Boolean(existingStory && existingStory.title && existingStory.overview) &&
          existingStory?._count?.clusters === sagaClusters.length &&
          sagaClusters.every((c) => c.storyId === existingStory.id && Boolean(c.storyAngle));

        let copyResult: StoryCopyResult;
        if (canReuseExistingCopy && existingStory) {
          logger.info(
            `[${PipelineStep.Organize}] Reusing existing copy for settled story "${existingStory.title}" (${sagaClusters.length} threads). Skipping LLM copywriting.`
          );
          copyResult = {
            storyTitle: existingStory.title,
            overview: existingStory.overview,
            status: existingStory.status,
            threads: sagaClusters.map((c) => ({
              clusterId: c.id,
              thread: c.storyAngle!,
            })),
          };
        } else {
          const clustersForCopy = sagaClusters.map((c) => ({
            id: c.id,
            headline: c.headline ?? null,
            summary: c.summary ?? null,
            date: new Date(c.createdAt).toISOString().split('T')[0],
            createdAt: new Date(c.createdAt).getTime(),
            articleCount: c._count?.articleAssignments ?? 0,
          }));

          try {
            copyResult = await synthesizeCopyFn(clustersForCopy, existingStory);
          } catch (err: any) {
            logger.error(
              `[${PipelineStep.Organize}] Failed synthesizing story copy: ${err.message || err}`
            );
            continue;
          }
        }

        const survivingThreads = copyResult.threads.filter(
          (t) => !mergedSourceIds.has(t.clusterId)
        );

        if (survivingThreads.length >= 2) {
          survivingThreads.forEach((t) => assignedClusterIds.add(t.clusterId));
          const storyEmbedding = computeCentroidEmbedding(sagaClusters);

          const targetStoryId =
            saga.existingStoryId ||
            sagaClusters.find((c) => c.storyId)?.storyId;

          await syncStoryWithThreads({
            existingStoryId: targetStoryId || undefined,
            storyTitle: copyResult.storyTitle,
            status: copyResult.status || 'developing',
            overview: copyResult.overview,
            embedding: storyEmbedding,
            threads: survivingThreads.map((t) => ({
              clusterId: t.clusterId,
              thread: t.thread,
            })),
          });
          totalStoriesSynced++;
          logger.info(
            `[${PipelineStep.Organize}] Grouped ${survivingThreads.length} threads under story: "${copyResult.storyTitle}"${
              targetStoryId ? ` (updated/reactivated: ${targetStoryId})` : ''
            }`
          );

          // Realign articles across story threads to correct misclassifications
          try {
            const threadClusterIds = survivingThreads.map((t) => t.clusterId);
            const storyArticles = await getStoryArticlesForRealignment(threadClusterIds);

            const targetStory = targetStoryId
              ? existingStories.find((s) => s.id === targetStoryId)
              : null;
            const existingStoryClusterCount = targetStory?._count?.clusters;
            const hasThreadCountChange =
              existingStoryClusterCount !== undefined &&
              existingStoryClusterCount !== survivingThreads.length;
            const storyUpdatedMs = targetStory?.updatedAt
              ? new Date(targetStory.updatedAt).getTime()
              : 0;
            const hasNewClusterSinceUpdate = sagaClusters.some(
              (c) => new Date(c.createdAt).getTime() > storyUpdatedMs + 60000
            );

            if (
              storyArticles.length > 0 &&
              (!targetStoryId || hasThreadCountChange || hasNewClusterSinceUpdate)
            ) {
              const threadsWithHeadlines = survivingThreads.map((t) => {
                const cluster = sagaClusters.find((c) => c.id === t.clusterId);
                return {
                  clusterId: t.clusterId,
                  thread: t.thread,
                  headline: cluster?.headline ?? null,
                  embedding: (Array.isArray(cluster?.embedding) ? cluster.embedding : null) as number[] | null,
                };
              });

              const newClusterIds = new Set(
                sagaClusters
                  .filter(
                    (c) =>
                      new Date(c.createdAt).getTime() > storyUpdatedMs + 60000 ||
                      c.storyId !== targetStoryId
                  )
                  .map((c) => c.id)
              );

              const assignments = await classifyThreadsFn(
                copyResult.storyTitle,
                threadsWithHeadlines,
                storyArticles,
                {
                  isExistingStory: Boolean(targetStoryId),
                  newClusterIds,
                }
              );

              const validClusterIdSet = new Set(threadClusterIds);
              const validReassignments = assignments.filter(
                (r) =>
                  validClusterIdSet.has(r.targetClusterId) &&
                  storyArticles.some(
                    (a) => a.articleId === r.articleId && a.currentClusterId !== r.targetClusterId
                  )
              );

              if (validReassignments.length > 0) {
                const { updatedCount } = await realignStoryArticles(validReassignments);
                if (updatedCount > 0) {
                  logger.info(
                    `[${PipelineStep.Organize}] Realigned ${updatedCount} article(s) across threads for story "${copyResult.storyTitle}"`
                  );
                }
              }
            }
          } catch (realignErr: any) {
            logger.warn(
              `[${PipelineStep.Organize}] Article realignment skipped for "${copyResult.storyTitle}": ${realignErr.message || realignErr}`
            );
          }
        }
      }

    // 3. Handle any clusters in this neighborhood that had a storyId but were NOT assigned to any multi-cluster saga
    const unassignedNeighborhoodClusters = neighborhood.filter(
      (c) => c.storyId && !mergedSourceIds.has(c.id) && !assignedClusterIds.has(c.id)
    );

    if (unassignedNeighborhoodClusters.length > 0) {
      const clustersToSplitFromMultiClusterStory: ClusterWithEmbedding[] = [];

      for (const c of unassignedNeighborhoodClusters) {
        const clusterStory = existingStories.find((s) => s.id === c.storyId);
        const countInNeighborhood = neighborhood.filter((x) => x.storyId === c.storyId).length;
        const totalClustersInStory =
          activeStoryClusterCounts.get(c.storyId) ?? clusterStory?._count?.clusters ?? countInNeighborhood;
        const wasInMultiClusterStory = totalClustersInStory >= 2;
        const isEntireStoryInNeighborhood =
          countInNeighborhood >= totalClustersInStory && countInNeighborhood >= 2;

        if (wasInMultiClusterStory && isEntireStoryInNeighborhood) {
          clustersToSplitFromMultiClusterStory.push(c);
        }
        // If it was already in its own 1:1 story, or if its parent story has other clusters elsewhere, leave it untouched!
      }

      if (clustersToSplitFromMultiClusterStory.length > 0) {
        const clusterIdsToDissociate = clustersToSplitFromMultiClusterStory.map((c) => c.id);
        await dissociateClusters(clusterIdsToDissociate);
        for (const c of clustersToSplitFromMultiClusterStory) {
          if (c.headline) {
            await ensureClusterStory(
              c.id,
              c.headline,
              c.summary,
              Array.isArray(c.embedding) ? (c.embedding as number[]) : null
            );
          }
        }
        logger.info(
          `[${PipelineStep.Organize}] Split ${clusterIdsToDissociate.length} cluster(s) into independent 1:1 stories (separated from multi-thread story): ${clusterIdsToDissociate.join(', ')}`
        );
      }
    }
  }

  // 4. Clean up any empty stories (0 active clusters) left behind after merges
  const { deletedStoriesCount } = await cleanEmptyStories();
  if (deletedStoriesCount > 0) {
    logger.info(
      `[${PipelineStep.Organize}] Cleaned up ${deletedStoriesCount} empty story/stories left behind after cluster merges`
    );
  }

  // 5. Mark inactive stories as dormant (no updates in past 7 days)
  const dormantCount = await markDormantStories(7);
  if (dormantCount > 0) {
    logger.info(
      `[${PipelineStep.Organize}] Marked ${dormantCount} inactive stories as dormant (no updates in 7+ days)`
    );
  }

  logPipelineSection(
    PipelineStep.Organize,
    `Story organization complete in ${Math.round((Date.now() - organizeStart) / 1000)}s. Evaluated ${totalEvaluated} neighborhoods, deferred ${totalDeferred} to next run (time budget ${Math.round(timeBudgetMs / 1000)}s). Merged ${totalMerged} duplicate clusters, synchronized ${totalStoriesSynced} multi-thread stories, skipped ${totalSkippedSettled} settled stories, ${deletedStoriesCount} empty stories cleaned up, ${dormantCount} stories dormant.`
  );
}

// Backward compatibility alias
export const organizeStoryAngles = organizeStoryThreads;
