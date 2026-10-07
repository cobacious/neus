import { prisma } from '../client';

/**
 * Compacts tables and reclaims physical disk space in PostgreSQL after retention purges.
 *
 * In PostgreSQL, standard VACUUM marks dead rows as reusable internally, but cannot shrink
 * the underlying OS heap and TOAST table files if remaining rows are scattered across pages.
 * VACUUM FULL rewrites and compacts the tables and their TOAST data in place, freeing
 * physical disk storage back to the filesystem and dropping pg_database_size.
 */
export async function vacuumDatabase(): Promise<void> {
  const tables = ['Article', 'Cluster', 'ArticleClusterAssignment'];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`VACUUM FULL "${table}";`);
    } catch (err: any) {
      // If exclusive lock or pooler prevents VACUUM FULL, fall back gracefully to standard VACUUM
      try {
        await prisma.$executeRawUnsafe(`VACUUM ANALYZE "${table}";`);
      } catch (innerErr: any) {
        console.warn(`[vacuumDatabase]: VACUUM on ${table} skipped: ${innerErr.message || innerErr}`);
      }
    }
  }
}
