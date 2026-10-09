/**
 * Utility to identify paywalled news publications (e.g. The Times, FT, The Telegraph).
 * Displays padlock / subscription indicator so readers have full transparency before clicking.
 */
export function isPaywalled(
  source?:
    | {
        name?: string | null;
        homepageUrl?: string | null;
        domain?: string | null;
        isPaywalled?: boolean | null;
      }
    | string
    | null
): boolean {
  if (!source) return false;
  if (typeof source === 'object' && source.isPaywalled === true) return true;

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
