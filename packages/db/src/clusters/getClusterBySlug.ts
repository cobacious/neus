import { prisma } from '../client.js';

// Static alias mapping for historical or merged slugs
const SLUG_ALIASES: Record<string, string> = {
  'two-men-re-arrested-on-suspicion-of-assisting-iranian-intelligence-near-raf-fairford':
    'police-granted-extended-time-to-question-men-in-raf-fairford-investigation',
  'luiz-inacio-lula-da-silva-wins-historic-fourth-term-as-brazils-president':
    'lula-secures-historic-presidential-victory-in-brazil-amid-contestation',
};

export async function getClusterBySlug(slug: string) {
  const resolvedSlug = SLUG_ALIASES[slug] || slug;

  return prisma.cluster.findUnique({
    where: { slug: resolvedSlug },
    include: {
      story: {
        include: {
          clusters: {
            where: { archived: false },
            orderBy: { createdAt: 'asc' },
            include: {
              articleAssignments: {
                select: {
                  createdAt: true,
                  article: {
                    select: {
                      id: true,
                      url: true,
                      title: true,
                      source: true,
                      publishedAt: true,
                      author: true,
                      sourceRel: {
                        select: {
                          id: true,
                          name: true,
                          faviconUrl: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      articleAssignments: {
        select: {
          createdAt: true,
          article: {
            select: {
              id: true,
              url: true,
              title: true,
              source: true,
              publishedAt: true,
              author: true,
              sourceRel: {
                select: {
                  id: true,
                  name: true,
                  faviconUrl: true,
                },
              },
            },
          },
        },
      },
    },
  });
}
