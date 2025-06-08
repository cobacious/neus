// fillMissingContent.ts
// Fetch and update missing article content using @extractus/article-extractor
import { prisma } from './lib/prisma';
import { extract, setSanitizeHtmlOptions } from '@extractus/article-extractor';

setSanitizeHtmlOptions({
  allowedTags: [], // remove all tags
  allowedAttributes: {},
  exclusiveFilter: (frame) => !frame.text.trim(), // remove empty blocks
});

export async function fillMissingContent() {
  // Always treat RSS content as a summary and attempt to extract the full article
  const articles = await prisma.article.findMany();
  console.log(
    `[content-extract] Attempting to extract full content for ${articles.length} articles.`
  );
  for (const article of articles) {
    if (!article.id || !article.source || (article.content && article.content.trim().length > 0))
      continue;
    try {
      const result = await extract(article.id, {});
      if (result?.content && result.content.trim().length > 0) {
        await prisma.article.update({
          where: { id: article.id },
          data: { content: result.content },
        });
        console.log(`[content-extract] Updated article: ${article.title}`);
      } else {
        console.warn(
          `[content-extract] No full content extracted for: ${article.title} (${article.id})`
        );
      }
    } catch (err) {
      console.warn(
        `[content-extract] Failed to extract content for: ${article.title} (${article.id})`,
        err
      );
    }
  }
}
