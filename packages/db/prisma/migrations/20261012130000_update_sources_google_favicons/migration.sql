-- Populate missing domains from homepageUrl where possible
UPDATE "Source"
SET "domain" = REGEXP_REPLACE(SPLIT_PART(SPLIT_PART("homepageUrl", '://', 2), '/', 1), '^www\.', '')
WHERE "domain" IS NULL AND "homepageUrl" IS NOT NULL;

-- Migrate existing favicon URLs from Icon Horse to Google's Favicon CDN
UPDATE "Source"
SET "faviconUrl" = 'https://www.google.com/s2/favicons?domain=' || REGEXP_REPLACE("domain", '^www\.', '') || '&sz=64'
WHERE "domain" IS NOT NULL;
