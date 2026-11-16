// DOM test for Liora chat analytics. Loads the real chat script in headless Chrome
// and asserts dataLayer events never include names, emails, phones, or typed text.
//
//   node scripts/test-liora-analytics.mjs
//
// No npm dependencies. Uses node:test and the system Chrome.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = new URL('..', import.meta.url).pathname;
const CHAT_JS = readFileSync(join(ROOT, 'assets/liora-chat.js'), 'utf8');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

const NAME = 'Patricia Q. Testington';
const EMAIL = 'patricia.testington@example.com';
const PHONE = '(415) 555-0199';
const PHONE_DIGITS = '4155550199';
const BAD_EMAIL = 'not-an-email';
const MESSAGE = 'My private note is swordfish and patricia.testington@example.com';
const PII_CHIP = 'Email patricia.testington@example.com about 4155550199';
const NEAR_CHIP = 'Fractional CMO / growth consulting ' + EMAIL;
const CHIP = 'Fractional CMO / growth consulting';
const LIORA_DIGITS = '19144916765';

const ALLOWED_KEYS = new Set([
  'event', 'bot', 'site', 'page_path', 'error_type', 'reason', 'interest',
  'lead_source', 'chip_label', 'message_count', 'link_location'
]);
const PII_KEYS = /name|e-?mail|phone|tel|message|text|content|query|input|value|visitor|token|session|greeting|reply|suggestion/i;
const NEEDLES = [NAME, EMAIL, PHONE, PHONE_DIGITS, BAD_EMAIL, MESSAGE, 'swordfish', PII_CHIP, NEAR_CHIP, 'sess-test-1', '(914) 491-6765', '9144916765', LIORA_DIGITS, '914-491-6765'];

function listen(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function pageHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
<header><a class="hdr-call" href="tel:+19144916765">Header call</a></header>
<nav class="site-nav"><a href="/pricing/">Pricing</a></nav>
<main>
  <section class="liora-sec" id="talk-to-liora">
    <a class="liora-number" href="tel:+19144916765">(914) 491-6765</a>
    <a class="btn" href="tel:+19144916765">Call Liora now</a>
  </section>
  <a id="stray" href="tel:+19144916765">stray</a>
  <a id="other-tel" href="tel:+12125550199">other</a>
</main>
<aside class="liora-bar"><a class="liora-bar-link" href="tel:+19144916765">Talk to Liora</a></aside>
<script>
  sessionStorage.clear();
  window.dataLayer = [{ event: 'gtm.js' }];
  window.LIORA_CHAT_URL = 'https://liora.test/chat';
  window.__ts = {};
  window.turnstile = {
    render: function (el, opts) { window.__ts.opts = opts; return 'widget-1'; },
    reset: function () {}
  };
</script>
<script src="/assets/liora-chat.js"></script>
<script>
  var NAME = ${JSON.stringify(NAME)};
  var EMAIL = ${JSON.stringify(EMAIL)};
  var PHONE = ${JSON.stringify(PHONE)};
  var BAD_EMAIL = ${JSON.stringify(BAD_EMAIL)};
  var MESSAGE = ${JSON.stringify(MESSAGE)};
  var PII_CHIP = ${JSON.stringify(PII_CHIP)};
  var NEAR_CHIP = ${JSON.stringify(NEAR_CHIP)};
  var CHIP = ${JSON.stringify(CHIP)};
  var fetches = [];
  var startMode = 'invalid_fields';
  function json(status, obj) {
    return Promise.resolve({ status: status, json: function () { return Promise.resolve(obj); } });
  }
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (url, init) {
    var u = String(url);
    if (u.indexOf('liora.test') === -1) return nativeFetch(url, init);
    fetches.push({ url: u, body: init && init.body ? String(init.body) : '' });
    if (u.indexOf('/chat/start') !== -1) {
      if (startMode === 'invalid_fields') {
        startMode = 'verification_failed';
        return json(400, { error: 'invalid_fields', fields: { name: NAME + ' is not valid', email: EMAIL, phone: PHONE } });
      }
      if (startMode === 'verification_failed') {
        startMode = 'network';
        return json(403, { error: 'verification_failed' });
      }
      if (startMode === 'network') {
        startMode = 'ok';
        return Promise.reject(new Error('offline ' + EMAIL));
      }
      return json(200, { sessionId: 'sess-test-1', greeting: 'Hi ' + NAME, suggestions: [PII_CHIP, CHIP, 'Growth Audit ($1,000)', 'Agency marketing services (Croes Ave)', 'Something else'] });
    }
    return json(200, { reply: 'Thanks ' + NAME, suggestions: [NEAR_CHIP] });
  };
  navigator.sendBeacon = function (url, body) {
    fetches.push({ url: String(url), body: body ? '[beacon]' : '' });
    return true;
  };
  document.addEventListener('click', function (e) {
    var t = e.target;
    var a = t && t.closest && t.closest('a[href^="tel:"]');
    if (a) e.preventDefault();
  }, true);
  function tick() { return new Promise(function (r) { setTimeout(r, 40); }); }
  function click(sel) {
    var el = document.querySelector(sel);
    if (!el) throw new Error('missing ' + sel);
    el.click();
  }
  function setVal(sel, value) { document.querySelector(sel).value = value; }
  function giveToken() { window.__ts.opts.callback('tok-' + Math.random()); }
  async function run() {
    var out = { events: [], uncaught: [], fatal: '', fetches: 0, sentMessage: false, fieldErrorHasName: false, gtmKept: false, expandedAfterThrow: false, uncaughtAfterThrow: [] };
    var seen = [];
    window.addEventListener('error', function (e) { seen.push(String(e.message || e.error)); });
    window.addEventListener('unhandledrejection', function (e) { seen.push('rejection ' + (e.reason && e.reason.message || e.reason)); });
    try {
      click('.lc-launch');
      await tick();
      click('.lc-x');
      click('.lc-launch');
      await tick();
      click('.lc-start');
      await tick();
      setVal('#lc-name', NAME);
      setVal('#lc-email', BAD_EMAIL);
      setVal('#lc-phone', PHONE);
      click('.lc-start');
      await tick();
      setVal('#lc-email', EMAIL);
      click('.lc-start');
      await tick();
      window.__ts.opts['expired-callback']();
      await tick();
      giveToken();
      click('.lc-start');
      await tick();
      out.fieldErrorHasName = (document.querySelector('#lc-name-err') || {}).textContent.indexOf(NAME) !== -1;
      giveToken();
      click('.lc-start');
      await tick();
      giveToken();
      click('.lc-start');
      await tick();
      click('.lc-start');
      await tick();
      var greeting = document.querySelectorAll('.lc-chip');
      var picked = null;
      greeting.forEach(function (b) { if (b.textContent === CHIP) picked = b; });
      if (!picked) throw new Error('greeting chip missing');
      picked.click();
      await tick();
      await tick();
      var near = null;
      document.querySelectorAll('.lc-chip').forEach(function (b) { if (b.textContent === NEAR_CHIP) near = b; });
      if (!near) throw new Error('follow-up chip missing');
      near.click();
      await tick();
      await tick();
      document.querySelector('#lc-input').value = MESSAGE;
      document.querySelector('.lc-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await tick();
      document.querySelector('.lc-call svg').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      click('.liora-bar-link');
      click('.liora-number');
      click('.liora-sec .btn');
      click('.hdr-call');
      click('#stray');
      click('#other-tel');
      click('.lc-end');
      await tick();
      var endCount = (window.dataLayer || []).filter(function (e) { return e && e.event === 'chat_end'; }).length;
      click('.lc-x');
      var endCountAfterClose = (window.dataLayer || []).filter(function (e) { return e && e.event === 'chat_end'; }).length;
      out.endCount = endCount;
      out.endCountAfterClose = endCountAfterClose;
      out.events = (window.dataLayer || []).filter(function (e) { return e && e.bot === 'liora'; }).map(function (e) { return JSON.parse(JSON.stringify(e)); });
      out.gtmKept = window.dataLayer[0] && window.dataLayer[0].event === 'gtm.js';
      out.fetches = fetches.length;
      out.sentMessage = fetches.some(function (f) { return f.body && f.body.indexOf(MESSAGE) !== -1; });
      var before = seen.length;
      window.dataLayer.push = function () { throw new Error('datalayer-down'); };
      click('.lc-launch');
      out.expandedAfterThrow = document.querySelector('.lc-launch').getAttribute('aria-expanded') === 'true';
      out.uncaughtAfterThrow = seen.slice(before);
    } catch (e) {
      out.fatal = String(e && e.stack || e);
    }
    out.uncaught = seen;
    await fetch('/__result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) });
  }
  run();
</script>
</body></html>`;
}

test('chat source only forwards allowlisted analytics fields', () => {
  assert.match(CHAT_JS, /function track\(event, params\)/);
  assert.match(CHAT_JS, /w\.dataLayer = w\.dataLayer \|\| \[\]/);
  assert.match(CHAT_JS, /w\.dataLayer\.push\(payload\)/);
  assert.match(CHAT_JS, /Fractional CMO \/ growth consulting/);
  assert.doesNotMatch(CHAT_JS, /dataLayer\.push\([^)]*fName|dataLayer\.push\([^)]*fEmail|dataLayer\.push\([^)]*fPhone|dataLayer\.push\([^)]*input\.value/);
  const calls = CHAT_JS.match(/track\('[a-z_]+'/g) || [];
  const names = calls.map((c) => c.slice(7, -1));
  for (const name of ['chat_open', 'chat_form_submit', 'chat_form_error', 'chat_bot_check_fail', 'chat_start', 'generate_lead', 'chat_chip_click', 'chat_message', 'chat_end', 'phone_click']) {
    assert.ok(names.includes(name), 'missing track call for ' + name);
  }
});

test('dataLayer events from the chat UI contain no PII', async () => {
  let result = null;
  const hits = [];
  const server = await listen((req, res) => {
    hits.push(req.method + ' ' + req.url.split('?')[0]);
    if (req.url.startsWith('/__result') && req.method === 'POST') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        res.writeHead(204);
        res.end();
      });
      return;
    }
    if (req.url.startsWith('/assets/liora-chat.js')) {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      res.end(CHAT_JS);
      return;
    }
    if (req.url.startsWith('/assets/liora.css')) {
      res.writeHead(200, { 'Content-Type': 'text/css' });
      res.end('');
      return;
    }
    if (req.url.startsWith('/pricing')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(pageHtml());
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  const { port } = server.address();
  const profile = await mkdtemp(join(tmpdir(), 'liora-analytics-'));
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profile}`,
    '--window-size=1280,900',
    `http://127.0.0.1:${port}/pricing/?email=${encodeURIComponent(EMAIL)}&phone=${PHONE_DIGITS}`
  ], { stdio: 'ignore' });

  let timer;
  const timedOut = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('chrome timed out\n' + hits.join('\n'))), 15000); });
  let wait;
  try {
    await Promise.race([
      new Promise((resolve, reject) => {
        wait = setInterval(() => { if (result) { clearInterval(wait); resolve(); } }, 50);
        chrome.on('exit', (code) => {
          if (!result) reject(new Error('chrome exited ' + code + ' before posting results\n' + hits.join('\n')));
        });
      }),
      timedOut
    ]);
  } finally {
    if (wait) clearInterval(wait);
    clearTimeout(timer);
    chrome.kill('SIGKILL');
    server.close();
    await new Promise((r) => setTimeout(r, 150));
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }

  assert.equal(result.fatal, '', result.fatal);
  assert.equal(result.gtmKept, true);
  assert.equal(result.sentMessage, true, 'the chat should still send the typed message to the server');
  assert.equal(result.fieldErrorHasName, true, 'server field errors should still show in the form');
  assert.equal(result.endCount, 1);
  assert.equal(result.endCountAfterClose, 1, 'closing after End chat must not emit a second chat_end');
  assert.deepEqual(result.uncaughtAfterThrow, []);
  assert.equal(result.expandedAfterThrow, true, 'a throwing dataLayer must not block the panel');
  assert.ok(result.fetches > 0);

  const events = result.events;
  assert.ok(events.length > 0);
  const blob = JSON.stringify(events);
  for (const needle of NEEDLES) {
    assert.equal(blob.includes(needle), false, 'dataLayer contained ' + needle);
  }
  for (const ev of events) {
    for (const key of Object.keys(ev)) {
      assert.equal(ALLOWED_KEYS.has(key), true, 'unexpected key ' + key + ' on ' + ev.event);
      assert.equal(PII_KEYS.test(key) && key !== 'message_count', false, 'pii-like key ' + key);
    }
    assert.equal(ev.bot, 'liora');
    assert.equal(ev.site, 'merricklee.com');
    assert.equal(ev.page_path, '/pricing/');
    if (ev.chip_label) assert.equal(ev.chip_label, CHIP);
    if (ev.message_count != null) assert.equal(typeof ev.message_count, 'number');
  }

  const seq = events.map((e) => e.event + (e.error_type ? ':' + e.error_type : '') + (e.reason ? ':' + e.reason : '') + (e.link_location ? ':' + e.link_location : '') + (e.chip_label ? ':' + e.chip_label : '') + (e.message_count != null ? ':' + e.message_count : '') + (e.interest ? ':' + e.interest : '') + (e.lead_source ? ':' + e.lead_source : ''));
  assert.deepEqual(seq, [
    'chat_open',
    'chat_open',
    'chat_form_submit',
    'chat_form_error:validation',
    'chat_form_submit',
    'chat_form_error:invalid_email',
    'chat_form_submit',
    'chat_form_error:bot_check_required',
    'chat_bot_check_fail:expired',
    'chat_form_submit',
    'chat_form_error:invalid_fields',
    'chat_form_submit',
    'chat_bot_check_fail:verification_failed',
    'chat_form_submit',
    'chat_form_error:network',
    'chat_form_submit',
    'chat_start',
    'generate_lead:unknown:chat',
    'chat_chip_click:' + CHIP,
    'chat_message:1',
    'chat_message:2',
    'chat_message:3',
    'phone_click:chat_panel',
    'phone_click:talk_bar',
    'phone_click:talk_section',
    'phone_click:talk_section',
    'phone_click:header',
    'chat_end'
  ]);

  const lead = events.find((e) => e.event === 'generate_lead');
  assert.equal(lead.lead_source, 'chat');
  assert.equal(lead.interest, 'unknown');
  assert.equal(events.filter((e) => e.event === 'chat_chip_click').length, 1);
  assert.equal(events.filter((e) => e.event === 'generate_lead').length, 1);
  assert.equal(events.filter((e) => e.event === 'phone_click').length, 5);
});
