/**
 * Utility to identify paywalled news sources across the Neus backend.
 * Checks the database paywalled flag or matches known paywalled domains/titles.
 */

export type PaywalledSourceInput =
  | {
      name?: string | null;
      domain?: string | null;
      homepageUrl?: string | null;
      paywalled?: boolean | null;
    }
  | string
  | null
  | undefined;

export function isPaywalledSource(source?: PaywalledSourceInput): boolean {
  if (!source) return false;
  if (typeof source === 'object' && source.paywalled === true) return true;

  const text =
    typeof source === 'string'
      ? source.toLowerCase()
      : `${source.name || ''} ${source.homepageUrl || ''} ${source.domain || ''}`.toLowerCase();

  return (
    text.includes('the times') ||
    text.includes('financial times') ||
    text.includes('the telegraph') ||
    text.includes('the economist') ||
    text.includes('bloomberg') ||
    text.includes('wall street journal') ||
    text.includes('thetimes') ||
    text.includes('ft.com') ||
    text.includes('telegraph.co.uk') ||
    text.includes('economist.com') ||
    text.includes('bloomberg.com') ||
    text.includes('wsj.com')
  );
}
