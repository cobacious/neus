import { prisma } from '../client';

export const CANONICAL_SOURCE_TRUST: Record<string, number> = {
  'Reuters': 1.0,
  'AP News': 1.0,
  'BBC News': 0.95,
  'UK Parliament': 0.95,
  'Financial Times': 0.95,
  'The Guardian': 0.90,
  'The Times': 0.90,
  'The Telegraph': 0.85,
  'Channel 4 News': 0.85,
  'Sky News': 0.80,
  'The i Paper': 0.80,
  'Politico Europe': 0.80,
  'The Scotsman': 0.75,
  'Al Jazeera English': 0.75,
  'ITV News UK': 0.75,
  'Evening Standard': 0.50,
  'The Independent UK': 0.65,
  'Metro UK': 0.55,
  'Daily Mail': 0.35,
  'Daily Express': 0.05,
  'The Sun': 0.05,
};

/**
 * Updates all sources in the database with their canonical editorial trust scores.
 */
export async function syncSourceTrustScores(): Promise<number> {
  let updatedCount = 0;
  for (const [name, trustScore] of Object.entries(CANONICAL_SOURCE_TRUST)) {
    const res = await prisma.source.updateMany({
      where: { name },
      data: { trustScore },
    });
    updatedCount += res.count;
  }
  return updatedCount;
}
