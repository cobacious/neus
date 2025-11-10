import {
  makeSchema,
  objectType,
  queryType,
  mutationType,
  stringArg,
  booleanArg,
  intArg,
  nonNull,
} from 'nexus';
import {
  countClusters,
  getRankedClusters,
  getClusterById,
  getClusterBySlug,
  getSources,
  createSource,
  updateSource,
} from '@neus/db';

const Cluster = objectType({
  name: 'Cluster',
  definition(t) {
    t.string('id');
    t.nullable.string('headline');
    t.nullable.string('slug');
    t.nullable.string('summary');
    t.string('origin');
    t.float('createdAt');
    t.boolean('archived');
    t.float('score', {
      resolve: (cluster: { score?: number }) => cluster.score ?? 0,
    });
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

const Source = objectType({
  name: 'Source',
  definition(t) {
    t.string('id');
    t.string('name');
    t.nullable.string('homepageUrl');
    t.string('rssFeedUrl');
    t.boolean('active');
    t.nullable.string('faviconUrl');
    t.nullable.string('lastFetchedAt');
  },
});

const ArticleSummary = objectType({
  name: 'ArticleSummary',
  definition(t) {
    t.string('id');
    t.string('url');
    t.string('title');
    t.string('source');
    t.string('publishedAt');
    t.nullable.string('author');
    t.field('sourceRel', { type: Source });
  },
});

const Query = queryType({
  definition(t) {
    t.list.field('clusters', {
      type: Cluster,
      args: {
        limit: intArg(),
        offset: intArg(),
      },
      resolve: async (_, { limit, offset }) => getRankedClusters(limit ?? undefined, offset ?? undefined),
    });
    t.field('cluster', {
      type: Cluster,
      args: { slug: nonNull(stringArg()) },
      resolve: async (_, { slug }) => getClusterBySlug(slug),
    });
    t.field('clusterById', {
      type: Cluster,
      args: { id: nonNull(stringArg()) },
      resolve: async (_, { id }) => getClusterById(id),
    });
    t.int('clusterCount', {
      resolve: async () => countClusters(),
    });
    t.list.field('sources', {
      type: Source,
      resolve: async () => getSources(),
    });
  },
});

const Mutation = mutationType({
  definition(t) {
    t.field('createSource', {
      type: Source,
      args: {
        name: nonNull(stringArg()),
        homepageUrl: stringArg(),
        rssFeedUrl: nonNull(stringArg()),
        active: booleanArg(),
      },
      resolve: async (_, args) => createSource(args),
    });
    t.field('updateSource', {
      type: Source,
      args: {
        id: nonNull(stringArg()),
        name: stringArg(),
        homepageUrl: stringArg(),
        rssFeedUrl: stringArg(),
        active: booleanArg(),
      },
      resolve: async (_, args) => updateSource(args),
    });
  },
});

export const schema = makeSchema({
  types: [Query, Mutation, Cluster, ArticleSummary, Source],
  outputs: false,
});
