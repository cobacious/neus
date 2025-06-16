import {
  makeSchema,
  objectType,
  queryType,
  mutationType,
  stringArg,
  booleanArg,
  nonNull,
} from 'nexus';
import {
  countClusters,
  getClustersWithArticles,
  getSources,
  createSource,
  updateSource,
  deleteSource,
} from '@neus/db';

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

const Source = objectType({
  name: 'Source',
  definition(t) {
    t.string('id');
    t.string('name');
    t.nullable.string('homepageUrl');
    t.string('rssFeedUrl');
    t.boolean('active');
    t.nullable.string('lastFetchedAt');
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
    t.field('deleteSource', {
      type: 'Boolean',
      args: {
        id: nonNull(stringArg()),
      },
      resolve: async (_, { id }) => {
        await deleteSource(id);
        return true;
      },
    });
  },
});

export const schema = makeSchema({
  types: [Query, Mutation, Cluster, ArticleSummary, Source],
  outputs: false,
});
