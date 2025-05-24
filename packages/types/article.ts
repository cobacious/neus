// Article type definition for ingestion pipeline
// TODO: Expand with more metadata as needed
export interface Article {
  title: string;
  url: string;
  source: string;
  publishedAt: string; // ISO date string
  content: string;
  author?: string;
  // Add more fields as needed (e.g., image, tags, etc.)
}
