/* Liora chat panel — floating bubble (bottom-right) that opens a typed chat with Liora, Merrick's AI assistant,
   plus a tap-to-call button. Talks to the shared Liora/Ava server (POST /chat/start, /chat, /chat/end).
   Visitors must fill in name, email and phone and pass a Cloudflare Turnstile check before chatting.
   Endpoint: window.LIORA_CHAT_URL, or <meta name="liora-chat-url" content="...">, or DEFAULT_URL below.
   If the endpoint is empty or unreachable, the panel falls back to the phone number and email. */
(function () {
  'use strict';
  var d = document, w = window;
  if (d.getElementById('lc-root')) return;

  // ---- config ----
  // Shared Liora/Ava server on Render. This file is still on the draft PR and is not live until merged.
  var DEFAULT_URL = 'https://liora-ava-voice-363n.onrender.com/chat';
  var TURNSTILE_SITEKEY = '0x4AAAAAAGClv7TpPcBxxfe9'; // Cloudflare Turnstile (managed) widget for merricklee.com + croesave.com + localhost
  var NAME = 'Liora', SUB = 'Merrick\'s AI assistant';
  var TEL = 'tel:+19144916765', PHONE = '(914) 491-6765', EMAIL = 'liora@merricklee.com'; // TEL '' hides the call button
  var AV = '/img/opt/liora-ai-assistant-headset-200.webp', INITIAL = 'L'; // AV '' uses a lettered avatar
  var CSS = '/assets/liora.css', KP = 'liora-chat';
  var meta = d.querySelector('meta[name="liora-chat-url"]');
  var API = (typeof w.LIORA_CHAT_URL === 'string' ? w.LIORA_CHAT_URL : (meta ? meta.content : DEFAULT_URL)) || '';
  var BASE = API.replace(/\/chat\/?$/, '');
  var START = API ? BASE + '/chat/start' : '', END = API ? BASE + '/chat/end' : '';
  var MAX = 1000, K_SID = KP + '-sid', K_LOG = KP + '-log', K_OPEN = KP + '-open';
  var INTRO = "Hi, I\'m Liora, Merrick\'s AI assistant. Before we chat, please share your name, email, and phone so Merrick can follow up.";

  function store(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} }
  function load(k, json) { try { var v = sessionStorage.getItem(k); return json ? (v ? JSON.parse(v) : null) : v; } catch (e) { return null; } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  if (!d.querySelector('link[href="' + CSS + '"]')) {
    var l = d.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; d.head.appendChild(l);
  }
  function avatar(cls) {
    return AV ? '<img class="' + cls + '" src="' + AV + '" width="200" height="200" alt="">'
              : '<span class="' + cls + ' lc-initial" aria-hidden="true">' + esc(INITIAL) + '</span>';
  }
  var callIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';
  var reach = (TEL ? 'Call ' + NAME + ' at <a href="' + TEL + '">' + PHONE + '</a> or email ' : 'Email ') + '<a href="mailto:' + EMAIL + '">' + EMAIL + '</a>.';

  var root = d.createElement('div');
  root.id = 'lc-root';
  root.className = 'lc-root';
  root.innerHTML =
    '<button type="button" class="lc-launch" aria-expanded="false" aria-controls="lc-panel">' + avatar('lc-launch-av') +
      '<span class="lc-launch-text">Chat with ' + NAME + '</span></button>' +
    '<div id="lc-panel" class="lc-panel" role="dialog" aria-modal="false" aria-labelledby="lc-title" aria-describedby="lc-disclose" hidden>' +
      '<div class="lc-hd">' + avatar('lc-av') +
        '<div class="lc-who"><div id="lc-title" class="lc-title">' + NAME + '</div><div class="lc-sub">' + SUB + '</div></div>' +
        (TEL ? '<a class="lc-call" href="' + TEL + '" aria-label="Call ' + NAME + ' at ' + PHONE + '">' + callIcon + '<span>Call ' + NAME + '</span></a>' : '') +
        '<button type="button" class="lc-x" aria-label="Close chat">&times;</button>' +
      '</div>' +
      // Pre-chat form: name, email, phone + human check. Required before chatting.
      '<form class="lc-pre" novalidate aria-labelledby="lc-pre-title">' +
        '<p id="lc-pre-title" class="lc-pre-intro">' + INTRO + '</p>' +
        '<div class="lc-field"><label for="lc-name">Name</label><input id="lc-name" name="name" type="text" autocomplete="name" maxlength="80" required aria-describedby="lc-name-err"><p id="lc-name-err" class="lc-err" aria-live="polite"></p></div>' +
        '<div class="lc-field"><label for="lc-email">Email</label><input id="lc-email" name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" required aria-describedby="lc-email-err"><p id="lc-email-err" class="lc-err" aria-live="polite"></p></div>' +
        '<div class="lc-field"><label for="lc-phone">Phone</label><input id="lc-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="20" placeholder="(555) 555-5555" required aria-describedby="lc-phone-err"><p id="lc-phone-err" class="lc-err" aria-live="polite"></p></div>' +
        // Honeypot: hidden from people and screen readers; bots tend to fill it.
        '<div class="lc-hp" aria-hidden="true"><label for="lc-website">Website</label><input id="lc-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>' +
        '<div class="lc-ts" aria-label="Human check"></div>' +
        '<p class="lc-pre-err lc-err" role="alert"></p>' +
        '<button type="submit" class="lc-start">Start chat</button>' +
        '<p class="lc-privacy">We use your details only to reply to you. No spam, and we never sell your information. Protected by Cloudflare Turnstile.</p>' +
      '</form>' +
      '<div class="lc-log" role="log" aria-live="polite" aria-relevant="additions text" tabindex="0" aria-label="Conversation with ' + NAME + '" hidden></div>' +
      '<p class="lc-typing" hidden><span class="lc-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>' + NAME + ' is typing…</span></p>' +
      '<div class="lc-fallback" role="status" hidden>Chat isn\'t available right now. ' + reach + '</div>' +
      '<form class="lc-form" novalidate hidden>' +
        '<label class="lc-sr" for="lc-input">Message ' + NAME + '</label>' +
        '<textarea id="lc-input" class="lc-input" rows="1" maxlength="' + MAX + '" placeholder="Type your message…" autocomplete="off"></textarea>' +
        '<button type="submit" class="lc-send" aria-label="Send message">' +
          '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>' +
        '</button>' +
      '</form>' +
      '<div class="lc-ft"><p id="lc-disclose" class="lc-disclose">You\'re chatting with an AI. Merrick sees what you share so he can follow up.</p>' +
        '<button type="button" class="lc-end" hidden>End chat</button></div>' +
    '</div>';
  d.body.appendChild(root);

  function q(s) { return root.querySelector(s); }
  var launch = q('.lc-launch'), panel = q('.lc-panel'), logEl = q('.lc-log'), typing = q('.lc-typing'),
      fallback = q('.lc-fallback'), form = q('.lc-form'), input = q('.lc-input'), send = q('.lc-send'),
      closeBtn = q('.lc-x'), endBtn = q('.lc-end'), pre = q('.lc-pre'), preErr = q('.lc-pre-err'),
      startBtn = q('.lc-start'), tsBox = q('.lc-ts');
  var fName = q('#lc-name'), fEmail = q('#lc-email'), fPhone = q('#lc-phone'), fHp = q('#lc-website');

  var sid = load(K_SID), history = load(K_LOG, true) || [], busy = false;
  var formShownAt = 0, tsWidget = null, tsToken = '', tsLoading = false, tsWatch = null;

  // ---- validation (the server re-checks all of this) ----
  function usPhone(v) {
    v = String(v || '').trim();
    if (!v || /[^\d\s().+-]/.test(v)) return null;
    var dg = v.replace(/\D/g, '');
    if (dg.length === 11 && dg.charAt(0) === '1') dg = dg.slice(1);
    if (dg.length !== 10 || !/^[2-9]\d{2}[2-9]\d{6}$/.test(dg)) return null;
    return '+1' + dg;
  }
  function validEmail(v) { v = String(v || '').trim(); return v.length <= 254 && /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/.test(v) && v.indexOf('..') < 0; }
  function validName(v) { v = String(v || '').trim(); return v.length > 0 && v.length <= 80 && /[A-Za-z\u00C0-\u024F]/.test(v) && !/https?:|www\.|@/i.test(v); }
  function fieldErr(input, msg) {
    var p = q('#' + input.id + '-err'); p.textContent = msg || '';
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }

  // ---- Turnstile ----
  function loadTurnstile(cb) {
    if (w.turnstile) return cb();
    if (tsLoading) { var t = setInterval(function () { if (w.turnstile) { clearInterval(t); cb(); } }, 150); return; }
    tsLoading = true;
    var s = d.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.defer = true;
    s.onload = function () { cb(); };
    s.onerror = function () { preErr.textContent = 'The human check could not load. ' + reach.replace(/<[^>]+>/g, ''); };
    d.head.appendChild(s);
  }
  function renderTurnstile() {
    if (!TURNSTILE_SITEKEY) return;
    loadTurnstile(function () {
      if (tsWidget !== null || !w.turnstile) return;
      tsWidget = w.turnstile.render(tsBox, {
        sitekey: TURNSTILE_SITEKEY, theme: 'light', size: 'flexible', action: 'chat_start',
        callback: function (t) {
          tsToken = t;
          preErr.textContent = '';
          if (tsWatch) { clearTimeout(tsWatch); tsWatch = null; }
        },
        'expired-callback': function () { tsToken = ''; resetTurnstile(); },
        'timeout-callback': function () { tsToken = ''; resetTurnstile(); },
        'error-callback': function () {
          tsToken = '';
          preErr.textContent = 'The human check had a problem. Try opening this page in Safari, or tap Start chat to retry.';
          resetTurnstile();
        }
      });
      if (tsWatch) { clearTimeout(tsWatch); tsWatch = null; }
      tsWatch = setTimeout(function () {
        tsWatch = null;
        if (!tsToken) {
          preErr.textContent = 'The human check is taking too long. Try opening this page in Safari.';
        }
      }, 12000);
    });
  }
  function resetTurnstile() { tsToken = ''; try { if (w.turnstile && tsWidget !== null) w.turnstile.reset(tsWidget); } catch (e) {} }

  // ---- chat log ----
  function bubble(role, text, persist) {
    var p = d.createElement('p');
    p.className = 'lc-msg ' + (role === 'user' ? 'lc-me' : role === 'note' ? 'lc-note' : 'lc-bot');
    var who = d.createElement('span'); who.className = 'lc-sr';
    who.textContent = role === 'user' ? 'You: ' : role === 'note' ? '' : NAME + ': ';
    p.appendChild(who);
    p.appendChild(d.createTextNode(text));
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
    if (persist) { history.push({ r: role, t: text }); if (history.length > 60) history = history.slice(-60); store(K_LOG, history); }
  }
  function render() {
    logEl.textContent = '';
    history.forEach(function (m, i) {
      bubble(m.r, m.t, false);
      if (m.r === 'bot' && m.s && m.s.length && i === history.length - 1) showChips(m.s);
    });
  }
  function showFallback(on) { fallback.hidden = !on; }
  function setBusy(on) {
    busy = on; typing.hidden = !on; send.disabled = on;
    logEl.setAttribute('aria-busy', on ? 'true' : 'false');
    logEl.querySelectorAll('.lc-chip').forEach(function (b) { b.disabled = on; });
  }
  function grow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; }

  function clearChips() { var el = q('.lc-chips'); if (el) el.remove(); }
  function showChips(labels) {
    clearChips();
    if (!labels || !labels.length) return;
    var wrap = d.createElement('div');
    wrap.className = 'lc-chips';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Suggested replies');
    labels.forEach(function (label) {
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'lc-chip';
      b.textContent = String(label);
      b.addEventListener('click', function () { sendMsg(String(label)); });
      wrap.appendChild(b);
    });
    logEl.appendChild(wrap);
    logEl.scrollTop = logEl.scrollHeight;
  }
  function storeSuggestions(labels) {
    if (!labels || !labels.length || !history.length) return;
    var last = history[history.length - 1];
    if (last.r !== 'bot') return;
    last.s = labels;
    store(K_LOG, history);
    showChips(labels);
  }

  function showMode() {
    var chatting = Boolean(sid);
    pre.hidden = chatting; logEl.hidden = !chatting; form.hidden = !chatting; endBtn.hidden = !chatting;
    if (chatting) { render(); } else { formShownAt = Date.now(); renderTurnstile(); }
  }

  function open(focus) {
    panel.hidden = false;
    launch.setAttribute('aria-expanded', 'true');
    root.classList.add('is-open');
    store(K_OPEN, '1');
    showMode();
    if (!API) showFallback(true);
    if (focus !== false) setTimeout(function () { (sid ? input : fName).focus(); }, 30);
  }
  function close() {
    panel.hidden = true;
    launch.setAttribute('aria-expanded', 'false');
    root.classList.remove('is-open');
    store(K_OPEN, null);
    launch.focus();
  }
  function resetToForm(note) {
    sid = null; history = [];
    store(K_SID, null); store(K_LOG, null);
    resetTurnstile();
    showMode();
    if (note) preErr.textContent = note;
  }

  function startChat(e) {
    e.preventDefault();
    if (busy) return;
    preErr.textContent = '';
    var name = fName.value.trim(), email = fEmail.value.trim(), phone = usPhone(fPhone.value), ok = true;
    fieldErr(fName, validName(name) ? '' : 'Please enter your name.'); ok = ok && validName(name);
    fieldErr(fEmail, validEmail(email) ? '' : 'Please enter a valid email address.'); ok = ok && validEmail(email);
    fieldErr(fPhone, phone ? '' : 'Please enter a valid US phone number.'); ok = ok && Boolean(phone);
    if (!ok) { var bad = root.querySelector('[aria-invalid="true"]'); if (bad) bad.focus(); return; }
    if (!START) { showFallback(true); return; }
    if (TURNSTILE_SITEKEY && !tsToken) { preErr.textContent = 'Please complete the human check above.'; return; }
    busy = true; startBtn.disabled = true; startBtn.textContent = 'Starting…';
    fetch(START, {
      method: 'POST', mode: 'cors', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, email: email, phone: phone, turnstileToken: tsToken, hp: fHp.value, fillMs: Date.now() - formShownAt, page: location.pathname })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; });
    }).then(function (res) {
      var j = res.j || {};
      if (res.status === 200 && j.sessionId) {
        sid = j.sessionId; store(K_SID, sid);
        history = []; if (j.greeting) history.push({ r: 'bot', t: j.greeting, s: Array.isArray(j.suggestions) ? j.suggestions : undefined }); store(K_LOG, history);
        showFallback(false); showMode(); input.focus(); return;
      }
      resetTurnstile();
      if (j.error === 'invalid_fields' && j.fields) {
        if (j.fields.name) fieldErr(fName, j.fields.name);
        if (j.fields.email) fieldErr(fEmail, j.fields.email);
        if (j.fields.phone) fieldErr(fPhone, j.fields.phone);
        return;
      }
      if (j.error === 'verification_failed') { preErr.textContent = "We couldn't confirm you're human. Please try the check again."; return; }
      if (j.error === 'too_fast') { formShownAt = Date.now() - 1000; preErr.textContent = 'Please try again in a moment.'; return; }
      if (res.status === 429) { preErr.textContent = 'Too many chats from this connection. Please try again later.'; return; }
      showFallback(true);
    }).catch(function () { showFallback(true); })
      .then(function () { busy = false; startBtn.disabled = false; startBtn.textContent = 'Start chat'; });
  }

  function endChat() {
    if (sid && END) {
      var body = JSON.stringify({ sessionId: sid });
      try {
        if (!(navigator.sendBeacon && navigator.sendBeacon(END, new Blob([body], { type: 'text/plain' }))))
          fetch(END, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body, keepalive: true, mode: 'cors' }).catch(function () {});
      } catch (e) {}
    }
    showFallback(false);
    resetToForm('Chat ended. Thanks for stopping by!');
  }

  function sendMsg(text) {
    if (busy || !sid) return;
    text = text.replace(/\s+$/, '');
    if (!text.trim()) return;
    if (text.length > MAX) text = text.slice(0, MAX);
    clearChips();
    bubble('user', text, true);
    input.value = ''; grow();
    if (!API) { showFallback(true); return; }
    setBusy(true);
    var ctrl = w.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
    fetch(API, {
      method: 'POST', mode: 'cors', credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid, message: text, page: location.pathname }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; });
    }).then(function (res) {
      var j = res.j || {};
      if (res.status === 200 && j.reply) { showFallback(false); bubble('bot', j.reply, true); if (Array.isArray(j.suggestions) && j.suggestions.length) storeSuggestions(j.suggestions); return; }
      if (res.status === 401) { resetToForm('Your chat timed out. Please fill in the form to start a new one.'); return; }
      if (res.status === 429) { bubble('note', "You're sending messages quickly. Give it a minute" + (TEL ? ', or call ' + NAME + ' at ' + PHONE : '') + '.', false); return; }
      if (res.status === 413) { bubble('note', 'That message is a bit long. Could you shorten it?', false); return; }
      showFallback(true);
    }).catch(function () {
      showFallback(true);
    }).then(function () { clearTimeout(timer); setBusy(false); });
  }

  launch.addEventListener('click', function () { if (panel.hidden) open(); else close(); });
  closeBtn.addEventListener('click', close);
  endBtn.addEventListener('click', endChat);
  pre.addEventListener('submit', startChat);
  [fName, fEmail, fPhone].forEach(function (f) { f.addEventListener('input', function () { fieldErr(f, ''); }); });
  form.addEventListener('submit', function (e) { e.preventDefault(); sendMsg(input.value); });
  input.addEventListener('input', grow);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMsg(input.value); }
  });
  root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); close(); } });

  // Re-open across pages within the same visit if it was open.
  if (load(K_OPEN) === '1') open(false);
})();
