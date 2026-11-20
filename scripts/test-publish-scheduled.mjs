#!/usr/bin/env node
// Self-test for scripts/publish-scheduled.mjs. Works on throwaway copies of the site in /tmp; never touches the repo.
// Usage: node scripts/test-publish-scheduled.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'scripts', 'publish-scheduled.mjs');
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failed++; };
const tmpdir = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const copy = () => { const d = tmpdir('sched-site-'); fs.cpSync(ROOT, d, { recursive: true, filter: (s) => !/[\\/](\.git|node_modules|scheduled)$/.test(s) }); return d; };
const pub = (root, ...a) => spawnSync(process.execPath, [PUB, `--root=${root}`, ...a], { encoding: 'utf8' });
const hashTree = (root) => { const h = crypto.createHash('sha256'); const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((e) => { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else h.update(path.relative(root, p) + '\0').update(fs.readFileSync(p)); }); walk(root); return h.digest('hex'); };

// Build a fake post with the normal build script in a scratch copy, then move it into the queue of `site`.
function queuePost(site, { slug, date, at, linkTo, edits }) {
  const scratch = copy();
  const draft = path.join(scratch, `${slug}.md`);
  fs.writeFileSync(draft, `---\ntitle: Test post ${slug}\ndate: ${date}\nslug: ${slug}\nmeta_title: Test ${slug}\nmeta_description: Test ${slug}\nexcerpt: Excerpt for ${slug}.\nprimary_keyword: test\nservices: [fractional-cmo, marketing-audit]\n---\n## Section\n\nBody.${linkTo ? ` See [this](/insights/${linkTo}/).` : ''}\n`);
  execFileSync(process.execPath, ['scripts/build-post.mjs', draft, '--no-images'], { cwd: scratch, stdio: 'pipe' });
  const q = path.join(site, 'scheduled', `${date}-${slug}`);
  fs.mkdirSync(path.join(q, 'files', 'insights', slug), { recursive: true });
  fs.copyFileSync(path.join(scratch, 'insights', slug, 'index.html'), path.join(q, 'files', 'insights', slug, 'index.html'));
  fs.mkdirSync(path.join(q, 'files', 'img', 'og'), { recursive: true });
  fs.writeFileSync(path.join(q, 'files', 'img', 'og', `${slug}.jpg`), `fake share image ${slug}`);
  fs.writeFileSync(path.join(q, 'publish.json'), JSON.stringify({ slug, publish_at: at, timezone: 'America/New_York' }, null, 2) + '\n');
  if (edits) fs.writeFileSync(path.join(q, 'edits.patch'), edits);
  fs.rmSync(scratch, { recursive: true, force: true });
  return q;
}
// A one-line edit to an existing live post (like a "body link" patch), as a git-style diff.
function bodyLinkPatch(site, file, slug) {
  const d = tmpdir('sched-diff-');
  fs.mkdirSync(path.join(d, 'a', path.dirname(file)), { recursive: true }); fs.mkdirSync(path.join(d, 'b', path.dirname(file)), { recursive: true });
  const before = fs.readFileSync(path.join(site, file), 'utf8');
  const after = before.replace('</article>', `<p>Related: <a href="/insights/${slug}/">new post</a></p></article>`);
  if (after === before) throw new Error('could not find </article> to edit');
  fs.writeFileSync(path.join(d, 'a', file), before); fs.writeFileSync(path.join(d, 'b', file), after);
  const r = spawnSync('git', ['diff', '--no-index', '--no-prefix', `a/${file}`, `b/${file}`], { cwd: d, encoding: 'utf8' });
  fs.rmSync(d, { recursive: true, force: true });
  return r.stdout; // --no-prefix keeps the a/ and b/ folder names, so paths come out as a/insights/... and b/insights/...
}

const EDIT_TARGET = 'insights/what-is-a-fractional-cmo/index.html';

// ---- 1. due post publishes, future post stays, second run is a no-op ----
{
  const site = copy();
  const patch = bodyLinkPatch(site, EDIT_TARGET, 'test-past-post');
  queuePost(site, { slug: 'test-past-post', date: '2026-11-19', at: '2026-11-19T10:00', edits: patch });
  queuePost(site, { slug: 'test-future-post', date: '2030-01-07', at: '2030-01-07T10:00' });
  const NOW = '--now=2026-11-20T15:45:00Z';
  ok(pub(site, '--check', NOW).status === 0, 'queue validates (--check)');
  const r1 = pub(site, NOW);
  ok(r1.status === 0, 'publish run exits 0');
  ok(fs.existsSync(path.join(site, 'insights/test-past-post/index.html')), 'past-due post is live');
  ok(fs.existsSync(path.join(site, 'img/og/test-past-post.jpg')), 'past-due share image copied');
  ok(!fs.existsSync(path.join(site, 'scheduled/2026-11-19-test-past-post')), 'past-due queue folder removed');
  ok(fs.readFileSync(path.join(site, 'insights/index.html'), 'utf8').includes('/insights/test-past-post/'), 'listing card added');
  ok(/"url":"https:\/\/merricklee\.com\/insights\/test-past-post\/"/.test(fs.readFileSync(path.join(site, 'insights/index.html'), 'utf8')), 'Blog JSON-LD updated');
  ok(fs.readFileSync(path.join(site, 'sitemap.xml'), 'utf8').includes('<loc>https://merricklee.com/insights/test-past-post/</loc><lastmod>2026-11-19</lastmod>'), 'sitemap entry added');
  ok(fs.readFileSync(path.join(site, EDIT_TARGET), 'utf8').includes('href="/insights/test-past-post/"'), 'edits.patch applied (body link)');
  ok(!fs.existsSync(path.join(site, 'insights/test-future-post')), 'future post NOT live');
  ok(fs.existsSync(path.join(site, 'scheduled/2030-01-07-test-future-post/publish.json')), 'future post still queued');
  const all = spawnSync('grep', ['-rl', 'test-future-post', site, '--include=*.html', '--include=*.xml', '--include=*.txt', '--exclude-dir=scheduled'], { encoding: 'utf8' }).stdout.trim().split('\n').filter(Boolean);
  ok(all.length === 0, 'no live page mentions the future post');
  const h1 = hashTree(site);
  const r2 = pub(site, NOW);
  ok(r2.status === 0 && /Nothing due/.test(r2.stdout), 'second run: nothing due');
  ok(hashTree(site) === h1, 'second run changes no files (idempotent)');
  const r3 = pub(site, '--now=2026-11-21T15:45:00Z');
  ok(r3.status === 0 && hashTree(site) === h1, 'next-day run still changes nothing');
  fs.rmSync(site, { recursive: true, force: true });
}

// ---- 2. never early; DST-aware 10 AM New York ----
{
  const site = copy();
  queuePost(site, { slug: 'test-winter', date: '2026-11-25', at: '2026-11-25T10:00' }); // EST: 15:00Z
  queuePost(site, { slug: 'test-summer', date: '2027-06-01', at: '2027-06-01T10:00' }); // EDT: 14:00Z
  pub(site, '--now=2026-11-25T14:59:59Z');
  ok(!fs.existsSync(path.join(site, 'insights/test-winter')), 'Nov 25 post not live at 9:59:59 AM ET (14:59:59Z)');
  pub(site, '--now=2026-11-25T15:00:00Z');
  ok(fs.existsSync(path.join(site, 'insights/test-winter')), 'Nov 25 post live at 10:00 AM ET (15:00Z, EST)');
  pub(site, '--now=2027-06-01T13:59:00Z');
  ok(!fs.existsSync(path.join(site, 'insights/test-summer')), 'Jun 1 post not live at 9:59 AM EDT (13:59Z)');
  pub(site, '--now=2027-06-01T14:00:00Z');
  ok(fs.existsSync(path.join(site, 'insights/test-summer')), 'Jun 1 post live at 10:00 AM EDT (14:00Z)');
  fs.rmSync(site, { recursive: true, force: true });
}

// ---- 3. fails loudly, changes nothing ----
{
  const site = copy();
  queuePost(site, { slug: 'test-wrong-date', date: '2026-11-19', at: '2026-11-23T10:00' });
  const before = hashTree(site);
  const r = pub(site, '--now=2026-11-30T00:00:00Z');
  ok(r.status !== 0 && /dated 2026-11-19 but is scheduled for 2026-11-23/.test(r.stderr), 'post date / schedule mismatch fails');
  ok(hashTree(site) === before, '...and changes nothing');
  fs.rmSync(site, { recursive: true, force: true });
}
{
  const site = copy();
  queuePost(site, { slug: 'test-future-post', date: '2030-01-07', at: '2030-01-07T10:00' });
  const f = path.join(site, EDIT_TARGET);
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('</article>', '<a href="/insights/test-future-post/">x</a></article>'));
  const r = pub(site, '--check', '--now=2026-11-20T15:45:00Z');
  ok(r.status !== 0 && /links to queued \(not yet live\) post/.test(r.stderr), 'a live page linking to a queued post fails --check');
  fs.rmSync(site, { recursive: true, force: true });
}
{
  const site = copy();
  queuePost(site, { slug: 'test-early-link', date: '2026-11-19', at: '2026-11-19T10:00', linkTo: 'test-later' });
  queuePost(site, { slug: 'test-later', date: '2026-12-02', at: '2026-12-02T10:00' });
  const r = pub(site, '--now=2026-11-20T15:45:00Z');
  ok(r.status !== 0 && /test-early-link\/index\.html links to queued/.test(r.stderr), 'a due post that links to a later queued post fails');
  ok(pub(site, '--check', '--now=2026-11-20T15:45:00Z').status !== 0, '...and --check catches it ahead of time');
  fs.rmSync(site, { recursive: true, force: true });
}
{
  const site = copy();
  const patch = bodyLinkPatch(site, EDIT_TARGET, 'test-stale');
  queuePost(site, { slug: 'test-stale', date: '2026-11-19', at: '2026-11-19T10:00', edits: patch });
  const f = path.join(site, EDIT_TARGET);
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('</article>', '<p>changed meanwhile</p></article>'));
  const before = hashTree(site);
  const r = pub(site, '--now=2026-11-20T15:45:00Z');
  ok(r.status !== 0 && /edits\.patch no longer applies/.test(r.stderr), 'stale edits.patch fails');
  ok(hashTree(site) === before, '...before writing anything');
  fs.rmSync(site, { recursive: true, force: true });
}
{
  const site = copy();
  queuePost(site, { slug: 'what-is-a-fractional-cmo', date: '2026-11-11', at: '2026-11-11T10:00' });
  const r = pub(site, '--now=2026-11-20T15:45:00Z');
  ok(r.status === 0 && /already live/.test(r.stdout) && !fs.existsSync(path.join(site, 'scheduled/2026-11-11-what-is-a-fractional-cmo')), 'item for an already-live post is only cleaned up, not overwritten');
  fs.rmSync(site, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} test(s) FAILED` : '\nAll tests passed.');
process.exit(failed ? 1 : 0);
