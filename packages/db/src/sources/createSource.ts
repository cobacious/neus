import { prisma } from '../client';

export type CreateSourceInput = {
  name: string;
  homepageUrl?: string | null;
  rssFeedUrl: string;
  active?: boolean;
  paywalled?: boolean;
};

export async function createSource({
  name,
  homepageUrl,
  rssFeedUrl,
  active = true,
  paywalled = false,
}: CreateSourceInput) {
  const domain = homepageUrl ? new URL(homepageUrl).hostname.replace(/^www\./, '') : null;
  return prisma.source.create({
    data: {
      name,
      homepageUrl,
      rssFeedUrl,
      active,
      paywalled,
      domain: domain ?? undefined,
      faviconUrl: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : undefined,
    },
  });
}
