// fillMissingContent.ts
// Fetch and update missing article content using @extractus/article-extractor
import { prisma } from '../lib/prisma';
import { extract, setSanitizeHtmlOptions } from '@extractus/article-extractor';
import { logPipelineStep } from '../pipelineLogger';

setSanitizeHtmlOptions({
  allowedTags: [], // remove all tags
  allowedAttributes: {},
  exclusiveFilter: (frame) => !frame.text.trim(), // remove empty blocks
});

export async function fillMissingContent() {
  logPipelineStep('Filling missing content...');
  const articles = await prisma.article.findMany();
  let updated = 0;
  console.log(
    `[content-extract] Attempting to extract full content for ${articles.length} articles.`
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
        console.warn(
          `[content-extract] No full content extracted for: ${article.title} (${article.url})`
        );
      }
    } catch (err) {
      console.error(
        `[content-extract] Failed to extract content for: ${article.title} (${article.url})`,
        err
      );
    }
  }
  console.log(`[pipeline] Filled content for ${updated} articles.`);
}
