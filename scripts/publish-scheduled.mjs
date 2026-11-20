#!/usr/bin/env node
// Publish queued Insights posts whose go-live time has passed.
// Runs in GitHub Actions (.github/workflows/publish-scheduled.yml) with no bot involved.
// No npm dependencies; does not need Chrome (posts are pre-built when they are queued).
//
// Usage:
//   node scripts/publish-scheduled.mjs              publish everything that is due now
//   node scripts/publish-scheduled.mjs --check      validate the queue only (simulates publishing every
//                                                   queued post, in order, on a throwaway copy of the site)
//   node scripts/publish-scheduled.mjs --list       show the queue and when each post goes live
//   --now=2026-11-25T15:00:00Z                      pretend it is this time (tests only)
//   --root=/path/to/site                            operate on another copy of the site (tests only)
//
// Queue layout (see scheduled/README.md):
//   scheduled/<anything>/publish.json   {"slug": "...", "publish_at": "2026-11-25T10:00", "timezone": "America/New_York"}
//   scheduled/<anything>/files/...      new files, at their final repo paths (insights/<slug>/index.html, img/opt/..., img/og/...)
//   scheduled/<anything>/edits.patch    optional: changes to files that already exist (e.g. a body link in an older post)
//
// Guarantees: never publishes before publish_at (wall-clock time in `timezone`, DST-aware); idempotent
// (a published item's queue folder is deleted in the same commit, and an item whose post already exists is
// only cleaned up); any problem exits non-zero before anything is committed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SITE = 'https://merricklee.com';
const args = process.argv.slice(2);
const opt = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const flag = (k) => args.includes(`--${k}`);
const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(opt('root') || SCRIPT_ROOT);
const NOW = opt('now') ? new Date(opt('now')) : new Date();
if (isNaN(NOW)) fail(`--now is not a valid date: ${opt('now')}`);

function fail(msg) { console.error(`✖ ${msg}`); if (process.env.GITHUB_ACTIONS) console.log(`::error::${msg.replace(/\n/g, '%0A')}`); process.exit(1); }
const rel = (root, p) => path.relative(root, p).split(path.sep).join('/');

/* ---------- time zones ---------- */
// Offset (ms) of `tz` from UTC at instant `ms`.
function tzOffset(ms, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - Math.floor(ms / 1000) * 1000;
}
// Wall-clock "YYYY-MM-DDTHH:MM" in `tz` -> UTC Date. Throws for times that don't exist (spring-forward gap).
function zonedToUtc(local, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error(`publish_at must look like 2026-11-25T10:00 (got "${local}")`);
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = guess - tzOffset(guess, tz);
  t = guess - tzOffset(t, tz);
  const back = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t)).replace(' ', 'T');
  if (back !== local) throw new Error(`${local} does not exist in ${tz} (daylight-saving gap)`);
  return new Date(t);
}

/* ---------- queue ---------- */
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isSymbolicLink()) throw new Error(`symlinks are not allowed in the queue: ${p}`);
    return d.isDirectory() ? walk(p) : [p];
  });
}
function postData(html) {
  const m = html.match(/<script type="application\/json" id="post-data">([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}
function readQueue(root) {
  const q = path.join(root, 'scheduled');
  if (!fs.existsSync(q)) return [];
  const items = [];
  for (const d of fs.readdirSync(q, { withFileTypes: true })) {
    if (!d.isDirectory()) continue; // README.md etc.
    const dir = path.join(q, d.name);
    const where = `scheduled/${d.name}`;
    const metaFile = path.join(dir, 'publish.json');
    if (!fs.existsSync(metaFile)) throw new Error(`${where}: missing publish.json`);
    let meta; try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch (e) { throw new Error(`${where}/publish.json: ${e.message}`); }
    const { slug, publish_at: at, timezone: tz = 'America/New_York' } = meta;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || '')) throw new Error(`${where}: "slug" must be lowercase-with-dashes`);
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { throw new Error(`${where}: unknown timezone "${tz}"`); }
    let when; try { when = zonedToUtc(at, tz); } catch (e) { throw new Error(`${where}: ${e.message}`); }
    const filesDir = path.join(dir, 'files');
    const files = walk(filesDir).map((f) => ({ src: f, dest: rel(filesDir, f) }));
    for (const f of files) if (f.dest.startsWith('..') || f.dest.startsWith('.git') || f.dest.startsWith('scheduled/') || f.dest.startsWith('.github/')) throw new Error(`${where}: file outside the site: ${f.dest}`);
    const page = files.find((f) => f.dest === `insights/${slug}/index.html`);
    if (!page) throw new Error(`${where}: files/insights/${slug}/index.html is missing`);
    const pd = postData(fs.readFileSync(page.src, 'utf8'));
    if (!pd) throw new Error(`${where}: the post page has no post-data block (build it with scripts/build-post.mjs)`);
    if (pd.slug !== slug) throw new Error(`${where}: post-data slug "${pd.slug}" does not match publish.json slug "${slug}"`);
    if (pd.date !== at.slice(0, 10)) throw new Error(`${where}: the post is dated ${pd.date} but is scheduled for ${at.slice(0, 10)}. Rebuild it with the right date.`);
    const patch = path.join(dir, 'edits.patch');
    const extra = fs.readdirSync(dir).filter((n) => !['publish.json', 'files', 'edits.patch', 'README.md', 'NOTES.md'].includes(n));
    if (extra.length) throw new Error(`${where}: unexpected entries ${extra.join(', ')}`);
    items.push({ name: d.name, dir, where, slug, at, tz, when, files, patch: fs.existsSync(patch) ? patch : null, date: pd.date, title: pd.title });
  }
  const seen = new Set();
  for (const it of items) { if (seen.has(it.slug)) throw new Error(`slug ${it.slug} is queued twice`); seen.add(it.slug); }
  return items.sort((a, b) => a.when - b.when || a.name.localeCompare(b.name));
}

/* ---------- publishing ---------- */
const livePost = (root, slug) => fs.existsSync(path.join(root, 'insights', slug, 'index.html'));
function publishItem(root, it) {
  if (livePost(root, it.slug)) {
    fs.rmSync(it.dir, { recursive: true, force: true });
    return { slug: it.slug, status: 'already-live' };
  }
  // Check everything before writing anything.
  for (const f of it.files) {
    const dest = path.join(root, f.dest);
    if (fs.existsSync(dest) && !fs.readFileSync(dest).equals(fs.readFileSync(f.src))) throw new Error(`${it.where}: ${f.dest} already exists on the site with different content`);
  }
  if (it.patch) {
    try { execFileSync('git', ['apply', '--check', '--whitespace=nowarn', it.patch], { cwd: root, stdio: 'pipe' }); }
    catch (e) { throw new Error(`${it.where}: edits.patch no longer applies to the live site:\n${String(e.stderr || e.message).trim()}`); }
  }
  for (const f of it.files) { const dest = path.join(root, f.dest); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(f.src, dest); }
  if (it.patch) execFileSync('git', ['apply', '--whitespace=nowarn', it.patch], { cwd: root, stdio: 'pipe' });
  fs.rmSync(it.dir, { recursive: true, force: true });
  addToSitemap(root, it.slug, it.date);
  return { slug: it.slug, status: 'published' };
}
function addToSitemap(root, slug, date) {
  const f = path.join(root, 'sitemap.xml'); if (!fs.existsSync(f)) return;
  const url = `${SITE}/insights/${slug}/`; let x = fs.readFileSync(f, 'utf8'); if (x.includes(`<loc>${url}</loc>`)) return;
  fs.writeFileSync(f, x.replace('</urlset>', `  <url><loc>${url}</loc><lastmod>${date}</lastmod></url>\n</urlset>`));
}
function reindex(root) {
  // Rebuild the /insights/ cards, Blog JSON-LD and every post's "Related insights" block from live posts only.
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build-post.mjs'), '--reindex'], { cwd: root, stdio: 'pipe' });
}
// Every merricklee.com /insights/<slug> link on a live page (other sites' /insights/ paths are ignored) must point to a live post (so nothing links to a queued post).
function checkLinks(root, queuedSlugs) {
  const problems = [];
  const pages = walk(root).filter((f) => f.endsWith('.html') && !rel(root, f).startsWith('scheduled/') && !rel(root, f).startsWith('node_modules/') && !rel(root, f).startsWith('.git/') && rel(root, f) !== 'insights/_template.html');
  const extraFiles = ['sitemap.xml', 'llms.txt'].map((f) => path.join(root, f)).filter((f) => fs.existsSync(f));
  for (const f of [...pages, ...extraFiles]) {
    const txt = fs.readFileSync(f, 'utf8');
    for (const m of txt.matchAll(/(?<![\w.\/-])(?:https?:\/\/(?:www\.)?merricklee\.com)?\/insights\/([a-z0-9-]+)/g)) {
      const s = m[1];
      if (queuedSlugs.has(s)) problems.push(`${rel(root, f)} links to queued (not yet live) post /insights/${s}/`);
      else if (!livePost(root, s) && s !== '_template') problems.push(`${rel(root, f)} links to /insights/${s}/, which does not exist`);
    }
  }
  return [...new Set(problems)];
}

function run(root, now) {
  const queue = readQueue(root);
  const due = queue.filter((it) => it.when <= now);
  const results = due.map((it) => publishItem(root, it));
  if (results.some((r) => r.status === 'published')) reindex(root);
  const left = readQueue(root);
  const problems = checkLinks(root, new Set(left.map((it) => it.slug)));
  if (problems.length) throw new Error(`link check failed:\n  ${problems.join('\n  ')}`);
  return { results, left };
}

function copySite(root) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-check-'));
  fs.cpSync(root, tmp, { recursive: true, filter: (s) => !/[\\/](\.git|node_modules)$/.test(s) });
  return tmp;
}

const fmt = (it) => `${it.at} ${it.tz} (${it.when.toISOString().replace('.000Z', 'Z')})  ${it.slug}${it.patch ? '  + edits.patch' : ''}`;
try {
  if (flag('list')) {
    const q = readQueue(ROOT);
    console.log(q.length ? q.map((it) => `${it.when <= NOW ? 'DUE   ' : 'queued'}  ${fmt(it)}`).join('\n') : 'Queue is empty.');
  } else if (flag('check')) {
    const q = readQueue(ROOT);
    // 1) Today's site: nothing live may link to a queued post.
    const now = checkLinks(ROOT, new Set(q.filter((it) => it.when > NOW).map((it) => it.slug)));
    if (now.length) throw new Error(`link check failed:\n  ${now.join('\n  ')}`);
    // 2) Simulate each go-live, in order, on a throwaway copy.
    const tmp = copySite(ROOT);
    try {
      for (const it of q) { run(tmp, it.when); console.log(`ok  ${fmt(it)}`); }
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    console.log(`Queue OK (${q.length} item${q.length === 1 ? '' : 's'}).`);
  } else {
    const { results, left } = run(ROOT, NOW);
    for (const r of results) console.log(r.status === 'published' ? `Published /insights/${r.slug}/` : `/insights/${r.slug}/ was already live; removed its queue folder`);
    if (!results.length) console.log(`Nothing due at ${NOW.toISOString()}.`);
    if (left.length) console.log(`Still queued:\n${left.map((it) => '  ' + fmt(it)).join('\n')}`);
  }
} catch (e) { fail(e.message); }
