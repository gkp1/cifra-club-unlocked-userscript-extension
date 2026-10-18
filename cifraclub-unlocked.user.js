// ==UserScript==
// @name         Cifra Club Unlocked
// @name:pt-BR   Cifra Club Desbloqueado
// @namespace    https://github.com/gkp1
// @version      2.0.0
// @description  Whole song (chords + lyrics) on one screen with auto-sized columns, split columns and the page-turner pedal without the ad popup, and a light/dark switch.
// @description:pt-BR Cifra inteira (acordes + letra) numa tela só, em colunas com fonte automática, dividir em colunas e pedal passador sem anúncio, e botão de tema claro/escuro.
// @author       gkp1
// @homepageURL  https://github.com/gkp1/cifra-club-unlocked-userscript-extension
// @supportURL   https://github.com/gkp1/cifra-club-unlocked-userscript-extension/issues
// @downloadURL  https://raw.githubusercontent.com/gkp1/cifra-club-unlocked-userscript-extension/main/cifraclub-unlocked.user.js
// @updateURL    https://raw.githubusercontent.com/gkp1/cifra-club-unlocked-userscript-extension/main/cifraclub-unlocked.user.js
// @license      MIT
// @match        https://www.cifraclub.com.br/*
// @match        https://www.cifraclub.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ===== Config =====
  const KEY_VIEW = 'l';        // toggles the one-screen view
  const KEY_BROWSER_FS = 'f';  // browser fullscreen (inside the view)
  const KEY_THEME = 'd';       // light/dark theme (site and view)
  const START_ON = false;      // open songs in the one-screen view? (then remembers your last choice)
  const UNLOCK = true;         // unlock "Dividir em colunas" and "Pedal passador" without the ad
  // ==================

  const ID = 'ccfit';
  const STORE = 'ccfit-on';
  let enabled = readPref();
  let manualScale = 1;
  let overlay, cols, titleEl, lockStyle, dock, toggleBtn, themeBtns, banner, srcPre, observer, raf;
  let lastHtml = '';
  let shownDark = null;

  const log = (...a) => console.log('%c[ccfit]', 'color:#ff8a3d;font-weight:bold', ...a);
  log('userscript loaded', location.href);

  function readPref() {
    try { const v = localStorage.getItem(STORE); return v === null ? START_ON : v === '1'; }
    catch (e) { return START_ON; }
  }
  function savePref(on) { try { localStorage.setItem(STORE, on ? '1' : '0'); } catch (e) {} }

  const DAY = 864e5;

  function getCookie(name) {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }
  function setCookie(name, value, expires) {
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${new Date(expires).toUTCString()};path=/`;
  }

  // ---------- Unlock ----------
  // After you watch the ad, the site saves a 24h pass in a cookie. We write that same
  // cookie ourselves, so the ad popup never shows. Nothing is sent anywhere.
  const COLUMNS_PASS = 'cifraclub:fullscreen-rewarded-unlock';
  const PEDAL_PASS = '_ccpt';

  // Same hash (cyrb53) the site uses to sign the pedal pass.
  function hash(s) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x9e3779b1);
      h2 = Math.imul(h2 ^ c, 0x5f356495);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 0x85ebca6b) ^ Math.imul(h2 ^ (h2 >>> 13), 0xc2b2ae35);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 0x85ebca6b) ^ Math.imul(h1 ^ (h1 >>> 13), 0xc2b2ae35);
    return (0x100000000 * (0x1fffff & h2) + (h1 >>> 0)).toString(36);
  }

  function unlock() {
    if (getCookie(COLUMNS_PASS) !== 'true') {
      setCookie(COLUMNS_PASS, 'true', Date.now() + DAY);
      log('split columns unlocked');
    }
    // The pedal pass is tied to your login, so it only applies when you're signed in.
    const jwt = getCookie('jwt');
    if (!jwt) return;
    const [t, sig] = (getCookie(PEDAL_PASS) || '').split('.');
    const exp = parseInt(t, 36);
    if (sig && exp > Date.now() && sig === hash(`${jwt}:${exp}:pt`)) return;
    const next = Date.now() + DAY;
    setCookie(PEDAL_PASS, `${next.toString(36)}.${hash(`${jwt}:${next}:pt`)}`, next);
    log('page-turner pedal unlocked');
  }

  if (UNLOCK) unlock();

  // ---------- UI text (follows your browser language) ----------
  const L = /^pt\b/i.test(navigator.language || '') ? {
    exit: 'sair', fullscreen: 'tela cheia', size: 'tamanho', theme: 'tema',
    smaller: 'Menor', auto: 'Ajuste automático', bigger: 'Maior', back: 'Voltar ao site',
    toDark: 'Tema escuro', toLight: 'Tema claro',
    open: 'Tela cheia', press: 'Aperte', banner: 'para ver a cifra inteira em tela cheia',
  } : {
    exit: 'exit', fullscreen: 'fullscreen', size: 'size', theme: 'theme',
    smaller: 'Smaller', auto: 'Auto fit', bigger: 'Bigger', back: 'Back to the site',
    toDark: 'Dark theme', toLight: 'Light theme',
    open: 'Full screen', press: 'Press', banner: 'to see the whole song on one screen',
  };

  const K = KEY_VIEW.toUpperCase();
  const KF = KEY_BROWSER_FS.toUpperCase();
  const KT = KEY_THEME.toUpperCase();

  const ICON = {
    moon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  };

  // All CSS lives inside our own elements, so React/Next hydration can't wipe it.
  // Colors follow the site's theme (data-theme on <html>), falling back to the system.
  const SCOPE = `#${ID}, #${ID}-banner, #${ID}-dock`;
  const DARK = `
    --bg: #14161a; --panel: rgba(30,33,39,.8); --fg: #e9e6e1; --soft: #9a958d;
    --chord: #ff9a4d; --chord-bg: rgba(255,154,77,.10); --line: rgba(255,255,255,.08);
    --sec: #b197fc; --sec-bg: rgba(177,151,252,.12);`;
  const darkScope = (pre) => SCOPE.split(', ').map((s) => `${pre} ${s}`).join(', ');
  const CSS = `
    ${SCOPE} {
      --bg: #f7f5f2; --panel: rgba(255,255,255,.75); --fg: #1d1b19; --soft: #5b5650;
      --chord: #e8590c; --chord-bg: rgba(232,89,12,.08); --line: rgba(0,0,0,.08);
      --sec: #6741d9; --sec-bg: rgba(103,65,217,.09);
      --mono: "JetBrains Mono", "Roboto Mono", ui-monospace, Menlo, Consolas, monospace;
      --sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    ${darkScope('html[data-theme="dark"]')} {${DARK} }
    @media (prefers-color-scheme: dark) {
      ${darkScope('html:not([data-theme])')} {${DARK} }
    }

    /* ---------- view mode ---------- */
    #${ID} {
      position: fixed; inset: 0; z-index: 2147483647;
      background: var(--bg); color: var(--fg);
      display: flex; flex-direction: column;
      font-family: var(--sans);
      -webkit-font-smoothing: antialiased;
    }
    #${ID} .bar {
      flex: 0 0 auto; display: flex; align-items: center; gap: 14px;
      padding: 8px 18px; background: var(--panel);
      backdrop-filter: blur(8px); border-bottom: 1px solid var(--line);
      font-size: 13px; color: var(--soft);
    }
    #${ID} .t { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #${ID} .t b { color: var(--fg); font-weight: 700; font-size: 15px; letter-spacing: -.01em; }
    #${ID} .t span { margin-left: 8px; }
    #${ID} .hints { display: flex; gap: 12px; white-space: nowrap; }
    #${ID} .hints span { display: inline-flex; align-items: center; gap: 5px; }
    #${ID} kbd, #${ID}-banner kbd {
      font-family: var(--sans); font-weight: 700; font-size: 11px; color: var(--fg);
      padding: 2px 7px; border-radius: 5px; border: 1px solid var(--line);
      background: var(--bg); box-shadow: 0 1px 0 var(--line);
    }
    #${ID} .btns { display: flex; gap: 4px; }
    #${ID} .btns button {
      display: inline-flex; align-items: center;
      font: 600 13px var(--sans); color: var(--fg); background: transparent; cursor: pointer;
      border: 1px solid var(--line); border-radius: 7px; padding: 4px 10px; transition: background .15s;
    }
    #${ID} .btns button:hover { background: var(--chord-bg); }
    #${ID} .cols {
      flex: 1 1 auto; min-height: 0; overflow: hidden;
      padding: 14px 22px; box-sizing: border-box;
      column-fill: auto; column-gap: 3ch; column-rule: 1px solid var(--line);
      font-family: var(--mono); font-weight: 450; line-height: 1.32;
    }
    #${ID} .blk { white-space: pre-wrap; break-inside: avoid; margin: 0 0 .75em; }
    #${ID} .blk b {
      color: var(--chord); font-weight: 700;
      background: var(--chord-bg); border-radius: 3px; box-shadow: 0 0 0 1px var(--chord-bg);
    }
    #${ID} .sec {
      display: inline-block; font: 700 .72em/1.6 var(--sans);
      text-transform: uppercase; letter-spacing: .08em;
      color: var(--sec); background: var(--sec-bg); padding: 0 .6em; border-radius: 999px;
    }

    /* ---------- big hint above the song (site view) ---------- */
    #${ID}-banner {
      display: flex; align-items: center; justify-content: center; gap: 14px;
      margin: 0 0 18px; padding: 16px 20px; border-radius: 14px; cursor: pointer;
      background: linear-gradient(135deg, #ff8a3d, #e8590c); color: #fff;
      font: 700 22px/1.2 var(--sans); letter-spacing: -.01em;
      box-shadow: 0 6px 20px rgba(232,89,12,.25); transition: transform .15s;
    }
    #${ID}-banner:hover { transform: translateY(-1px); }
    #${ID}-banner kbd {
      font-size: 22px; padding: 4px 14px; border-radius: 9px; color: #e8590c;
      background: #fff; border: 0; box-shadow: 0 3px 0 rgba(0,0,0,.2);
    }
    #${ID}-banner small { font-weight: 500; font-size: 14px; opacity: .85; }

    /* ---------- floating buttons (site view) ---------- */
    #${ID}-dock {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483646;
      display: flex; gap: 8px;
    }
    #${ID}-dock button {
      display: inline-flex; align-items: center;
      font: 700 13px var(--sans); padding: 9px 14px; border-radius: 10px;
      background: linear-gradient(135deg, #ff8a3d, #e8590c); color: #fff; border: 0; cursor: pointer;
      box-shadow: 0 6px 18px rgba(232,89,12,.3);
    }
    #${ID}-dock button.theme {
      padding: 9px 11px; background: var(--panel); color: var(--fg);
      border: 1px solid var(--line); backdrop-filter: blur(8px); box-shadow: 0 6px 18px rgba(0,0,0,.15);
    }`;
  const LOCK = 'html, body { overflow: hidden !important; }';

  function findPre() {
    return document.querySelector('#chordPage pre, main pre, article pre, pre');
  }

  function build() {
    // Nicer fonts (falls back to system fonts if blocked)
    const fonts = document.createElement('link');
    fonts.rel = 'stylesheet';
    fonts.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap';

    overlay = document.createElement('div');
    overlay.id = ID;
    overlay.style.display = 'none';
    overlay.innerHTML = `
      <style>${CSS}</style><style class="lock"></style>
      <div class="bar">
        <div class="t"></div>
        <div class="hints">
          <span><kbd>${K}</kbd> ${L.exit}</span>
          <span><kbd>${KF}</kbd> ${L.fullscreen}</span>
          <span><kbd>${KT}</kbd> ${L.theme}</span>
          <span><kbd>+</kbd><kbd>-</kbd> ${L.size}</span>
        </div>
        <div class="btns">
          <button data-a="theme"></button>
          <button data-a="minus" title="${L.smaller} (-)">A−</button>
          <button data-a="auto" title="${L.auto} (0)">Auto</button>
          <button data-a="plus" title="${L.bigger} (+)">A+</button>
          <button data-a="off" title="${L.back} (Esc / ${K})">✕</button>
        </div>
      </div>
      <div class="cols"></div>`;
    overlay.prepend(fonts);
    cols = overlay.querySelector('.cols');
    titleEl = overlay.querySelector('.t');
    lockStyle = overlay.querySelector('style.lock');
    overlay.querySelector('.bar').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      const a = btn && btn.dataset.a;
      if (a === 'theme') toggleTheme();
      if (a === 'minus') { manualScale *= 0.92; fit(); }
      if (a === 'plus') { manualScale *= 1.08; fit(); }
      if (a === 'auto') { manualScale = 1; fit(); }
      if (a === 'off') setEnabled(false);
    });

    dock = document.createElement('div');
    dock.id = `${ID}-dock`;
    dock.innerHTML = `<button class="theme" data-a="theme"></button><button class="open">⛶ ${L.open} (${K})</button>`;
    toggleBtn = dock.querySelector('.open');
    toggleBtn.style.display = 'none';
    toggleBtn.addEventListener('click', () => setEnabled(true));
    dock.querySelector('.theme').addEventListener('click', toggleTheme);
    themeBtns = [overlay.querySelector('[data-a="theme"]'), dock.querySelector('.theme')];

    banner = document.createElement('div');
    banner.id = `${ID}-banner`;
    banner.innerHTML = `<span>${L.press}</span><kbd>${K}</kbd><span>${L.banner}</span>`;
    banner.addEventListener('click', () => setEnabled(true));
  }

  // Put our elements back if the page removed them.
  function ensureAttached() {
    if (!overlay.isConnected) { document.body.appendChild(overlay); log('overlay (re)attached'); }
    if (!dock.isConnected) document.body.appendChild(dock);
    // Banner sits right above the song; its styles come from the overlay's <style>.
    if (srcPre && srcPre.isConnected && banner.nextElementSibling !== srcPre) {
      srcPre.parentElement.insertBefore(banner, srcPre);
    }
  }

  // ---------- Theme ----------
  // Uses the site's own dark theme: its "theme" cookie plus data-theme on <html>.
  // The site re-applies that cookie on every page, and the view follows it too.
  function isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function toggleTheme() {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    setCookie('theme', next, Date.now() + 400 * DAY);
    syncTheme();
  }

  function syncTheme() {
    const dark = isDark();
    if (dark === shownDark) return;
    shownDark = dark;
    for (const b of themeBtns) {
      b.innerHTML = dark ? ICON.sun : ICON.moon;
      b.title = `${dark ? L.toLight : L.toDark} (${KT})`;
    }
  }

  function getTitle() {
    const h1 = document.querySelector('h1');
    const h2 = h1 && h1.parentElement && h1.parentElement.querySelector('h2:not(.u-srOnly), h2 a');
    return { song: h1 ? h1.textContent.trim() : document.title, artist: h2 ? h2.textContent.trim() : '' };
  }

  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  // The site's chord tags carry lyric lines inside data-* attributes (newlines included),
  // which would break the blank-line split below, so drop those attributes first.
  function cleanHtml(pre) {
    const c = pre.cloneNode(true);
    for (const el of c.querySelectorAll('*')) {
      for (const a of [...el.attributes]) if (a.name.startsWith('data-')) el.removeAttribute(a.name);
    }
    return c.innerHTML;
  }

  function render(force) {
    if (!srcPre) return;
    const raw = srcPre.innerHTML;
    if (!force && raw === lastHtml) return;
    lastHtml = raw;
    const t = getTitle();
    titleEl.innerHTML = `<b>${esc(t.song)}</b>${t.artist ? `<span>${esc(t.artist)}</span>` : ''}`;
    const html = cleanHtml(srcPre)
      .replace(/<\/?div[^>]*>/gi, '\n')
      .replace(/^\s*\n/, '')
      .replace(/\s+$/, '');
    const blocks = html.split(/\n[ \t]*\n+/).filter((s) => s.replace(/<[^>]+>/g, '').trim());
    cols.innerHTML = '';
    const lens = [];
    for (const b of blocks) {
      const d = document.createElement('div');
      d.className = 'blk';
      // Section labels like [Refrão] become pills
      d.innerHTML = b.replace(/^\n+|\n+$/g, '')
        .replace(/^([ \t]*)(\[[^\]<\n]{1,40}\])[ \t]*$/gm, '$1<span class="sec">$2</span>');
      cols.appendChild(d);
      for (const line of d.textContent.split('\n')) lens.push(line.replace(/\s+$/, '').length);
    }
    lens.sort((a, b) => a - b);
    const width = lens.length ? lens[Math.floor((lens.length - 1) * 0.95)] : 40;
    cols.style.columnWidth = `${width + 1}ch`;
    log(`rendered ${blocks.length} blocks, column width ${width + 1}ch`);
    fit();
  }

  function fits() {
    return cols.scrollWidth <= cols.clientWidth + 1 && cols.scrollHeight <= cols.clientHeight + 1;
  }

  function fit() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (!enabled || !overlay.isConnected) return;
      let lo = 6, hi = 44;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        cols.style.fontSize = mid + 'px';
        if (fits()) lo = mid; else hi = mid;
      }
      cols.style.fontSize = (Math.floor(lo * manualScale * 100) / 100) + 'px';
      cols.style.overflow = manualScale > 1 ? 'auto' : 'hidden';
      log(`font fitted: ${cols.style.fontSize}`);
    });
  }

  function setEnabled(on) {
    enabled = on;
    savePref(on);
    ensureAttached();
    overlay.style.display = on ? 'flex' : 'none';
    dock.style.display = on ? 'none' : 'flex';
    toggleBtn.style.display = on ? 'none' : 'inline-flex';
    lockStyle.textContent = on ? LOCK : '';
    if (on) render(true);
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  function toggleBrowserFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  function watchPre() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => enabled && render());
    observer.observe(srcPre, { childList: true, subtree: true, characterData: true });
  }

  // Adding our elements before React hydrates the page makes hydration fail, and the
  // site then re-renders without its icons and chord diagrams. So we wait for it
  // (React marks hydrated nodes with __react* keys), giving up after ~10s.
  let waits = 0;
  const hydrated = () => Object.keys(document.body).some((k) => k.startsWith('__react'));

  // Every 500ms: keep the unlock fresh, re-attach if removed, follow theme and song
  // changes (transpose, SPA nav).
  function tick() {
    if (UNLOCK) unlock();
    if (!document.body) return;
    if (!overlay) {
      if (!hydrated() && ++waits < 20) return;
      build();
    }
    ensureAttached();
    syncTheme();
    const p = findPre();
    if (!p) {
      // Not a song page: only the theme button stays.
      overlay.style.display = 'none';
      lockStyle.textContent = '';
      dock.style.display = 'flex';
      toggleBtn.style.display = 'none';
      return;
    }
    if (p !== srcPre) { srcPre = p; watchPre(); ensureAttached(); lastHtml = ''; }
    if (enabled) {
      if (overlay.style.display !== 'flex') setEnabled(true);
      render();
    } else {
      overlay.style.display = 'none';
      lockStyle.textContent = '';
      dock.style.display = 'flex';
      toggleBtn.style.display = 'inline-flex';
    }
  }

  document.addEventListener('keydown', (e) => {
    if (!overlay || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) return;
    const k = e.key.toLowerCase();
    if (k === KEY_THEME) { toggleTheme(); e.preventDefault(); return; }
    if (k === KEY_VIEW && (enabled || findPre())) { setEnabled(!enabled); e.preventDefault(); return; }
    if (!enabled) return;
    if (e.key === 'Escape' && !document.fullscreenElement) setEnabled(false);
    else if (k === KEY_BROWSER_FS) toggleBrowserFullscreen();
    else if (e.key === '+' || e.key === '=') { manualScale *= 1.08; fit(); }
    else if (e.key === '-') { manualScale *= 0.92; fit(); }
    else if (e.key === '0') { manualScale = 1; fit(); }
    else return;
    e.preventDefault();
  }, true);
  window.addEventListener('resize', () => enabled && overlay && fit());
  document.addEventListener('fullscreenchange', () => enabled && overlay && fit());

  // The unlock above runs at document-start; the view waits for the page like before.
  function start() { tick(); setInterval(tick, 500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
