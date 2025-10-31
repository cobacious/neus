import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const guardian = await prisma.source.findFirst({ 
  where: { name: 'The Guardian' } 
});

const guardianCount = await prisma.article.count({ 
  where: { sourceId: guardian.id } 
});

const totalCount = await prisma.article.count();

console.log(`Total articles: ${totalCount}`);
console.log(`Guardian articles: ${guardianCount}/148 expected`);

if (guardianCount > 0) {
  console.log('\nSample Guardian articles:');
  const sample = await prisma.article.findMany({
    where: { sourceId: guardian.id },
    take: 3,
    select: { title: true }
  });
  sample.forEach(a => console.log(`- ${a.title}`));
}

await prisma.$disconnect();
