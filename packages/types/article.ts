// Article type definition for ingestion pipeline
// TODO: Expand with more metadata as needed
export interface Article {
  title: string;
  url: string;
  source: string;
  publishedAt: string; // ISO date string
  snippet?: string; // Short summary/snippet from RSS feed
  content?: string; // Full article content (may be undefined until extracted)
  author?: string;
  // Add more fields as needed (e.g., image, tags, etc.)
}
