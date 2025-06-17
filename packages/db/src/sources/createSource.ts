import { prisma } from '../client';

export type CreateSourceInput = {
  name: string;
  homepageUrl?: string | null;
  rssFeedUrl: string;
  active?: boolean;
};

export async function createSource({
  name,
  homepageUrl,
  rssFeedUrl,
  active = true,
}: CreateSourceInput) {
  const domain = homepageUrl ? new URL(homepageUrl).hostname.replace(/^www\./, '') : null;
  return prisma.source.create({
    data: {
      name,
      homepageUrl,
      rssFeedUrl,
      active,
      domain: domain ?? undefined,
      faviconUrl: domain ? `https://icon.horse/icon/${domain}` : undefined,
    },
  });
}
