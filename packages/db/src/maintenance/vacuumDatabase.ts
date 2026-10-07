import { prisma } from '../client';

/**
 * Executes VACUUM ANALYZE in PostgreSQL to reclaim disk pages
 * and update query planner statistics after heavy retention purges.
 */
export async function vacuumDatabase(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe('VACUUM ANALYZE;');
  } catch (err: any) {
    // If VACUUM is disallowed in transaction or pooler mode, log warning gracefully
    console.warn(`[vacuumDatabase]: VACUUM ANALYZE skipped: ${err.message || err}`);
  }
}
