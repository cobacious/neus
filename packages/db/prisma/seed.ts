import { prisma } from '../src/client';

const feeds = [
  {
    name: 'BBC News',
    homepageUrl: 'https://www.bbc.co.uk/news',
    rssFeedUrl: 'http://feeds.bbci.co.uk/news/rss.xml',
  },
  {
    name: 'The Guardian',
    homepageUrl: 'https://www.theguardian.com/uk',
    rssFeedUrl: 'https://www.theguardian.com/uk/rss',
  },
  {
    name: 'The Times',
    homepageUrl: 'https://www.thetimes.co.uk',
    rssFeedUrl: 'https://www.thetimes.co.uk/rss',
  },
  {
    name: 'The Independent UK',
    homepageUrl: 'https://www.independent.co.uk',
    rssFeedUrl: 'https://www.independent.co.uk/news/rss',
  },
  {
    name: 'The Sun',
    homepageUrl: 'https://www.thesun.co.uk',
    rssFeedUrl: 'https://www.thesun.co.uk/news/feed/',
  },
  {
    name: 'Daily Express',
    homepageUrl: 'https://www.express.co.uk',
    rssFeedUrl: 'https://www.express.co.uk/news/rss',
  },
  {
    name: 'Metro UK',
    homepageUrl: 'https://metro.co.uk',
    rssFeedUrl: 'https://metro.co.uk/news/feed/',
  },
  {
    name: 'Sky News',
    homepageUrl: 'https://news.sky.com',
    rssFeedUrl: 'https://feeds.skynews.com/feeds/rss/home.xml',
  },
  {
    name: 'ITV News UK',
    homepageUrl: 'https://www.itv.com/news',
    rssFeedUrl: 'https://www.itv.com/news/feeds/rss/uk/',
  },
];

async function main() {
  for (const feed of feeds) {
    const url = new URL(feed.homepageUrl);
    const domain = url.hostname.replace(/^www\./, '');
    await prisma.source.upsert({
      where: { rssFeedUrl: feed.rssFeedUrl },
      update: {},
      create: {
        name: feed.name,
        rssFeedUrl: feed.rssFeedUrl,
        homepageUrl: feed.homepageUrl,
        domain,
        faviconUrl: `https://icon.horse/icon/${domain}`,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
