/* Liora chat panel — floating bubble (bottom-right) that opens a typed chat with Liora,
   Merrick's AI assistant, plus a tap-to-call button. Talks to the liora-voice server (POST /chat).
   Endpoint: window.LIORA_CHAT_URL, or <meta name="liora-chat-url" content="...">, or DEFAULT_URL below.
   If the endpoint is empty or unreachable, the panel falls back to the phone number and email. */
(function () {
  'use strict';
  var d = document, w = window;
  if (d.getElementById('lc-root')) return;

  // TEMPORARY for the draft PR: Merrick's Mac via a Cloudflare quick tunnel (changes on restart).
  // Replace with the permanent Liora server URL before this goes live.
  var DEFAULT_URL = 'https://arkansas-tray-rep-instructor.trycloudflare.com/chat';
  var meta = d.querySelector('meta[name="liora-chat-url"]');
  var API = (typeof w.LIORA_CHAT_URL === 'string' ? w.LIORA_CHAT_URL : (meta ? meta.content : DEFAULT_URL)) || '';
  var END = API ? API.replace(/\/chat\/?$/, '/chat/end') : '';
  var TEL = 'tel:+19144916765', PHONE = '(914) 491-6765', EMAIL = 'liora@merricklee.com';
  var AV = '/img/opt/liora-ai-assistant-headset-200.webp';
  var MAX = 1000, K_SID = 'liora-chat-sid', K_LOG = 'liora-chat-log', K_OPEN = 'liora-chat-open';
  var GREETING = "Hi, I'm Liora, Merrick's AI assistant. Ask me about his services and pricing, or his agency, Croes Ave, or leave a message for Merrick. You can also call me anytime.";

  function store(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} }
  function load(k, json) { try { var v = sessionStorage.getItem(k); return json ? (v ? JSON.parse(v) : null) : v; } catch (e) { return null; } }

  if (!d.querySelector('link[href="/assets/liora.css"]')) {
    var l = d.createElement('link'); l.rel = 'stylesheet'; l.href = '/assets/liora.css'; d.head.appendChild(l);
  }

  var root = d.createElement('div');
  root.id = 'lc-root';
  root.className = 'lc-root';
  root.innerHTML =
    '<button type="button" class="lc-launch" aria-expanded="false" aria-controls="lc-panel">' +
      '<img src="' + AV + '" width="200" height="200" alt="">' +
      '<span class="lc-launch-text">Chat with Liora</span>' +
    '</button>' +
    '<div id="lc-panel" class="lc-panel" role="dialog" aria-modal="false" aria-labelledby="lc-title" aria-describedby="lc-disclose" hidden>' +
      '<div class="lc-hd">' +
        '<img class="lc-av" src="' + AV + '" width="200" height="200" alt="">' +
        '<div class="lc-who"><div id="lc-title" class="lc-title">Liora</div><div class="lc-sub">Merrick\'s AI assistant</div></div>' +
        '<a class="lc-call" href="' + TEL + '" aria-label="Call Liora at ' + PHONE + '">' +
          '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>' +
          '<span>Call Liora</span></a>' +
        '<button type="button" class="lc-x" aria-label="Close chat">&times;</button>' +
      '</div>' +
      '<div class="lc-log" role="log" aria-live="polite" aria-relevant="additions text" tabindex="0" aria-label="Conversation with Liora"></div>' +
      '<p class="lc-typing" hidden><span class="lc-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Liora is typing…</span></p>' +
      '<div class="lc-fallback" role="status" hidden>Chat isn\'t available right now. Call Liora at <a href="' + TEL + '">' + PHONE + '</a> or email <a href="mailto:' + EMAIL + '">' + EMAIL + '</a>.</div>' +
      '<form class="lc-form" novalidate>' +
        '<label class="lc-sr" for="lc-input">Message Liora</label>' +
        '<textarea id="lc-input" class="lc-input" rows="1" maxlength="' + MAX + '" placeholder="Type your message…" autocomplete="off"></textarea>' +
        '<button type="submit" class="lc-send" aria-label="Send message">' +
          '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>' +
        '</button>' +
      '</form>' +
      '<div class="lc-ft"><p id="lc-disclose" class="lc-disclose">You\'re chatting with an AI. Merrick sees what you share so he can follow up.</p>' +
        '<button type="button" class="lc-end">End chat</button></div>' +
    '</div>';
  d.body.appendChild(root);

  var launch = root.querySelector('.lc-launch'), panel = root.querySelector('.lc-panel'),
      logEl = root.querySelector('.lc-log'), typing = root.querySelector('.lc-typing'),
      fallback = root.querySelector('.lc-fallback'), form = root.querySelector('.lc-form'),
      input = root.querySelector('.lc-input'), send = root.querySelector('.lc-send'),
      closeBtn = root.querySelector('.lc-x'), endBtn = root.querySelector('.lc-end');

  var sid = load(K_SID), history = load(K_LOG, true) || [], busy = false;

  function bubble(role, text, persist) {
    var p = d.createElement('p');
    p.className = 'lc-msg ' + (role === 'user' ? 'lc-me' : role === 'note' ? 'lc-note' : 'lc-bot');
    var who = d.createElement('span'); who.className = 'lc-sr';
    who.textContent = role === 'user' ? 'You: ' : role === 'note' ? '' : 'Liora: ';
    p.appendChild(who);
    p.appendChild(d.createTextNode(text));
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
    if (persist) { history.push({ r: role, t: text }); if (history.length > 60) history = history.slice(-60); store(K_LOG, history); }
  }
  function render() {
    logEl.textContent = '';
    bubble('bot', GREETING, false);
    history.forEach(function (m) { bubble(m.r, m.t, false); });
  }
  function showFallback(on) { fallback.hidden = !on; }
  function setBusy(on) { busy = on; typing.hidden = !on; send.disabled = on; logEl.setAttribute('aria-busy', on ? 'true' : 'false'); }
  function grow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; }

  function open(focus) {
    panel.hidden = false;
    launch.setAttribute('aria-expanded', 'true');
    root.classList.add('is-open');
    store(K_OPEN, '1');
    if (!logEl.childNodes.length) render();
    if (!API) showFallback(true);
    logEl.scrollTop = logEl.scrollHeight;
    if (focus !== false) setTimeout(function () { input.focus(); }, 30);
  }
  function close() {
    panel.hidden = true;
    launch.setAttribute('aria-expanded', 'false');
    root.classList.remove('is-open');
    store(K_OPEN, null);
    launch.focus();
  }

  function endChat() {
    if (sid && END) {
      var body = JSON.stringify({ sessionId: sid });
      try {
        if (!(navigator.sendBeacon && navigator.sendBeacon(END, new Blob([body], { type: 'text/plain' }))))
          fetch(END, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body, keepalive: true, mode: 'cors' }).catch(function () {});
      } catch (e) {}
    }
    sid = null; history = [];
    store(K_SID, null); store(K_LOG, null);
    showFallback(false);
    render();
    bubble('note', 'Chat ended. Thanks for stopping by! Start a new message anytime.', false);
    input.focus();
  }

  function sendMsg(text) {
    if (busy) return;
    text = text.replace(/\s+$/, '');
    if (!text.trim()) return;
    if (text.length > MAX) text = text.slice(0, MAX);
    bubble('user', text, true);
    input.value = ''; grow();
    if (!API) { showFallback(true); return; }
    setBusy(true);
    var ctrl = w.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
    fetch(API, {
      method: 'POST', mode: 'cors', credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid || undefined, message: text, page: location.pathname }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; });
    }).then(function (res) {
      var j = res.j || {};
      if (j.sessionId) { sid = j.sessionId; store(K_SID, sid); }
      if (res.status === 200 && j.reply) { showFallback(false); bubble('bot', j.reply, true); return; }
      if (res.status === 429) { bubble('note', "You're sending messages quickly. Give it a minute, or call Liora at " + PHONE + '.', false); return; }
      if (res.status === 413) { bubble('note', 'That message is a bit long. Could you shorten it?', false); return; }
      showFallback(true);
    }).catch(function () {
      showFallback(true);
    }).then(function () { clearTimeout(timer); setBusy(false); });
  }

  launch.addEventListener('click', function () { if (panel.hidden) open(); else close(); });
  closeBtn.addEventListener('click', close);
  endBtn.addEventListener('click', endChat);
  form.addEventListener('submit', function (e) { e.preventDefault(); sendMsg(input.value); });
  input.addEventListener('input', grow);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMsg(input.value); }
  });
  root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); close(); } });

  // Re-open across pages within the same visit if it was open.
  if (load(K_OPEN) === '1') open(false);
})();
