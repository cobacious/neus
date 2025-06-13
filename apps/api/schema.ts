import { makeSchema, objectType, queryType } from 'nexus';
import { countClusters, getClustersWithArticles } from '@neus/db';

const ArticleSummary = objectType({
  name: 'ArticleSummary',
  definition(t) {
    t.string('id');
    t.string('url');
    t.string('source');
    t.string('publishedAt');
  },
});

const Cluster = objectType({
  name: 'Cluster',
  definition(t) {
    t.string('id');
    t.nullable.string('headline');
    t.nullable.string('summary');
    t.string('origin');
    t.string('createdAt');
    t.int('articleCount', {
      resolve: (cluster) => cluster.articleAssignments?.length ?? 0,
    });
    t.list.field('articles', {
      type: 'ArticleSummary',
      resolve: (cluster: any) =>
        cluster.articleAssignments?.map((assignment: any) => assignment.article) ?? [],
    });
  },
});

const Query = queryType({
  definition(t) {
    t.list.field('clusters', {
      type: Cluster,
      resolve: async () => getClustersWithArticles(),
    });
    t.int('clusterCount', {
      resolve: async () => countClusters(),
    });
  },
});

export const schema = makeSchema({
  types: [Query, Cluster, ArticleSummary],
  outputs: false,
});
