import { useQuery } from 'urql';
import ClusterCard from './ClusterCard';
import Loading from './Loading';

const CLUSTERS_QUERY = `
  query GetClusters {
    clusters {
      id
      headline
      summary
      createdAt
      origin
      articles {
        id
        url
        sourceRel {
          id
          name
          faviconUrl
        }
      }
    }
  }
`;

export default function ClusterList() {
  const [result] = useQuery({ query: CLUSTERS_QUERY });

  if (result.fetching) {
    return <Loading />;
  }

  if (result.error) {
    return <p>Error loading clusters</p>;
  }

  return (
    <div className="space-y-4">
      {result.data.clusters.map((cluster: any) => (
        <ClusterCard key={cluster.id} cluster={cluster} />
      ))}
    </div>
  );
}
