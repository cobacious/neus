import { prisma } from '../client';

export type UpdateSourceInput = {
  id: string;
  name?: string;
  homepageUrl?: string | null;
  rssFeedUrl?: string;
  active?: boolean;
};

export async function updateSource({ id, ...data }: UpdateSourceInput) {
  const updateData: Record<string, any> = { ...data };
  if (data.homepageUrl !== undefined) {
    const domain = data.homepageUrl
      ? new URL(data.homepageUrl).hostname.replace(/^www\./, '')
      : null;
    updateData.domain = domain ?? undefined;
    updateData.faviconUrl = domain ? `https://icon.horse/icon/${domain}` : undefined;
  }
  return prisma.source.update({ where: { id }, data: updateData });
}
