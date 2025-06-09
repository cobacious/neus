// fillMissingContent.ts
// Fetch and update missing article content using @extractus/article-extractor
import { prisma } from '../../lib/prisma';
import { extract, setSanitizeHtmlOptions } from '@extractus/article-extractor';
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
  const articles = await prisma.article.findMany({
    where: {
      OR: [{ content: null }, { content: '' }],
    },
  });
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
      const result = await extract(article.url, {});
      if (result?.content && result.content.trim().length > 0) {
        await prisma.article.update({
          where: { id: article.id },
          data: { content: result.content },
        });
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
