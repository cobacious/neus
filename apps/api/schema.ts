import { makeSchema, objectType, queryType } from 'nexus';
import { prisma } from '@neus/db/client';

const Article = objectType({
  name: 'Article',
  definition(t) {
    t.string('id');
    t.string('url');
    t.string('title');
    t.nullable.string('snippet');
    t.nullable.string('content');
    t.string('source');
    t.field('publishedAt', { type: 'String' });
  },
});

const Query = queryType({
  definition(t) {
    t.string('hello', {
      resolve: () => 'world',
    });

    t.list.field('articles', {
      type: Article,
      async resolve() {
        return prisma.article.findMany();
      },
    });
  },
});

export const schema = makeSchema({ types: [Article, Query], outputs: false });
