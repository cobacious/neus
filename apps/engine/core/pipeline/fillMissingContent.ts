// fillMissingContent.ts
// Fetch and update missing article content using @extractus/article-extractor
import {
  getArticlesMissingContent,
  updateArticleContent,
  isPaywalledSource,
  markPaywalledArticlesResolved,
} from '@neus/db';
import { extractFromHtml, setSanitizeHtmlOptions } from '@extractus/article-extractor';
import {
  logPipelineStep,
  logPipelineSection,
  PipelineStep,
  logger,
} from '../../lib/pipelineLogger';
import { cleanArticleText } from './cleanArticleText';
import { mapConcurrent } from './utils';

setSanitizeHtmlOptions({
  allowedTags: [], // remove all tags
  allowedAttributes: {},
});

export async function fillMissingContent() {
  logPipelineStep(PipelineStep.Fetch, 'Filling missing content...');

  // 1. Bulk resolve any existing paywalled articles that currently have content: null
  try {
    const paywalledResolvedCount = await markPaywalledArticlesResolved();
    if (paywalledResolvedCount > 0) {
      logger.info(
        `[${PipelineStep.Fetch}] Marked ${paywalledResolvedCount} paywalled articles as resolved (empty content).`
      );
    }
  } catch (err: any) {
    logger.warn(
      `[${PipelineStep.Fetch}] Failed to bulk-resolve paywalled articles: ${err.message || err}`
    );
  }

  // 2. Fetch pending articles missing content (strictly content: null, capped by MAX_CONTENT_EXTRACTION)
  const articles = await getArticlesMissingContent();
  if (articles.length === 0) {
    logger.info(`[${PipelineStep.Fetch}] No articles missing content. Skipping extraction step.`);
    return;
  }

  let updated = 0;
  let failed = 0;
  let skippedPaywalled = 0;

  const concurrency = process.env.CONTENT_EXTRACTION_CONCURRENCY
    ? parseInt(process.env.CONTENT_EXTRACTION_CONCURRENCY, 10)
    : 5;

  logPipelineSection(
    PipelineStep.Fetch,
    `Attempting to extract content for ${articles.length} articles (concurrency: ${concurrency}).`
  );

  await mapConcurrent(articles, concurrency, async (article) => {
    if (!article.url || !article.source) return;
    if (article.content && article.content.trim().length > 0) return;

    // Defense-in-depth: check if source is paywalled
    if (isPaywalledSource((article as any).sourceRel || article.source)) {
      await updateArticleContent(article.id, '');
      skippedPaywalled++;
      return;
    }

    try {
      const fetchWithTimeout = async () => {
        const res = await fetch(article.url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (compatible; NeusFeedReader/1.0; +https://neus.news)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-GB,en;q=0.9',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          if (res.body && typeof res.body.cancel === 'function') {
            await res.body.cancel().catch(() => {});
          }
          logger.warn(
            `[${PipelineStep.Fetch}] HTTP ${res.status} when fetching: ${article.title} (${article.url})`
          );
          await updateArticleContent(article.id, '');
          failed++;
          return;
        }

        const html = await res.text();
        const result = await extractFromHtml(html, article.url);

        let updatedAt: Date | undefined = undefined;
        const metaMatch = html.match(
          /(article:modified_time|og:updated_time|dateModified|datemodified|updated_time|modified_time)"? content="([^"]+)/i
        );
        if (metaMatch) {
          const ts = Date.parse(metaMatch[2]);
          if (!isNaN(ts)) updatedAt = new Date(ts);
        } else {
          const header = res.headers.get('last-modified');
          if (header) {
            const ts = Date.parse(header);
            if (!isNaN(ts)) updatedAt = new Date(ts);
          }
        }

        if (result?.content && result.content.trim().length > 0) {
          const cleaned = cleanArticleText(result.content);
          await updateArticleContent(article.id, cleaned, updatedAt);
          updated++;
        } else {
          logger.warn(
            `[${PipelineStep.Fetch}] No full content extracted for: ${article.title} (${article.url})`
          );
          await updateArticleContent(article.id, '');
          failed++;
        }
      };

      // Guard with hard 12s timeout race so hung socket assertions cannot stall or terminate the worker
      let timeoutHandle: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error('Fetch timeout (hard deadline exceeded)')),
          12000
        );
      });

      try {
        await Promise.race([fetchWithTimeout(), timeoutPromise]);
      } finally {
        clearTimeout(timeoutHandle!);
      }
    } catch (err: any) {
      logger.error(
        `[${PipelineStep.Fetch}] Failed to extract content for: ${article.title} (${article.url}): ${err.message || err}`
      );
      await updateArticleContent(article.id, '');
      failed++;
    }
  });

  logger.info(
    `[${PipelineStep.Fetch}] Content extraction finished: ${updated} succeeded, ${failed} failed (marked resolved), ${skippedPaywalled} paywalled skipped.`
  );
}
