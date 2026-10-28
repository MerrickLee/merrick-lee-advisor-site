#!/usr/bin/env node
// Build an Insights post from a markdown draft. No npm dependencies at runtime of the site.
// Usage: node scripts/build-post.mjs <draft.md> [--no-images] [--og-only]
// Image optimisation and share-image rendering use headless Chrome via puppeteer-core
// (dev-only; resolved from PUPPETEER_CORE or /workspace/seo-fixes/tools/node_modules).
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://merricklee.com';
const INS = path.join(ROOT, 'insights');
const SERVICES = {
  'fractional-cmo': ['Fractional CMO', 'Senior growth leadership that owns the plan and the results, part time.'],
  'growth-marketing-consultant': ['Advisory Retainer', 'Ongoing strategy calls, KPI reviews and agency oversight.'],
  'marketing-audit': ['Growth Audit', 'A fixed-scope review of your ads, analytics, funnel and CRM, with a 90-day roadmap.'],
  'marketing-strategy-workshop': ['Marketing Strategy Workshop', 'A focused day with your leadership team on positioning, channels, budget and KPIs.'],
};
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const draftPath = args.find((a) => !a.startsWith('--'));
const warn = (m) => console.warn('⚠ ' + m);

/* ---------- helpers ---------- */
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const human = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/* ---------- frontmatter (small YAML subset) ---------- */
function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error('Draft needs --- frontmatter ---');
  const data = {}; let key = null, item = null;
  const val = (v) => { v = v.trim(); if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1); if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(',').map((x) => val(x)).filter(Boolean); return v; };
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    let r;
    if ((r = line.match(/^([A-Za-z_]+):\s*(.*)$/))) { key = r[1]; item = null; data[key] = r[2].trim() === '' ? [] : val(r[2]); }
    else if ((r = line.match(/^\s*-\s+([A-Za-z_]+):\s*(.*)$/)) && key) { item = { [r[1]]: val(r[2]) }; data[key].push(item); }
    else if ((r = line.match(/^\s*-\s+(.*)$/)) && key) { item = null; data[key].push(val(r[1])); }
    else if ((r = line.match(/^\s+([A-Za-z_]+):\s*(.*)$/)) && item) item[r[1]] = val(r[2]);
  }
  return { data, body: m[2] };
}

/* ---------- markdown ---------- */
function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const ext = /^https?:/.test(u) && !u.startsWith(SITE);
    return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => `<strong>${a || b}</strong>`);
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>').replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, '$1<em>$2</em>');
  return s;
}
function markdown(md, imgFn) {
  const lines = md.replace(/\r/g, '').split('\n'); const out = []; const toc = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let r;
    if ((r = l.match(/^(#{1,4})\s+(.*)$/))) {
      const lvl = Math.max(2, r[1].length); const id = slugify(r[2]);
      if (lvl === 2) toc.push([id, r[2]]);
      out.push(`<h${lvl} id="${id}">${inline(r[2])}</h${lvl}>`); i++; continue;
    }
    if ((r = l.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/))) { out.push(imgFn(r[2], r[1], r[3])); i++; continue; }
    if (/^>\s?/.test(l)) { const q = []; while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, '')); out.push(`<blockquote>${q.join('\n').split(/\n\s*\n/).map((p) => `<p>${inline(p.replace(/\n/g, ' '))}</p>`).join('')}</blockquote>`); continue; }
    if (/^\s*([-*+]|\d+\.)\s+/.test(l)) {
      const ol = /^\s*\d+\./.test(l); const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) { let t = lines[i++].replace(/^\s*([-*+]|\d+\.)\s+/, ''); while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+\.)\s+/.test(lines[i])) t += ' ' + lines[i++].trim(); items.push(`<li>${inline(t)}</li>`); }
      out.push(`<${ol ? 'ol' : 'ul'}>${items.join('')}</${ol ? 'ol' : 'ul'}>`); continue;
    }
    const p = []; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|!\[|\s*([-*+]|\d+\.)\s)/.test(lines[i])) p.push(lines[i++].trim());
    out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  return { html: out.join('\n'), toc };
}

/* ---------- browser (dev-only) ---------- */
let browser = null;
async function getBrowser() {
  if (browser) return browser;
  const tries = [process.env.PUPPETEER_CORE, path.join(ROOT, 'node_modules/puppeteer-core'), '/workspace/seo-fixes/tools/node_modules/puppeteer-core'].filter(Boolean);
  let pptr = null;
  for (const t of tries) { try { pptr = createRequire(import.meta.url)(t); break; } catch {} }
  if (!pptr) throw new Error('puppeteer-core not found. Set PUPPETEER_CORE=/path/to/node_modules/puppeteer-core');
  browser = await pptr.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  return browser;
}
const mime = (f) => ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' })[path.extname(f).toLowerCase()];
const dataUrl = (f) => `data:${mime(f)};base64,${fs.readFileSync(f).toString('base64')}`;

// Resize a source photo to <name>-800.webp and <name>-1600.webp in /img/opt. Returns {w,h} of the 1600 file.
async function optimise(srcFile, name) {
  const b = await getBrowser(); const pg = await b.newPage();
  await pg.setContent('<canvas id="c"></canvas>');
  const res = await pg.evaluate(async (src) => {
    const im = new Image(); im.src = src; await im.decode(); const outs = {};
    for (const w of [800, 1600]) { let tw = Math.min(w, im.naturalWidth); if (im.naturalHeight * tw / im.naturalWidth > w) tw = Math.round(w * im.naturalWidth / im.naturalHeight); const th = Math.round(im.naturalHeight * tw / im.naturalWidth);
      const c = document.getElementById('c'); c.width = tw; c.height = th; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, tw, th);
      let q = w === 800 ? 0.72 : 0.66, d = c.toDataURL('image/webp', q); while (d.length * 0.75 > 195 * 1024 && q > 0.45) { q -= 0.05; d = c.toDataURL('image/webp', q); } outs[w] = { d, w: tw, h: th }; }
    return outs;
  }, dataUrl(srcFile));
  await pg.close();
  for (const w of [800, 1600]) fs.writeFileSync(path.join(ROOT, 'img/opt', `${name}-${w}.webp`), Buffer.from(res[w].d.split(',')[1], 'base64'));
  for (const w of [800, 1600]) { const kb = fs.statSync(path.join(ROOT, 'img/opt', `${name}-${w}.webp`)).size / 1024; if (kb > 200) warn(`${name}-${w}.webp is ${Math.round(kb)} KB`); }
  return { w: res[1600].w, h: res[1600].h, w8: res[800].w };
}

// Branded 1200x630 share image. Returns repo-relative path.
export async function shareImage({ title, kicker = 'Insights', out }) {
  const font = (f) => pathToFileURL(path.join(ROOT, 'assets/fonts', f)).href;
  const sig = dataUrl(path.join(ROOT, 'img/opt/merrick-lee-signature-600.webp'));
  const size = title.length > 80 ? 56 : title.length > 55 ? 64 : 72;
  const html = `<html><head><meta charset="utf-8"><style>@font-face{font-family:F;src:url(${font('fraunces-latin-var.woff2')})}@font-face{font-family:I;src:url(${font('inter-latin-var.woff2')})}
  *{margin:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden;font-family:I}
  .c{position:relative;background:#fbfaf7;height:630px;padding:56px 72px;border-bottom:14px solid #14213d}
  .k{font-size:20px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:#2a7d6b}
  h1{font-family:F;font-weight:500;letter-spacing:-.015em;line-height:1.06;font-size:${size}px;color:#14213d;margin-top:20px;max-width:1000px}
  .bar{position:absolute;left:72px;right:72px;bottom:44px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e7e3da;padding-top:22px}
  .bar img{height:78px}.bar span{font-size:24px;font-weight:600;color:#14213d}</style></head>
  <body><div class="c"><div class="k">${esc(kicker)}</div><h1>${esc(title)}</h1><div class="bar"><img src="${sig}"><span>merricklee.com</span></div></div></body></html>`;
  const tmp = path.join(ROOT, '.og-tmp.html'); fs.writeFileSync(tmp, html);
  const b = await getBrowser(); const pg = await b.newPage(); await pg.setViewport({ width: 1200, height: 630 });
  await pg.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle0' }); await pg.evaluate(() => document.fonts.ready);
  const abs = path.join(ROOT, out); fs.mkdirSync(path.dirname(abs), { recursive: true });
  await pg.screenshot({ path: abs, type: 'jpeg', quality: 84 }); await pg.close(); fs.unlinkSync(tmp);
  if (fs.statSync(abs).size > 200 * 1024) warn(`${out} is over 200 KB`);
  return out;
}

/* ---------- photo reuse check ---------- */
function allPages() { const r = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { if (f.name.startsWith('.') || ['node_modules', 'img', 'assets', 'scripts'].includes(f.name)) continue; const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.html')) r.push(p); } })(ROOT); return r; }
function checkReuse(stem, selfFile, hash, creditUrl) {
  for (const p of allPages()) {
    if (p === selfFile || p.endsWith('_template.html')) continue;
    const h = fs.readFileSync(p, 'utf8'); const where = path.relative(ROOT, p);
    if (h.includes(stem)) warn(`photo "${stem}" is already used on ${where}; pick another photo`);
    const m = h.match(/<script type="application\/json" id="post-data">([\s\S]*?)<\/script>/);
    const used = m ? JSON.parse(m[1]).photos || [] : [];
    if (used.some((u) => u.hash === hash)) warn(`the same image file (${stem}) is already used on ${where}`);
    if (creditUrl && used.some((u) => u.credit_url === creditUrl)) warn(`stock photo ${creditUrl} is already used on ${where}`);
  }
}
const STOCK = { unsplash: ['Unsplash', 'https://unsplash.com/'], pexels: ['Pexels', 'https://www.pexels.com/'] };
function creditHtml(c) {
  if (!c || !c.credit) return '';
  const name = c.credit_url ? `<a href="${esc(c.credit_url)}" target="_blank" rel="noopener">${esc(c.credit)}</a>` : esc(c.credit);
  const st = STOCK[String(c.source || '').toLowerCase()];
  return `<figcaption class="credit">Photo: ${name}${st ? ` on <a href="${st[1]}" target="_blank" rel="noopener">${st[0]}</a>` : ''}</figcaption>`;
}

/* ---------- posts registry ---------- */
function readPosts() {
  return fs.readdirSync(INS, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(INS, d.name, 'index.html')))
    .map((d) => { const h = fs.readFileSync(path.join(INS, d.name, 'index.html'), 'utf8'); const m = h.match(/<script type="application\/json" id="post-data">([\s\S]*?)<\/script>/); return m ? JSON.parse(m[1]) : null; })
    .filter(Boolean).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
function regenListing(posts) {
  const f = path.join(INS, 'index.html'); let h = fs.readFileSync(f, 'utf8');
  const empty = `<li class="empty"><h2>First posts coming soon</h2><p>I'm writing up the questions I hear most from owners and leadership teams. Check back shortly, or book a fit call if you'd rather talk it through now.</p></li>`;
  const cards = posts.length ? posts.map((p) => `<li class="pcard"><p class="pmeta"><time datetime="${p.date}">${human(p.date)}</time> · ${p.reading_time} min read</p><h2><a href="/insights/${p.slug}/">${esc(p.title)}</a></h2><p>${esc(p.excerpt)}</p></li>`).join('') : empty;
  h = h.replace(/<!-- POSTS:START -->[\s\S]*?<!-- POSTS:END -->/, `<!-- POSTS:START -->${cards}<!-- POSTS:END -->`);
  h = h.replace(/<script type="application\/ld\+json" id="blog-jsonld">([\s\S]*?)<\/script>/, (_, j) => { const d = JSON.parse(j); d['@graph'][0].blogPost = posts.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/insights/${p.slug}/`, datePublished: p.date, author: { '@id': `${SITE}/#person` } })); return `<script type="application/ld+json" id="blog-jsonld">${JSON.stringify(d)}</script>`; });
  fs.writeFileSync(f, h);
}
function regenRelated(posts) {
  for (const p of posts) {
    const f = path.join(INS, p.slug, 'index.html'); const others = posts.filter((o) => o.slug !== p.slug).slice(0, 3);
    const block = others.length ? `<section class="prel" aria-labelledby="rel-h"><h2 id="rel-h">Related insights</h2><ul>${others.map((o) => `<li><a href="/insights/${o.slug}/">${esc(o.title)}<span>${esc(o.excerpt)}</span></a></li>`).join('')}</ul></section>` : '';
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/<!-- RELATED:START -->[\s\S]*?<!-- RELATED:END -->/, `<!-- RELATED:START -->${block}<!-- RELATED:END -->`));
  }
}
function updateSitemap(slug, date) {
  const f = path.join(ROOT, 'sitemap.xml'); if (!fs.existsSync(f)) { console.log('No sitemap.xml; skipping.'); return; }
  const url = `${SITE}/insights/${slug}/`; let x = fs.readFileSync(f, 'utf8'); if (x.includes(`<loc>${url}</loc>`)) return;
  x = x.replace('</urlset>', `  <url><loc>${url}</loc><lastmod>${date}</lastmod></url>\n</urlset>`); fs.writeFileSync(f, x); console.log('Added to sitemap.xml');
}

/* ---------- main ---------- */
async function main() {
  if (!draftPath) { console.log('Usage: node scripts/build-post.mjs <draft.md> [--no-images]\n       node scripts/build-post.mjs --listing-og   (regenerate /img/og/insights.jpg)\n       node scripts/build-post.mjs --reindex      (rebuild listing + related blocks)'); 
    if (flag('--listing-og')) await shareImage({ title: 'Lessons on growth, marketing and AI', out: 'img/og/insights.jpg' });
    if (flag('--reindex')) { const ps = readPosts(); regenListing(ps); regenRelated(ps); }
    if (browser) await browser.close(); return; }
  const draftDir = path.dirname(path.resolve(draftPath));
  const { data: fm, body } = parseFrontmatter(fs.readFileSync(draftPath, 'utf8'));
  for (const k of ['title', 'date', 'slug', 'meta_title', 'meta_description', 'excerpt']) if (!fm[k]) throw new Error(`frontmatter is missing "${k}"`);
  const slug = slugify(fm.slug); const outDir = path.join(INS, slug); const outFile = path.join(outDir, 'index.html');
  const url = `${SITE}/insights/${slug}/`; const updated = fm.updated || fm.date;
  const kw = [fm.primary_keyword, ...[].concat(fm.secondary_keywords || [])].filter(Boolean);
  if (fm.primary_keyword && !fm.title.toLowerCase().includes(String(fm.primary_keyword).toLowerCase())) warn(`title (H1) does not contain primary_keyword "${fm.primary_keyword}"`);
  const resolveSrc = (p) => (p.startsWith('/') && fs.existsSync(path.join(ROOT, p)) ? path.join(ROOT, p) : path.resolve(draftDir, p));
  const images = []; const noImg = flag('--no-images');

  const photos = [];
  const credits = Object.fromEntries([].concat(fm.images || []).filter((x) => x.src).map((x) => [x.src, x]));
  async function photo(src, alt, descriptor, hero, credit) {
    if (!alt) warn(`image ${src} has no alt text`);
    const file = resolveSrc(src); const stem = path.basename(file).replace(/\.[^.]+$/, '').replace(/-(800|1600)$/, '');
    if (credit && credit.source && !STOCK[String(credit.source).toLowerCase()]) warn(`unknown source "${credit.source}" (use unsplash or pexels)`);
    const hash = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
    checkReuse(stem, outFile, hash, credit && credit.credit_url);
    photos.push({ stem, hash, ...(credit && credit.credit_url ? { credit_url: credit.credit_url } : {}) });
    const name = `${slug}-${slugify(descriptor || alt.split(/\s+/).slice(0, 6).join(' ') || 'image')}`;
    const dims = noImg ? { w: 1600, h: 1067, w8: 800 } : await optimise(file, name);
    images.push(`${SITE}/img/opt/${name}-1600.webp`);
    const attrs = hero ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"';
    const sizes = hero ? '(max-width:1320px) 100vw, 1240px' : '(max-width:760px) 100vw, 700px';
    return `<img ${attrs} sizes="${sizes}" src="/img/opt/${name}-1600.webp" srcset="/img/opt/${name}-800.webp ${dims.w8 || 800}w, /img/opt/${name}-1600.webp ${dims.w}w" width="${dims.w}" height="${dims.h}" alt="${esc(alt)}">`;
  }

  let heroHtml = '', heroFile = null;
  if (fm.hero) { if (!fm.hero_alt) warn('hero_alt is missing'); heroFile = resolveSrc(fm.hero); const hc = { credit: fm.hero_credit, credit_url: fm.hero_credit_url, source: fm.hero_source }; heroHtml = `<figure class="phero">${await photo(fm.hero, fm.hero_alt || '', fm.hero_descriptor || 'hero', true, hc)}${creditHtml(hc)}</figure>`; }
  // inline images: collect first, then render synchronously
  const imgJobs = []; markdown(body, (s, a, d) => { imgJobs.push([s, a, d]); return ''; });
  const imgHtml = []; for (const [s, a, d] of imgJobs) imgHtml.push(await photo(s, a, d, false, credits[s]) + creditHtml(credits[s]));
  let n = 0; const { html, toc } = markdown(body, (s, a) => `<figure>${imgHtml[n++]}${a ? '' : ''}</figure>`);
  const words = body.replace(/[#>*_`\[\]()!-]/g, ' ').split(/\s+/).filter(Boolean).length; const rt = Math.max(1, Math.round(words / 230));
  const tocHtml = toc.length >= 2 ? `<nav class="toc" aria-label="On this page"><strong>On this page</strong><ol>${toc.map(([id, t]) => `<li><a href="#${id}">${inline(t)}</a></li>`).join('')}</ol></nav>` : '';
  const faq = [].concat(fm.faq || []).filter((f) => f.q && f.a);
  const faqHtml = faq.length ? `<section class="pfaq" aria-labelledby="faq-h"><h2 id="faq-h">Questions</h2>${faq.map((f, i) => `<details${i ? '' : ' open'}><summary>${esc(f.q)}</summary><p>${inline(f.a)}</p></details>`).join('')}</section>` : '';
  let svc = [].concat(fm.services || []).map(slugify).filter((s) => SERVICES[s]);
  if (svc.length < 2) svc = [...new Set([...svc, 'marketing-audit', 'fractional-cmo', 'growth-marketing-consultant'])].slice(0, 3);
  svc = svc.slice(0, 3);
  const extra = [].concat(fm.related || []).filter((r) => r.title && r.url);
  const svcHtml = `<section class="psvc" aria-labelledby="svc-h"><h2 id="svc-h">Where I can help</h2><ul>${svc.map((s) => `<li><a href="/${s}/">${SERVICES[s][0]}<span>${SERVICES[s][1]}</span></a></li>`).join('')}${extra.map((r) => `<li><a href="${esc(r.url)}">${esc(r.title)}${r.note ? `<span>${esc(r.note)}</span>` : ''}</a></li>`).join('')}</ul></section>`;

  const ogRel = `img/og/${slug}.jpg`;
  if (!noImg) await shareImage({ title: fm.title, out: ogRel });
  const ogUrl = `${SITE}/${ogRel}`;
  const person = { '@type': 'Person', '@id': `${SITE}/#person`, name: 'Merrick Lee Jr.', url: `${SITE}/`, jobTitle: 'Strategic Growth Advisor' };
  const graph = [
    { '@type': 'Article', '@id': `${url}#article`, headline: fm.title, description: fm.meta_description, url, mainEntityOfPage: url, image: [ogUrl, ...images], datePublished: fm.date, dateModified: updated, inLanguage: 'en-US', wordCount: words, ...(kw.length ? { keywords: kw.join(', ') } : {}), author: person, publisher: { '@id': `${SITE}/#person` }, isPartOf: { '@id': `${SITE}/insights/#blog` }, breadcrumb: { '@id': `${url}#breadcrumb` } },
    { '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: 'Insights', item: `${SITE}/insights/` }, { '@type': 'ListItem', position: 3, name: fm.title, item: url }] },
  ];
  if (faq.length) graph.push({ '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') } })) });
  const postData = { slug, title: fm.title, date: fm.date, excerpt: fm.excerpt, reading_time: rt, photos };
  const vars = { meta_title: esc(fm.meta_title), meta_description: esc(fm.meta_description), keywords: esc(kw.join(', ')), canonical: url, og_image: ogUrl, title: esc(fm.title), crumb: esc(fm.crumb || fm.title), date: fm.date, updated, date_human: human(fm.date), reading_time: rt, hero: heroHtml, toc: tocHtml, body: html, faq: faqHtml, services: svcHtml, related: '', body_class: 'post-page v-a', jsonld: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c'), post_data: JSON.stringify(postData).replace(/</g, '\\u003c') };
  let page = fs.readFileSync(path.join(INS, '_template.html'), 'utf8').replace(/<!-- POST TEMPLATE:[\s\S]*?-->\n?/, '');
  page = page.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(outFile, page);
  const posts = readPosts(); regenListing(posts); regenRelated(posts); updateSitemap(slug, updated);
  if (browser) await browser.close();
  console.log(`Built /insights/${slug}/ (${words} words, ${rt} min read, ${images.length} photos, share image /${ogRel})`);
}
main().catch(async (e) => { console.error('✖ ' + e.message); if (browser) await browser.close(); process.exit(1); });
