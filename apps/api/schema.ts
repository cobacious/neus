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
  getStoryById,
  getStoryBySlug,
  getStories,
  getSources,
  createSource,
  updateSource,
} from '@neus/db';
import { getOrSetCache, clearQueryCache } from './cache';

const Story = objectType({
  name: 'Story',
  definition(t) {
    t.string('id');
    t.string('title');
    t.string('slug');
    t.nullable.string('overview');
    t.string('status');
    t.float('createdAt', {
      resolve: (story: any) => new Date(story.createdAt).getTime(),
    });
    t.float('updatedAt', {
      resolve: (story: any) => new Date(story.updatedAt).getTime(),
    });
    t.list.field('clusters', {
      type: 'Cluster',
      resolve: (story: any) => story.clusters ?? [],
    });
  },
});

const Cluster = objectType({
  name: 'Cluster',
  definition(t) {
    t.string('id');
    t.nullable.string('headline');
    t.nullable.string('slug');
    t.nullable.string('summary');
    t.string('origin');
    t.nullable.string('storyId');
    t.nullable.string('storyAngle');
    t.nullable.field('story', {
      type: 'Story',
      resolve: (cluster: any) => cluster.story ?? null,
    });
    t.float('createdAt', {
      resolve: (cluster: any) => new Date(cluster.createdAt).getTime(),
    });
    t.boolean('archived');
    t.nullable.float('lastUpdatedAt', {
      resolve: (cluster: any) => {
        // Get the most recent article assignment date
        if (!cluster.articleAssignments || cluster.articleAssignments.length === 0) {
          return null;
        }
        const dates = cluster.articleAssignments
          .map((assignment: any) => new Date(assignment.createdAt).getTime())
          .filter((time: number) => !isNaN(time));
        return dates.length > 0 ? Math.max(...dates) : null;
      },
    });
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
    t.boolean('paywalled');
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
    t.string('publishedAt', {
      resolve: (article: any) => new Date(article.publishedAt).toISOString(),
    });
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
      resolve: async (_, { limit, offset }) => {
        const l = limit ?? 10;
        const o = offset ?? 0;
        return getOrSetCache(`clusters:${l}:${o}`, () =>
          getRankedClusters(limit ?? undefined, offset ?? undefined)
        );
      },
    });
    t.field('cluster', {
      type: Cluster,
      args: { slug: nonNull(stringArg()) },
      resolve: async (_, { slug }) => {
        return getOrSetCache(`cluster:${slug}`, () => getClusterBySlug(slug));
      },
    });
    t.field('clusterById', {
      type: Cluster,
      args: { id: nonNull(stringArg()) },
      resolve: async (_, { id }) => {
        return getOrSetCache(`clusterById:${id}`, () => getClusterById(id));
      },
    });
    t.field('story', {
      type: Story,
      args: { slug: nonNull(stringArg()) },
      resolve: async (_, { slug }) => {
        return getOrSetCache(`story:${slug}`, () => getStoryBySlug(slug));
      },
    });
    t.field('storyById', {
      type: Story,
      args: { id: nonNull(stringArg()) },
      resolve: async (_, { id }) => {
        return getOrSetCache(`storyById:${id}`, () => getStoryById(id));
      },
    });
    t.list.field('stories', {
      type: Story,
      args: {
        status: stringArg(),
        limit: intArg(),
        offset: intArg(),
      },
      resolve: async (_, { status, limit, offset }) => {
        const s = status ?? 'all';
        const l = limit ?? 10;
        const o = offset ?? 0;
        return getOrSetCache(`stories:${s}:${l}:${o}`, () =>
          getStories({
            status: status ?? undefined,
            limit: limit ?? undefined,
            offset: offset ?? undefined,
          })
        );
      },
    });
    t.int('clusterCount', {
      resolve: async () => {
        return getOrSetCache('clusterCount', () => countClusters());
      },
    });
    t.list.field('sources', {
      type: Source,
      resolve: async () => {
        return getOrSetCache('sources', () => getSources());
      },
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
      resolve: async (_, args) => {
        const source = await createSource(args);
        clearQueryCache();
        return source;
      },
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
      resolve: async (_, args) => {
        const source = await updateSource(args);
        clearQueryCache();
        return source;
      },
    });
    t.field('clearCache', {
      type: 'Boolean',
      resolve: async () => {
        clearQueryCache();
        return true;
      },
    });
  },
});

export const schema = makeSchema({
  types: [Query, Mutation, Cluster, ArticleSummary, Source, Story],
  outputs: false,
});
