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
related_posts: [slug-a, slug-b]          # optional; orders the "Related insights" block (else newest posts)
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
- Converts every photo to `/img/opt/<slug>-<descriptor>-800.webp` and `-1600.webp` (WebP q0.72/0.66, stepped down automatically to stay under ~195 KB, height capped at the tier width, warns over 200 KB) with srcset, width and height. The hero loads eagerly with `fetchpriority="high"`. Inline images lazy-load.
- Warns if a photo is already used on another page (no photo should appear twice on the site) or is missing alt text.
- Renders a 1200×630 branded share image (Editorial style: off-white card, Source Serif 4 navy title, signature, navy rule; no photo) to `/img/og/<slug>.jpg` and uses it for og:image and twitter:image.
- Writes Article, BreadcrumbList and (when there's an faq) FAQPage JSON-LD, plus canonical, OG and Twitter tags.
- Regenerates the listing cards (newest first), the Blog JSON-LD and the "Related insights" block on every post. That block appears once there are two or more posts.
- Adds the URL to `sitemap.xml` if that file exists. Otherwise it skips this step.

### Scheduling a post (publishes on its own)

Approved posts can be queued with a go-live time. `.github/workflows/publish-scheduled.yml` runs every 15 minutes on GitHub (no bot or computer needed), publishes anything whose time has passed and commits to `main`, and Vercel deploys it as usual. Times are New York wall-clock time; daylight saving is handled.

1. Build the post as usual on a scratch copy of the site, with `date:` set to the go-live date: `node scripts/build-post.mjs draft.md`.
2. Make a queue folder, e.g. `scheduled/2026-11-25-fractional-cmo-vs-marketing-agency/`, containing:
   - `publish.json`: `{ "slug": "fractional-cmo-vs-marketing-agency", "publish_at": "2026-11-25T10:00", "timezone": "America/New_York" }`
   - `files/`: only the post's own new files at their final paths: `files/insights/<slug>/index.html`, `files/img/opt/<slug>-*.webp`, `files/img/og/<slug>.jpg`. Don't include `insights/index.html`, `sitemap.xml` or other posts; those are regenerated at go-live.
   - `edits.patch` (optional): a `git diff` for changes to pages that are already live, such as a body link from an older post to this one. It is applied at go-live and must still apply cleanly then.
3. Check the queue: `node scripts/publish-scheduled.mjs --check` (also runs automatically on pull requests and pushes that touch `scheduled/`). `--list` shows every queued post and its go-live time in UTC.
4. Commit the folder to `main`.

Rules the publisher enforces (a broken rule fails the run, which emails the repo owner, and nothing is committed):
- Never early: a post goes live on the first run at or after `publish_at` (in practice up to ~15–30 minutes after, because GitHub's scheduler can run late).
- The post's `date` must equal the `publish_at` date.
- No live page may link to a queued post, and a post can't link to one that goes live after it.
- New files may not overwrite different existing files, and `edits.patch` must apply cleanly.
- Running again changes nothing. If a queued post is already live (published by hand), its folder is just removed.
- After publishing, the run waits for Vercel's deploy status on the commit and fails if the deploy fails or never starts.

Test the publisher with `node scripts/test-publish-scheduled.mjs` (uses throwaway copies in `/tmp`). To publish right away instead of waiting, run the workflow manually from the Actions tab ("Run workflow"); it still publishes only what's due.

### Photo credits (Unsplash, Pexels and other sources)

You can use your own photos or free stock photos. Download the file, point the draft at it, and add the credit:

```yaml
hero: ./photos/unsplash-city-street.jpg
hero_alt: Busy street in Midtown Manhattan at dusk
hero_credit: Jane Doe
hero_credit_url: https://unsplash.com/@janedoe
hero_source: unsplash          # unsplash or pexels (optional)
images:                         # credits for inline images, matched by src
  - src: ./photos/pexels-laptop.jpg
    credit: John Roe
    credit_url: https://www.pexels.com/@johnroe
    source: pexels
```

Credited images get a small caption such as "Photo: Jane Doe on Unsplash". The links use `rel="noopener"`. The photo-reuse warning compares each image's file hash and stock credit URL against existing posts, so a stock photo still gets caught after it's renamed.

## Liora chat panel

`/assets/liora-chat.js` (loaded by `site.js` on every page) adds a floating "Chat with Liora" bubble bottom-right. It opens a typed chat with Liora, Merrick's AI assistant, with a "Call Liora" tap-to-call button ((914) 491-6765) in the panel header. Styles are in `/assets/liora.css`.

- **Endpoint:** `window.LIORA_CHAT_URL`, or `<meta name="liora-chat-url" content="https://…/chat">`, or `DEFAULT_URL` at the top of `liora-chat.js`. The server is `liora-voice` (`POST /chat`, `POST /chat/end`). Its CORS allowlist covers merricklee.com, www, localhost and `merrick-lee-advisor-site*.vercel.app` previews.
- **Fallback:** if the endpoint is empty or unreachable, the panel shows the phone number and liora@merricklee.com.
- **Pre-chat form:** visitors must enter name, email, and a US phone and pass a Cloudflare Turnstile check (managed widget, site key `TURNSTILE_SITEKEY` in `liora-chat.js`) before chatting. There's also a hidden honeypot field; the server (`POST /chat/start`) re-validates everything, verifies the Turnstile token, and checks the fill time. Turnstile only works on merricklee.com, www, and localhost, so Vercel previews show the form but can't start a chat.
- The conversation is kept in `sessionStorage` so it follows the visitor across pages; "End chat" ends it on the server (lead record + check-in for Merrick).
