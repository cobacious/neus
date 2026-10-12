import { prisma } from '../client';

export type UpdateSourceInput = {
  id: string;
  name?: string;
  homepageUrl?: string | null;
  rssFeedUrl?: string;
  active?: boolean;
  paywalled?: boolean;
};

export async function updateSource({ id, ...data }: UpdateSourceInput) {
  const updateData: Record<string, any> = { ...data };
  if (data.homepageUrl !== undefined) {
    const domain = data.homepageUrl
      ? new URL(data.homepageUrl).hostname.replace(/^www\./, '')
      : null;
    updateData.domain = domain ?? undefined;
    updateData.faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : undefined;
  }
  return prisma.source.update({ where: { id }, data: updateData });
}
