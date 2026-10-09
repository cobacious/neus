export interface EnvironmentConfig {
  id: string;
  name: string;
  shortLabel: string;
  url: string;
  badgeClass: string;
  dotClass: string;
  description: string;
}

export const ENVIRONMENTS: EnvironmentConfig[] = [
  {
    id: 'local',
    name: 'Local Dev (Neon Branch)',
    shortLabel: 'Local Dev',
    url: import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:4040/graphql',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500',
    description: 'Local GraphQL server (port 4040) targeting the development database branch',
  },
  {
    id: 'production',
    name: 'Production (Railway)',
    shortLabel: 'Production',
    url: import.meta.env.VITE_PROD_API_URL || 'https://neusapi-production.up.railway.app/graphql',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
    description: 'Live Railway GraphQL server targeting the production database',
  },
];

export const DEFAULT_ENV_ID = 'local';
