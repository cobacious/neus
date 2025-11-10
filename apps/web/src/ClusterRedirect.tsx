import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from 'urql';
import Loading from './components/Loading';

const CLUSTER_BY_ID_QUERY = `
  query ClusterById($id: String!) {
    clusterById(id: $id) {
      id
      slug
    }
  }
`;

/**
 * Redirects old /clusters/:id URLs to new /:slug URLs
 * for backwards compatibility
 */
export default function ClusterRedirect() {
  const { id } = useParams();
  const [result] = useQuery({ query: CLUSTER_BY_ID_QUERY, variables: { id } });

  if (result.fetching) return <Loading />;

  // If cluster not found, show error
  if (result.error || !result.data?.clusterById) {
    return <p className="text-center">Cluster not found</p>;
  }

  const cluster = result.data.clusterById;

  // Redirect to slug-based URL if slug exists, otherwise use ID
  const newUrl = cluster.slug ? `/${cluster.slug}` : `/${cluster.id}`;

  return <Navigate to={newUrl} replace />;
}
