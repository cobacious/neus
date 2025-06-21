/** Utility to scrub article text after extraction.
 * Removes common boilerplate and normalises whitespace.
 */
export function cleanArticleText(content: string): string {
  let text = content;
  // Strip leftover HTML tags or entities
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/gi, ' ');

  // Remove common navigation or promotional lines
  const noisePatterns = [
    /advertisement/gi,
    /sponsored content/gi,
    /back to top/gi,
    /skip to main content/gi,
    /image source.*?(?=\s|$)/gi,
    /image caption.*?(?=\s|$)/gi,
    /more on this story/gi,
    /^\d+\s*(?:minute|minutes|hour|hours|day|days)\s+ago\b/gi,
  ];
  for (const pattern of noisePatterns) {
    text = text.replace(pattern, '');
  }

  // Normalize whitespace and punctuation spacing
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\s+([.,!?;:])/g, '$1');

  return text.trim();
}
