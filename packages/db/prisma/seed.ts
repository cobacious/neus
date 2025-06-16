import { prisma } from '../src/client';

const feeds = [
  { name: 'BBC News', rssFeedUrl: 'http://feeds.bbci.co.uk/news/rss.xml' },
  { name: 'The Guardian World', rssFeedUrl: 'https://www.theguardian.com/world/rss' },
  { name: 'The Times', rssFeedUrl: 'https://www.thetimes.co.uk/rss' },
  { name: 'The Independent UK', rssFeedUrl: 'https://www.independent.co.uk/news/rss' },
  { name: 'The Sun', rssFeedUrl: 'https://www.thesun.co.uk/news/feed/' },
  { name: 'Daily Express', rssFeedUrl: 'https://www.express.co.uk/news/rss' },
  { name: 'Metro UK', rssFeedUrl: 'https://metro.co.uk/news/feed/' },
  { name: 'Sky News', rssFeedUrl: 'https://feeds.skynews.com/feeds/rss/home.xml' },
  { name: 'ITV News UK', rssFeedUrl: 'https://www.itv.com/news/feeds/rss/uk/' },
];

async function main() {
  for (const feed of feeds) {
    const url = new URL(feed.rssFeedUrl);
    const domain = url.hostname.replace(/^www\./, '');
    await prisma.source.upsert({
      where: { rssFeedUrl: feed.rssFeedUrl },
      update: {},
      create: {
        name: feed.name,
        rssFeedUrl: feed.rssFeedUrl,
        domain,
        homepageUrl: `${url.protocol}//${domain}`,
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
