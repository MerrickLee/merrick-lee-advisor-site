# merrick-lee-advisor-site

Static preview of Merrick Lee Jr.'s advisor site: the homepage and four service pages. There is no build step. Vercel serves these files as-is.

This deploy is a preview only. Every page includes a `noindex, nofollow` robots meta tag, `vercel.json` sends `X-Robots-Tag: noindex` on all paths, and `robots.txt` disallows every crawler.

## Insights blog

- `/insights/` is the listing page. Post cards are generated between `<!-- POSTS:START -->` and `<!-- POSTS:END -->`. With no posts, it shows a "First posts coming soon" empty state.
- `/insights/_template.html` is the post template. It isn't linked anywhere. `{{placeholders}}` are filled in by the build script.
- Each post is built to `/insights/<slug>/index.html`.

### Publishing a draft

```bash
node scripts/build-post.mjs /workspace/blog-drafts/my-post.md
node scripts/build-post.mjs --reindex      # rebuild listing cards + "Related insights" from existing posts
node scripts/build-post.mjs --listing-og   # regenerate /img/og/insights.jpg
```

The script has no npm dependencies. To optimize images and render the share image, it drives headless Chrome through `puppeteer-core`. That's a dev-only tool and is never deployed. The script looks for it at `$PUPPETEER_CORE`, `./node_modules/puppeteer-core` or `/workspace/seo-fixes/tools/node_modules/puppeteer-core`. Chrome comes from `$CHROME_PATH`, which defaults to `/usr/bin/google-chrome`. Use `--no-images` to skip image work.

Draft frontmatter:

```yaml
---
title: How AI search is changing local business visibility   # H1; should contain primary_keyword
date: 2026-11-02
updated: 2026-11-05            # optional, dateModified
slug: ai-search-local-visibility
meta_title: ...
meta_description: ...
excerpt: One or two lines for the listing card.
primary_keyword: AI search
secondary_keywords: [local SEO, AI overviews]
hero: /img/some-source-photo.jpg      # optional; repo-root path or path relative to the draft
hero_alt: Descriptive alt text
hero_descriptor: speaking-to-owners   # optional; used in the SEO file name
services: [marketing-audit, fractional-cmo]   # 2–3 of: fractional-cmo, growth-marketing-consultant, marketing-audit, marketing-strategy-workshop
related:                               # optional extra links
  - title: Pricing
    url: /pricing/
faq:                                   # optional; adds a Questions section + FAQPage JSON-LD
  - q: Question?
    a: Answer.
---
```

The markdown body supports `##`/`###` headings (each H2 feeds the auto table of contents), paragraphs, `-`/`1.` lists, `**bold**`, `*italic*`, `[links](/url/)`, `> blockquotes` and inline images on their own line: `![alt text](/img/source.jpg "seo-descriptor")`.

What the script does:
- Converts every photo to `/img/opt/<slug>-<descriptor>-800.webp` and `-1600.webp` (WebP q0.72/0.66, height capped at the tier width, warns over 200 KB) with srcset, width and height. The hero loads eagerly with `fetchpriority="high"`. Inline images lazy-load.
- Warns if a photo is already used on another page (no photo should appear twice on the site) or is missing alt text.
- Renders a 1200×630 branded share image (Editorial style: off-white card, Fraunces navy title, signature, navy rule; no photo) to `/img/og/<slug>.jpg` and uses it for og:image and twitter:image.
- Writes Article, BreadcrumbList and (when there's an faq) FAQPage JSON-LD, plus canonical, OG and Twitter tags.
- Regenerates the listing cards (newest first), the Blog JSON-LD and the "Related insights" block on every post. That block appears once there are two or more posts.
- Adds the URL to `sitemap.xml` if that file exists. Otherwise it skips this step.
