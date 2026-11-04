export const CONTROLLED_TOPIC_TAGS = [
  'uk',
  'world',
  'politics',
  'business',
  'tech_science',
  'environment',
  'society',
  'sport',
  'culture',
] as const;

export type TopicTag = (typeof CONTROLLED_TOPIC_TAGS)[number];

export const TOPIC_CRITERIA: Record<TopicTag, string> = {
  uk: 'Domestic UK news, national events, courts, criminal trials, policing, devolution and British public life',
  world: 'International affairs, foreign elections, global diplomacy, treaties and overseas disasters',
  politics: 'Westminster, parliaments, legislation, elections, party politics and government policy',
  business: 'Macroeconomics, financial markets, inflation, corporate earnings, retail and trade',
  tech_science: 'Artificial intelligence, cybersecurity, digital policy, space and medical research',
  environment: 'Climate policy, renewable energy, conservation, extreme weather and wildlife',
  society: 'Public health, education, transport, housing, demographics and social trends',
  sport: 'Tournaments, leagues, football transfers, athletes and sports governance',
  culture: 'Arts, entertainment, film, television, books, celebrity and royalty',
};

export const TOPIC_DISPLAY_LABELS: Record<TopicTag, string> = {
  uk: 'UK',
  world: 'World',
  politics: 'Politics',
  business: 'Business',
  tech_science: 'Tech & Science',
  environment: 'Environment',
  society: 'Society & Life',
  sport: 'Sport',
  culture: 'Culture & Arts',
};

export function isValidTopicTag(tag: string): tag is TopicTag {
  return CONTROLLED_TOPIC_TAGS.includes(tag as TopicTag);
}
