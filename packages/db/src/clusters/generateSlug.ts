import slugify from 'slugify';

export function generateSlug(headline: string): string {
  return slugify(headline, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  });
}
