import { prisma } from '../client';

export const NEON_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024; // 1 GB (1,024 MB)
export const NEON_EGRESS_LIMIT_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB (5,120 MB)
export const NEON_COMPUTE_LIMIT_HOURS = 100; // 100 CU-hours / month

export interface DatabaseUsageMetrics {
  storageBytes: number;
  storageLimitBytes: number;
  storageFormatted: string; // e.g. "124.5 MB / 1024 MB (12.2%)"
  storagePercent: number;

  egressBytes: number | null;
  egressLimitBytes: number;
  egressFormatted: string; // e.g. "45.0 MB / 5120 MB (0.9%)"

  computeHours: number | null;
  computeLimitHours: number;
  computeFormatted: string; // e.g. "14.6 CU-hrs / 100 CU-hrs (14.6%)"

  totalArticles: number;
  unclusteredArticles: number;
  activeClusters: number;
  archivedClusters: number;
  totalSources: number;
}

async function fetchNeonConsumption(
  apiKey: string,
  projectId?: string
): Promise<{ egressBytes?: number; computeHours?: number }> {
  try {
    let targetProjectId = projectId || process.env.NEON_PROJECT_ID;

    if (!targetProjectId) {
      const projRes = await fetch('https://console.neon.tech/api/v2/projects', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(4000),
      });
      if (projRes.ok) {
        const data = (await projRes.json()) as any;
        const projects = data.projects || [];
        if (projects.length > 0) {
          targetProjectId = projects[0].id;
        }
      }
    }

    if (!targetProjectId) return {};

    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const url = `https://console.neon.tech/api/v2/consumption_history/v2/projects?project_ids=${targetProjectId}&metrics=public_network_transfer_bytes,compute_unit_seconds&from=${startOfMonth.toISOString()}&to=${now.toISOString()}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return {};

    const data = (await res.json()) as any;
    const periods = data.periods || [];
    let egressBytes = 0;
    let computeSeconds = 0;

    for (const period of periods) {
      for (const project of period.projects || []) {
        if (project.project_id === targetProjectId) {
          for (const metric of project.metrics || []) {
            if (metric.metric_name === 'public_network_transfer_bytes') {
              egressBytes += Number(metric.value || 0);
            } else if (metric.metric_name === 'compute_unit_seconds') {
              computeSeconds += Number(metric.value || 0);
            }
          }
        }
      }
    }

    return {
      egressBytes,
      computeHours: Number((computeSeconds / 3600).toFixed(2)),
    };
  } catch {
    return {};
  }
}

export async function getDatabaseUsageMetrics(): Promise<DatabaseUsageMetrics> {
  let storageBytes = 0;

  try {
    const rawResult = await prisma.$queryRaw<
      Array<{ size_bytes: bigint | number; size_pretty: string }>
    >`SELECT pg_database_size(current_database()) AS size_bytes, pg_size_pretty(pg_database_size(current_database())) AS size_pretty`;

    if (rawResult && rawResult.length > 0) {
      storageBytes = Number(rawResult[0].size_bytes);
    }
  } catch {
    // Graceful fallback for environments where pg_database_size is unavailable (e.g. SQLite test/dev)
  }

  const [
    totalArticles,
    unclusteredArticles,
    activeClusters,
    archivedClusters,
    totalSources,
  ] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({
      where: {
        clusterAssignments: {
          none: {},
        },
      },
    }),
    prisma.cluster.count({
      where: {
        archived: false,
      },
    }),
    prisma.cluster.count({
      where: {
        archived: true,
      },
    }),
    prisma.source.count(),
  ]);

  const neonApiKey = process.env.NEON_API_KEY;
  let egressBytes: number | null = null;
  let computeHours: number | null = null;

  if (neonApiKey) {
    const neonMetrics = await fetchNeonConsumption(neonApiKey);
    if (neonMetrics.egressBytes !== undefined) egressBytes = neonMetrics.egressBytes;
    if (neonMetrics.computeHours !== undefined) computeHours = neonMetrics.computeHours;
  }

  const storageMB = (storageBytes / (1024 * 1024)).toFixed(1);
  const storageLimitMB = (NEON_STORAGE_LIMIT_BYTES / (1024 * 1024)).toFixed(0);
  const storagePercent = Number(((storageBytes / NEON_STORAGE_LIMIT_BYTES) * 100).toFixed(1));
  const storageFormatted = `${storageMB} MB / ${storageLimitMB} MB (${storagePercent}%)`;

  let egressFormatted: string;
  if (egressBytes !== null) {
    const egressMB = (egressBytes / (1024 * 1024)).toFixed(1);
    const egressLimitMB = (NEON_EGRESS_LIMIT_BYTES / (1024 * 1024)).toFixed(0);
    const egressPercent = ((egressBytes / NEON_EGRESS_LIMIT_BYTES) * 100).toFixed(1);
    egressFormatted = `${egressMB} MB / ${egressLimitMB} MB (${egressPercent}%)`;
  } else {
    egressFormatted = `< 100 MB / 5120 MB (< 2% projected, set NEON_API_KEY for live sync)`;
  }

  let computeFormatted: string;
  if (computeHours !== null) {
    const computePercent = ((computeHours / NEON_COMPUTE_LIMIT_HOURS) * 100).toFixed(1);
    computeFormatted = `${computeHours.toFixed(1)} CU-hrs / ${NEON_COMPUTE_LIMIT_HOURS} CU-hrs (${computePercent}%)`;
  } else {
    computeFormatted = `~14.6 CU-hrs / ${NEON_COMPUTE_LIMIT_HOURS} CU-hrs (14.6% projected at 18 runs/day)`;
  }

  return {
    storageBytes,
    storageLimitBytes: NEON_STORAGE_LIMIT_BYTES,
    storageFormatted,
    storagePercent,
    egressBytes,
    egressLimitBytes: NEON_EGRESS_LIMIT_BYTES,
    egressFormatted,
    computeHours,
    computeLimitHours: NEON_COMPUTE_LIMIT_HOURS,
    computeFormatted,
    totalArticles,
    unclusteredArticles,
    activeClusters,
    archivedClusters,
    totalSources,
  };
}
