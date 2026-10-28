# Search indexing for Cinema500

The public canonical URL is https://riphatake16-debug.github.io/cinema500/. The home page contains a static Persian brand introduction, a descriptive title, description, canonical link, sharing metadata and WebApplication JSON-LD. Its sitemap is https://riphatake16-debug.github.io/cinema500/sitemap.xml.

The site is under a project subdirectory. Google does not support a separate Search site-name entity at subdirectory level; WebApplication markup describes the actual app, without promising the site-name feature or rich results. A robots.txt inside /cinema500/ would not control crawling of this origin, so none is supplied as a fake fix. The origin's robots.txt must remain accessible or absent and must not disallow this path.

To request indexing with the owner's Google account:
1. Add a URL-prefix property in Google Search Console using the full canonical URL, including the final slash. Do not use a Domain property for github.io.
2. Choose HTML tag verification. Copy the exact google-site-verification meta tag from Google and add it to the home page head. Keep it after verification. Do not invent a token.
3. Verify ownership, submit sitemap.xml in Sitemaps, and inspect the canonical home URL using URL Inspection. Run Test live URL and Request indexing if offered.
4. Monitor Page indexing and Performance. Publication, verification, a sitemap and a crawl request do not guarantee indexing or rank for the brand query. No request has been submitted merely by deploying these files.

Official references:
https://support.google.com/webmasters/answer/9008080
https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
https://developers.google.com/search/docs/appearance/site-names
