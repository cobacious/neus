// fillMissingContent.ts
// Fetch and update missing article content using @extractus/article-extractor
import {
  getArticlesMissingContent,
  updateArticleContent,
} from '@neus/db';
import { extractFromHtml, setSanitizeHtmlOptions } from '@extractus/article-extractor';
import { fetch } from '../../lib/fetcher';
import {
  logPipelineStep,
  logPipelineSection,
  PipelineStep,
  logger,
} from '../../lib/pipelineLogger';

setSanitizeHtmlOptions({
  allowedTags: [], // remove all tags
  allowedAttributes: {},
  exclusiveFilter: (frame) => !frame.text.trim(), // remove empty blocks
});

export async function fillMissingContent() {
  logPipelineStep(PipelineStep.Fetch, 'Filling missing content...');
  // Only fetch articles missing content
  const articles = await getArticlesMissingContent();
  if (articles.length === 0) {
    logger.info(`[${PipelineStep.Fetch}] No articles missing content. Skipping extraction step.`);
    return;
  }
  let updated = 0;
  logPipelineSection(
    PipelineStep.Fetch,
    `Attempting to extract full content for ${articles.length} articles.`
  );
  for (const article of articles) {
    if (!article.url || !article.source || (article.content && article.content.trim().length > 0))
      continue;
    try {
      const res = await fetch(article.url);
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
        await updateArticleContent(article.id, result.content, updatedAt);
        updated++;
      } else {
        logger.warn(
          PipelineStep.Fetch,
          `No full content extracted for: ${article.title} (${article.url})`
        );
      }
    } catch (err) {
      logger.error(
        PipelineStep.Fetch,
        `Failed to extract content for: ${article.title} (${article.url})`,
        err
      );
    }
  }
  logger.info(`[${PipelineStep.Fetch}] Filled content for ${updated} articles.`);
}
