// ==UserScript==
// @name         Chords Unlocked: Ultimate Guitar + Cifra Club
// @name:pt      Cifras Desbloqueadas: Ultimate Guitar + Cifra Club
// @name:pt-BR   Cifras Desbloqueadas: Ultimate Guitar + Cifra Club
// @namespace    https://github.com/gkp1
// @version      2.4.0
// @description  Whole song (chords + lyrics) on one screen with auto-sized columns, on Cifra Club and Ultimate Guitar. Transpose, capo, hide tabs, one-page print, light/dark, screen stays on.
// @description:pt    Cifra inteira (acordes + letra) numa tela só, em colunas com fonte automática, no Cifra Club e no Ultimate Guitar. Tom, capo, esconder tabs, impressão em uma página, tema claro/escuro, tela sempre ligada.
// @description:pt-BR Cifra inteira (acordes + letra) numa tela só, em colunas com fonte automática, no Cifra Club e no Ultimate Guitar. Tom, capo, esconder tabs, impressão em uma página, tema claro/escuro, tela sempre ligada.
// @author       gkp1
// @homepageURL  https://github.com/gkp1/cifra-club-unlocked-userscript-extension
// @supportURL   https://github.com/gkp1/cifra-club-unlocked-userscript-extension/issues
// @downloadURL  https://update.greasyfork.org/scripts/602553/Chords%20Unlocked%3A%20Ultimate%20Guitar%20%2B%20Cifra%20Club.user.js
// @updateURL    https://update.greasyfork.org/scripts/602553/Chords%20Unlocked%3A%20Ultimate%20Guitar%20%2B%20Cifra%20Club.meta.js
// @license      MIT
// @match        https://www.cifraclub.com.br/*
// @match        https://www.cifraclub.com/*
// @match        https://tabs.ultimate-guitar.com/tab/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---- only one copy, never inside iframes (ads, players) ----
  if (window.top !== window) return;
  if (window.__ccfit) return;
  window.__ccfit = 1;

  // ===== Config =====
  const START_ON = false; // open songs in the one-screen view? (then remembers your last choice)
  const UNLOCK = true;    // Cifra Club: columns/pedal without the ad. Ultimate Guitar: hide ads and the sign-up popup
  // ==================

  const ID = 'ccfit';
  const log = (...a) => console.log('%c[ccfit]', 'color:#ff8a3d;font-weight:bold', ...a);
  // Each part runs inside safe(): one broken part can't break the page.
  const safe = (name, fn) => function (...a) { try { return fn.apply(this, a); } catch (e) { log(`${name} failed`, e); } };
  const store = (k, v) => {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  };
  const DAY = 864e5;

  function getCookie(name) {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }
  function setCookie(name, value, expires) {
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${new Date(expires).toUTCString()};path=/`;
  }

  // ---------- shared text helpers ----------
  const TABLINE = /^\s*[A-Ga-g][#b]?\s*[|:][-0-9|hpbrxtv\/\\~()^.*=s<>\[\] ]{4,}(\s+x\d+)?\s*$/; // e|--3--| etc.
  const SEC = /^\s*\[[^\]\n]{1,40}\]\s*$/;                                                       // [Verse 1], [Refrão]
  // Section names written without brackets: "Intro", "Verse 1", "Riff 2:", "Primeira Parte".
  const SECNAME = /^\s*(intro(dução)?|verse|verso|pre-?chorus|pré-?refrão|chorus|refrão|bridge|ponte|solo|interlude|interlúdio|outro|final|riff|instrumental|coda|(primeira|segunda|terceira|quarta|quinta) parte|parte)(\s+\d+)?\s*:?\s*$/i;
  const CHORD = /^\(?[A-G][#b]?(?:maj|min|m|dim|aug|sus|add|M)?[0-9]*(?:[#b+\-]?[0-9]+|sus[24]?|add[0-9]+|maj[0-9]*|\+|°|ø|\*)*(?:\/[A-G][#b]?)?\)?$/;
  const NOTES_S = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTES_F = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const IDX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const shift = (name, n, flats) => name.replace(/^([A-G][#b]?)/, (r) =>
    IDX[r] === undefined ? r : (flats ? NOTES_F : NOTES_S)[(((IDX[r] + n) % 12) + 12) % 12]);
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const ZW = /[\u200b-\u200d\ufeff]/g; // invisible characters some sites put in lines (zero-width spaces before "[Refrão]")
  // A line is a chord line when most of its words are chords ("Am Em", "G Am F C", "Intro: Am Em").
  const looksChords = (t) => {
    const w = t.trim().split(/\s+/).filter((x) => !/^[|x\d().:-]+$|^(intro|riff|outro):?$/i.test(x));
    return w.length > 0 && w.filter((x) => CHORD.test(x)).length / w.length >= 0.6;
  };
  // Transpose one chord, slash bass included (D/F# -> E/G#).
  const shiftChord = (c, n, flats) => c.replace(/(^\(?|\/)([A-G][#b]?)/g, (m, p, r) => p + shift(r, n, flats));
  // Transpose a line's chords and keep them over the same lyric: longer chords eat the spaces after them.
  function shiftLine(l, n, flats) {
    if (!n || !l.ch.length) return l;
    let t = '', at = 0, debt = 0;
    const ch = [];
    for (const [a, b] of l.ch) {
      let gap = l.t.slice(at, a);
      while (debt > 0 && gap.length > (at ? 1 : 0) && gap.endsWith(' ')) { gap = gap.slice(0, -1); debt--; }
      t += gap;
      const c = shiftChord(l.t.slice(a, b), n, flats);
      ch.push([t.length, t.length + c.length]);
      t += c;
      debt += c.length - (b - a);
      if (debt < 0) { t += ' '.repeat(-debt); debt = 0; }
      at = b;
    }
    return { t: t + l.t.slice(at), ch };
  }

  // Lines from a <pre> whose chords are elements (Cifra Club: <b>): [{ t, ch: [[from, to]] }]
  function domLines(pre, isChord) {
    const lines = [{ t: '', ch: [] }];
    const walk = (n) => {
      if (n.nodeType === 3) {
        const parts = n.textContent.replace(/\r/g, '').replace(ZW, '').split('\n');
        parts.forEach((p, i) => { if (i) lines.push({ t: '', ch: [] }); lines[lines.length - 1].t += p; });
        return;
      }
      if (n.nodeType !== 1) return;
      if (/^(DIV|P)$/.test(n.tagName) && lines[lines.length - 1].t) lines.push({ t: '', ch: [] });
      if (isChord(n)) {
        const l = lines[lines.length - 1];
        const a = l.t.length;
        l.t += n.textContent.replace(/\n/g, ' ').replace(ZW, '');
        l.ch.push([a, l.t.length]);
        return;
      }
      n.childNodes.forEach(walk);
    };
    pre.childNodes.forEach(walk);
    return lines;
  }

  // Lines -> blocks the view uses: [{ kind: 'sec' | 'text' | 'tab', lines }]
  function toBlocks(lines) {
    const blocks = [];
    let cur = null;
    const push = (kind) => { cur = { kind, lines: [] }; blocks.push(cur); };
    for (const l0 of lines) {
      const l = { t: l0.t.replace(/\s+$/, ''), ch: l0.ch.filter(([a]) => a < l0.t.replace(/\s+$/, '').length) };
      if (!l.t.trim()) { cur = null; continue; }
      if ((SEC.test(l.t) || SECNAME.test(l.t)) && !l.ch.length) {
        push('sec');
        cur.lines.push({ t: l.t.trim().replace(/^\[|\]$/g, '').replace(/\s*:$/, ''), ch: [] });
        cur = null;
        continue;
      }
      const kind = TABLINE.test(l.t) ? 'tab' : 'text';
      if (!cur || cur.kind !== kind) push(kind);
      cur.lines.push(kind === 'tab' ? { t: l.t, ch: [] } : l);
    }
    return blocks;
  }

  // =====================================================================
  // Everything the script needs from each site lives in one SITE object.
  // =====================================================================
  const SITES = {
    // ------------------------------ Cifra Club ------------------------------
    cifraclub: {
      host: /(^|\.)cifraclub\.com(\.br)?$/,
      song: '#chordPage pre, main pre, article pre, pre',   // song block
      chordEl: (n) => n.tagName === 'B',                        // chords are <b>
      // Transpose controls, found by their aria-label/title (not verified on the live site in this version).
      keyRe: { down: /meio tom abaixo|diminuir.*tom|abaixar.*tom|half.?step down/i, up: /meio tom acima|aumentar.*tom|subir.*tom|half.?step up/i },
      keyEl: '[data-anchor="--chord-tone"], #cifra_tom',       // the key button next to the song ("Tom: G")
      capoEl: '#cifra_capo, [id*="capo"]',                     // "Capotraste na 2ª casa"
      tuningEl: '#cifra_afi, [id*="afina"]',
      themeCookie: 'theme',                                     // site theme: cookie + data-theme on <html>
      waitHydration: true,                                      // adding nodes before React hydrates breaks the page
      themeOutsideView: true,                                   // D also switches the site's own theme
      findSong() { return document.querySelector(this.song); },
      getTitle() {
        const h1 = document.querySelector('h1');
        const h2 = h1 && h1.parentElement && h1.parentElement.querySelector('h2:not(.u-srOnly), h2 a');
        return { song: h1 ? txt(h1) : document.title, artist: h2 ? txt(h2) : '' };
      },
      songId() { return location.pathname; },
      parse() { const p = this.findSong(); return p ? toBlocks(domLines(p, this.chordEl)) : null; },
      keyButtons() {
        const all = [...document.querySelectorAll('button, a[role="button"], [role="button"]')]
          .filter((b) => !b.closest(`#${ID}, #${ID}-dock, #${ID}-banner`));
        const by = (re) => all.find((b) => re.test(`${b.getAttribute('aria-label') || ''} ${b.title || ''}`));
        return { down: by(this.keyRe.down), up: by(this.keyRe.up) };
      },
      readKey() { const e = document.querySelector(this.keyEl); return e ? txt(e).replace(/^tom:?\s*/i, '') : ''; },
      readCapo() {
        const c = txt(document.querySelector(this.capoEl)).match(/(\d+)/);
        return { capo: c ? +c[1] : 0, tuning: txt(document.querySelector(this.tuningEl)).replace(/^afinação:?\s*/i, '') };
      },
      isDark() {
        const t = document.documentElement.getAttribute('data-theme');
        return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      },
      toggleTheme() {
        const next = this.isDark() ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        setCookie(this.themeCookie, next, Date.now() + 400 * DAY);
      },
      bannerHost(pre) { return pre; },
      unlock: cifraUnlock,
      cosmetic() {},
      healthy() { return true; },
    },

    // ---------------------------- Ultimate Guitar ----------------------------
    ug: {
      host: /^tabs\.ultimate-guitar\.com$/,
      path: /^\/tab\//,                                         // songs; Official/Pro pages have no <pre> and turn us off
      data: () => window.UGAPP && UGAPP.store && UGAPP.store.page && UGAPP.store.page.data, // UG's page store (global)
      raw: (d) => d && d.tab_view && d.tab_view.wiki_tab && d.tab_view.wiki_tab.content,     // [ch]..[/ch], [tab] = chord+lyric pair
      meta: (d) => (d && d.tab_view && d.tab_view.meta) || {},                                // { capo, tonality, tuning:{name,value} }
      song: 'code > pre',                                       // rendered song; its text follows the site's transpose
      songFallback: 'section pre, pre',
      up: 'button[aria-label="Transpose Up"]',
      down: 'button[aria-label="Transpose Down"]',
      spin: '[role="spinbutton"]',                              // wraps the transpose buttons; aria-valuenow = semitones
      darkLS: '_chunk_tabCommon_screens',                       // localStorage {"isDarkModeActive":bool} (UG's own dark mode)
      ads: 'bidding-unit, [id^="ad_cs_"]',                      // ad slots
      nag: /sign up|log in|cadastr|entrar/i,                     // "Sign up to save your favorite songs" popup
      waitHydration: false,
      themeOutsideView: false,
      findSong() { return document.querySelector(this.song) || document.querySelector(this.songFallback); },
      getTitle() {
        const t = (this.data() || {}).tab;
        if (t && t.song_name) return { song: t.song_name, artist: t.artist_name || '' };
        return { song: txt(document.querySelector('h1')) || document.title, artist: '' };
      },
      songId() { const t = (this.data() || {}).tab; return (t && t.id) || location.pathname; },
      offset() {
        const b = document.querySelector(this.up);
        const s = b && b.closest(this.spin);
        const n = s ? parseInt(s.getAttribute('aria-valuenow'), 10) : 0;
        return isNaN(n) ? 0 : n;
      },
      // Text comes from the rendered <pre> (already transposed by UG). Which lines hold chords
      // comes from the store's [ch] marks: the lines match 1:1. UG only wraps chords in
      // <span data-name> lazily while you scroll, and data-name is not updated on transpose.
      parse() {
        const pre = this.findSong();
        if (!pre) return null;
        const dom = pre.textContent.replace(/\r/g, '').replace(ZW, '').split('\n');
        const raw = this.raw(this.data());
        const src = raw ? raw.replace(/\r/g, '').split('\n') : null;
        // Tab-type pages often have chord lines too ("Am Em"), but without [ch] marks: guess those.
        const marked = src && /\[ch\]/.test(raw) && Math.abs(src.length - dom.length) <= 1;
        return toBlocks(dom.map((t, i) => {
          const ch = [];
          const chordy = marked ? /\[ch\]/.test(src[i]) : looksChords(t);
          if (chordy) t.replace(/\S+/g, (x, at) => { if (CHORD.test(x)) ch.push([at, at + x.length]); return x; });
          return { t, ch };
        }));
      },
      keyButtons() { return { up: document.querySelector(this.up), down: document.querySelector(this.down) }; },
      // UG's own "Key:" label doesn't change after a transpose, so we compute it.
      readKey() {
        const m = this.meta(this.data());
        if (!m.tonality) return '';
        const n = this.offset();
        if (!n) return m.tonality;
        // Spell it like the chords on the page (UG's "b" button switches to flats).
        const t = (this.findSong() || {}).textContent || '';
        const f = /\b[A-G]b/.test(t), s = /\b[A-G]#/.test(t);
        return shift(m.tonality, n, f === s ? /^[A-G]b/.test(m.tonality) : f);
      },
      readCapo() {
        const m = this.meta(this.data());
        return { capo: +m.capo || 0, tuning: m.tuning && m.tuning.name !== 'Standard' ? m.tuning.value || '' : '' };
      },
      // View-only theme; starts from UG's own dark-mode setting.
      isDark() {
        const v = store(`${ID}-theme`);
        if (v) return v === 'dark';
        try { const s = JSON.parse(localStorage.getItem(this.darkLS) || '{}').isDarkModeActive; if (s !== undefined) return s; } catch (e) {}
        return matchMedia('(prefers-color-scheme: dark)').matches;
      },
      toggleTheme() { store(`${ID}-theme`, this.isDark() ? 'light' : 'dark'); },
      bannerHost(pre) { return pre.closest('code') || pre; },
      unlock() {},
      // Cosmetic only: hide ad slots and the sign-up popup. Nothing is clicked or sent.
      cosmetic() {
        if (!UNLOCK) return;
        for (const e of document.body.children) {
          if (e.id && e.id.startsWith(ID)) continue;
          const nag = getComputedStyle(e).position === 'fixed' && this.nag.test(e.innerText || '')
            && e.querySelectorAll('button').length >= 3 && !e.querySelector('pre');
          if (nag && !e.dataset.ccfitHidden) { e.dataset.ccfitHidden = '1'; e.style.setProperty('display', 'none', 'important'); log('sign-up popup hidden'); }
          else if (!nag && e.dataset.ccfitHidden) { delete e.dataset.ccfitHidden; e.style.removeProperty('display'); }
        }
      },
      css() { return UNLOCK ? `${this.ads}{display:none!important}` : ''; },
      healthy() { return this.path.test(location.pathname) && !!this.findSong(); },
    },
  };

  const SITE = Object.values(SITES).find((s) => s.host.test(location.hostname));
  if (!SITE) return;

  // ---------- Cifra Club unlock ----------
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
  function cifraUnlock() {
    if (!UNLOCK) return;
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
  safe('unlock', () => SITE.unlock())();

  // ============ chord diagrams (Cifra Club + Ultimate Guitar) ============
  // Cifra Club renders a chord list ([data-chords-list]); Ultimate Guitar exposes the shapes in
  // window.UGAPP.store.page.data.tab_view.applicature. We reuse that data to draw our own
  // diagrams, show a hover tooltip and a variation picker on both sites.
  const HAS_CHORDS = SITE === SITES.cifraclub || SITE === SITES.ug;
  let chordsData = null;    // { current:{name:shape}, variations:{name:[shape]}, alias:{text:name} }
  let chordPrefs = {};      // { name: shape } user's saved variation per chord (shape = {f:[..],g:[..]|null})
  let chordStripOn = false;
  let chordTip, chordPicker, chordStrip, chordBtn;
  let curBlocks = null;
  let tipHideT;
  const ugTransCache = {};   // { offset: { current, variations } } for UG transposed chords
  const ugTransPending = {}; // offsets with an in-flight fetch

  // A shape is { f: [6 frets low E -> high e] (-1 mute, 0 open), g: [6 fingers] | null }.
  const shapeKey = (s) => (s && s.f) ? s.f.join(',') : '';

  const chordKey = () => `${ID}-chords:${SITE.songId()}`;
  const loadChords = () => {
    try {
      chordPrefs = JSON.parse(store(chordKey()) || '{}') || {};
      for (const k of Object.keys(chordPrefs)) if (typeof chordPrefs[k] === 'string') chordPrefs[k] = mountToShape(chordPrefs[k]);
    } catch (e) { chordPrefs = {}; }
  };
  const saveChords = () => { try { store(chordKey(), JSON.stringify(chordPrefs)); } catch (e) {} };

  // Cifra Club's data-mount string "3 5 5 3 3 3" (X mute, 0 open, Px barre) -> shape.
  function mountToShape(str) {
    const f = String(str || '').split(/\s+/).slice(0, 6).map((p) => {
      if (p === 'X' || p === 'x') return -1;
      const n = parseInt(p.replace(/^P/i, ''), 10);
      return isNaN(n) ? -1 : n;
    });
    return { f, g: null };
  }

  // Shift a shape's frets by n semitones (mute stays; open -> fret n when transposing up).
  function shiftShape(s, n) {
    if (!s || !n) return s;
    return {
      f: s.f.map((v) => (v === -1 ? -1 : v === 0 ? (n > 0 ? n : 0) : Math.max(1, v + n))),
      g: s.g,
    };
  }

  // Re-key a { name: shape | shape[] } map by transposed names, with frets shifted accordingly.
  function transposedMap(map, n, flats) {
    const out = {};
    for (const name of Object.keys(map)) {
      const v = map[name];
      out[shift(name, n, flats)] = Array.isArray(v) ? v.map((s) => shiftShape(s, n)) : shiftShape(v, n);
    }
    return out;
  }

  function readChordsCifra() {
    const list = document.querySelector('[data-chords-list="true"]');
    if (!list) return null;
    const current = {};
    list.querySelectorAll('li[data-chord-name]').forEach((li) => {
      const m = li.querySelector('[data-mount]');
      if (m) current[li.getAttribute('data-chord-name')] = mountToShape(m.getAttribute('data-mount'));
    });
    const alias = {};
    document.querySelectorAll('pre b[data-chord-name]').forEach((b) => {
      const t = (b.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) alias[t] = b.getAttribute('data-chord-name');
    });
    let variations = null;
    const fk = Object.keys(list).find((k) => k.indexOf('__reactFiber') === 0);
    if (fk) {
      for (let node = list[fk], d = 0; node && d < 40; node = node.return, d++) {
        const p = node.memoizedProps;
        if (p && p.chords && p.chords.length && p.chords[0].shapeList) {
          variations = {};
          for (const c of p.chords) {
            const g = c.shapeList.find((sl) => sl.instrumentType === 1);
            const t = g && g.shapeTunings.find((st) => st.tuning === 'default');
            variations[c.name] = t ? t.shapes.map(mountToShape) : [];
          }
          break;
        }
      }
    }
    if (local) {
      // Cifra Club has no usable site transpose, so [ ] shift the view only. Re-key the chord
      // data by the same shifted names so the diagrams follow the transposed view.
      const names = Object.keys(current).join(' ');
      const flats = /\b[A-G]b/.test(names) && !/\b[A-G]#/.test(names);
      return {
        current: transposedMap(current, local, flats),
        variations: variations ? transposedMap(variations, local, flats) : null,
        alias: {},
      };
    }
    return { current, variations, alias };
  }

  // Normalize UG's applicature object (name -> array of shapes) into our shape map.
  // The page's applicature is name -> array; the transpose endpoint returns name -> { "0": shape,
  // "1": shape, ..., "old_ch": name }, so we accept both shapes.
  function ugShapes(app) {
    const variations = {};
    for (const name of Object.keys(app)) {
      const raw = app[name];
      const list = Array.isArray(raw)
        ? raw
        : Object.values(raw).filter((v) => v && typeof v === 'object' && Array.isArray(v.frets));
      // UG lists frets/fingers high e -> low E; our SVG draws low E -> high e, so reverse.
      variations[name] = list.map((v) => ({
        f: (v.frets || []).slice().reverse(),
        g: v.fingers ? v.fingers.slice().reverse() : null,
      }));
    }
    const current = {};
    for (const name of Object.keys(variations)) current[name] = variations[name][0];
    return { current, variations, alias: {} };
  }

  // Does UG's rendered (transposed) text spell the chords with flats? Sharps otherwise.
  function ugFlats() {
    const t = (SITE.findSong() || {}).textContent || '';
    const f = /\b[A-G]b/.test(t), s = /\b[A-G]#/.test(t);
    return f === s ? false : f;
  }

  // UG keeps the shapes for the song's original chords in `applicature` only. When transposed,
  // it fetches the transposed shapes from its own applicature endpoint; we do the same.
  function fetchUGTransposed(names, n) {
    if (ugTransPending[n]) return;
    ugTransPending[n] = true;
    const tuning = ((SITE.meta(SITE.data()).tuning || {}).value) || 'E A D G B E';
    const qs = names.map((x) => `${encodeURIComponent(x)}=${encodeURIComponent(x)}`).join('&');
    const url = `https://tabs.ultimate-guitar.com/tab/applicature/transpose?${qs}&appl_api_version=2&custom=0&instr=guitar&json=1&tuning=${encodeURIComponent(tuning)}`;
    fetch(url, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        const app = json && json.info && json.info.applicature;
        if (!app) return;
        const data = ugShapes(app);
        ugTransCache[n] = data;
        chordsData = data;
        if (curBlocks) renderStrip(curBlocks);
      })
      .catch(() => {})
      .finally(() => { delete ugTransPending[n]; });
  }

  function readChordsUG() {
    let d = null;
    try { d = window.UGAPP && UGAPP.store && UGAPP.store.page && UGAPP.store.page.data; } catch (e) {}
    const app = d && d.tab_view && d.tab_view.applicature;
    if (!app) return null;
    const n = SITE.offset();
    if (!n) return ugShapes(app);
    if (ugTransCache[n]) return ugTransCache[n];
    // Transposed: request the shapes for the shifted chord names (async; re-renders on arrival).
    const names = Object.keys(app).map((name) => shift(name, n, ugFlats()));
    fetchUGTransposed(names, n);
    return null;
  }

  function readChords() { return SITE === SITES.ug ? readChordsUG() : readChordsCifra(); }

  const chordName = (text) => (chordsData && chordsData.alias && chordsData.alias[text]) || text;
  function chordVariations(name) { return (chordsData && chordsData.variations) ? (chordsData.variations[name] || null) : null; }
  function chordShape(name) {
    if (!chordsData) return null;
    if (chordPrefs[name]) return chordPrefs[name];
    if (chordsData.current && chordsData.current[name]) return chordsData.current[name];
    const v = chordVariations(name);
    return (v && v.length) ? v[0] : null;
  }

  // shape ({ f: frets low->high, g: fingers|null }) -> SVG diagram.
  function chordSVG(s) {
    const frets = s.f.slice(0, 6);
    const fingers = s.g;
    const played = frets.filter((f) => f > 0);
    const minF = played.length ? Math.min.apply(null, played) : 1;
    const maxF = played.length ? Math.max.apply(null, played) : 1;
    const start = minF <= 1 ? 1 : minF;
    let fc = Math.max(4, maxF - start + 1);
    if (fc > 8) fc = 8;
    const W = 80, padX = 18, stepX = 10, topY = 22, fretH = 16;
    const H = topY + fc * fretH + 8;
    const xs = frets.map((_, i) => padX + i * stepX);
    let out = `<svg class="ccd-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">`;
    if (start === 1) out += `<line class="nut" x1="${xs[0]}" y1="${topY}" x2="${xs[xs.length - 1]}" y2="${topY}"/>`;
    else out += `<text class="fretnum" x="3" y="${topY + fretH * 0.5 + 3}">${start}</text>`;
    for (let i = 0; i <= fc; i++) out += `<line class="fret" x1="${xs[0]}" y1="${topY + i * fretH}" x2="${xs[xs.length - 1]}" y2="${topY + i * fretH}"/>`;
    for (const x of xs) out += `<line class="str" x1="${x}" y1="${topY}" x2="${x}" y2="${topY + fc * fretH}"/>`;
    for (let i = 0; i < frets.length; i++) {
      const f = frets[i];
      if (f <= 0) continue;
      const y = topY + (f - start + 0.5) * fretH;
      if (y > topY + fc * fretH) continue;
      out += `<circle class="dot" cx="${xs[i]}" cy="${y}" r="4.4"/>`;
      if (fingers && fingers[i]) out += `<text class="finger" text-anchor="middle" x="${xs[i]}" y="${y + 3.4}">${fingers[i]}</text>`;
    }
    for (let i = 0; i < frets.length; i++) {
      const f = frets[i];
      if (f === -1) out += `<text class="mark" text-anchor="middle" x="${xs[i]}" y="${topY - 5}">X</text>`;
      else if (f === 0) out += `<text class="mark" text-anchor="middle" x="${xs[i]}" y="${topY - 5}">O</text>`;
    }
    return out + '</svg>';
  }

  function chordCell(name, shape, active, withName, idx) {
    return `<div class="ccd${active ? ' on' : ''}" data-chord="${esc(name)}"${idx === undefined ? '' : ` data-idx="${idx}"`} role="button" tabindex="0" title="${esc(name)}">${chordSVG(shape)}${withName ? `<span class="ccd-name">${esc(name)}</span>` : ''}</div>`;
  }

  // Unique chords in order of first appearance.
  function songChords(blocks) {
    const seen = {};
    const out = [];
    for (const b of blocks) {
      for (const l of b.lines) {
        for (const [a, bb] of l.ch) {
          const n = chordName(l.t.slice(a, bb));
          if (!seen[n]) { seen[n] = 1; out.push(n); }
        }
      }
    }
    return out;
  }

  function renderStrip(blocks) {
    if (!chordStrip) return;
    curBlocks = blocks;
    const names = songChords(blocks);
    chordStrip.innerHTML = names.length
      ? names.map((n) => { const sh = chordShape(n); return sh ? chordCell(n, sh, chordPrefs[n] ? shapeKey(chordPrefs[n]) === shapeKey(sh) : false, true) : ''; }).join('')
      : `<div class="ccd-empty">${esc(L.chords)}</div>`;
  }

  function renderPicker(name) {
    if (!chordPicker) return;
    const vs = chordVariations(name);
    const cur = chordShape(name);
    if (!vs || !vs.length) return;
    chordPicker.innerHTML = `<div class="cp-head"><b>${esc(name)}</b><span>${esc(L.variations)}</span></div><div class="cp-grid">${vs.map((sh, i) => chordCell(name, sh, shapeKey(sh) === shapeKey(cur), false, i)).join('')}</div>`;
    chordPicker.parentElement.classList.add('on');
    chordPicker.parentElement.dataset.chord = name;
  }
  function hidePicker() { if (chordPicker) chordPicker.parentElement.classList.remove('on'); }

  function showTip(name, x, y) {
    if (!chordTip) return;
    const sh = chordShape(name);
    if (!sh) { hideTip(); return; }
    clearTimeout(tipHideT);
    chordTip.innerHTML = `<div class="tip-name">${esc(name)}</div>${chordSVG(sh)}<div class="tip-hint">${esc(L.vary)}</div>`;
    chordTip.dataset.chord = name;
    chordTip.classList.add('on');
    const r = chordTip.getBoundingClientRect();
    const vr = ov.getBoundingClientRect();
    let tx = x - r.width / 2, ty = y - r.height - 8;
    if (ty < vr.top + 8) ty = y + 18;
    tx = Math.min(Math.max(tx, vr.left + 8), vr.right - r.width - 8);
    chordTip.style.left = `${tx - vr.left}px`;
    chordTip.style.top = `${ty - vr.top}px`;
  }
  function hideTip() {
    if (!chordTip) return;
    clearTimeout(tipHideT);
    tipHideT = setTimeout(() => chordTip.classList.remove('on'), 250);
  }

  const syncChords = safe('syncChords', () => {
    if (!HAS_CHORDS || !chordBtn) return;
    ov.classList.toggle('chords-on', chordStripOn);
    chordBtn.classList.toggle('off', !chordStripOn);
  });

  // ---------- UI text (follows your browser language) ----------
  const L = /^pt\b/i.test(navigator.language || '') ? {
    exit: 'sair', fullscreen: 'tela cheia', theme: 'tema', tabs: 'tabs', print: 'imprimir', key: 'Tom', capo: 'Capo',
    smaller: 'Menor', auto: 'Ajuste automático', bigger: 'Maior', down: 'Meio tom abaixo', up: 'Meio tom acima',
    toDark: 'Tema escuro', toLight: 'Tema claro', open: 'Tela cheia', press: 'Aperte', banner: 'para ver a cifra inteira em tela cheia',
    chords: 'Acordes', variations: 'Variações', vary: 'Clique para variar',
  } : {
    exit: 'exit', fullscreen: 'fullscreen', theme: 'theme', tabs: 'tabs', print: 'print', key: 'Key', capo: 'Capo',
    smaller: 'Smaller', auto: 'Auto fit', bigger: 'Bigger', down: 'Half step down', up: 'Half step up',
    toDark: 'Dark theme', toLight: 'Light theme', open: 'Full screen', press: 'Press', banner: 'to see the whole song on one screen',
    chords: 'Chords', variations: 'Variations', vary: 'Click to vary',
  };

  const ICON = {
    moon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  };

  // All CSS lives inside our own elements, so the site's re-renders can't wipe it.
  const SCOPE = `#${ID}, #${ID}-banner, #${ID}-dock`;
  const LIGHT = `--bg:#f7f5f2;--panel:rgba(255,255,255,.8);--fg:#1d1b19;--soft:#5b5650;--chord:#e8590c;--chord-bg:rgba(232,89,12,.08);--line:rgba(0,0,0,.09);--sec:#6741d9;--sec-bg:rgba(103,65,217,.09);--tab:#2f6690;`;
  const DARK = `--bg:#14161a;--panel:rgba(30,33,39,.85);--fg:#e9e6e1;--soft:#9a958d;--chord:#ff9a4d;--chord-bg:rgba(255,154,77,.1);--line:rgba(255,255,255,.09);--sec:#b197fc;--sec-bg:rgba(177,151,252,.12);--tab:#8cc4e8;`;
  const CSS = `
    ${SCOPE} { ${LIGHT}
      --mono: "JetBrains Mono", ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      --sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    #${ID}.dark, #${ID}-dock.dark { ${DARK} }

    /* ---------- view ---------- */
    #${ID} { position: fixed; inset: 0; z-index: 2147483647; background: var(--bg); color: var(--fg);
      display: none; flex-direction: column; font-family: var(--sans); -webkit-font-smoothing: antialiased; }
    #${ID}.on { display: flex; }
    #${ID} .bar { flex: 0 0 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px;
      padding: 7px 16px; background: var(--panel); border-bottom: 1px solid var(--line); font-size: 13px; color: var(--soft); }
    #${ID} .t { flex: 1; min-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #${ID} .t b { color: var(--fg); font-weight: 700; font-size: 15px; }
    #${ID} .t span { margin-left: 8px; }
    #${ID} .grp { display: inline-flex; align-items: center; gap: 4px; }
    #${ID} .key, #${ID} .capo { color: var(--fg); font-weight: 600; white-space: nowrap; }
    #${ID} button { display: inline-flex; align-items: center; gap: 5px; font: 600 12px var(--sans); color: var(--fg);
      background: transparent; cursor: pointer; border: 1px solid var(--line); border-radius: 7px; padding: 3px 8px; }
    #${ID} button:hover { background: var(--chord-bg); }
    #${ID} button.off { opacity: .45; }
    /* Key caps are our own spans with every style reset, so the site's kbd/span styles can't reach them. */
    #${ID} .k, #${ID}-banner .k, #${ID}-dock .k { all: unset !important; display: inline-block !important;
      font: 700 10px/1.3 var(--sans) !important; color: var(--fg) !important; padding: 1px 5px !important;
      border-radius: 4px !important; border: 1px solid var(--line) !important; background: var(--bg) !important; }
    #${ID} .cols { flex: 1 1 auto; min-height: 0; overflow: hidden; padding: 14px 22px; box-sizing: border-box;
      column-fill: auto; column-gap: 3ch; column-rule: 1px solid var(--line);
      font-family: var(--mono); font-weight: 450; line-height: 1.3; }
    #${ID} .blk { white-space: pre-wrap; break-inside: avoid; margin: 0 0 .7em; }
    #${ID} .blk b { color: var(--chord); font-weight: 700; background: var(--chord-bg); border-radius: 3px; }
    #${ID} .tab { color: var(--tab); }
    #${ID}.notab .tab { display: none; }
    #${ID} .sec { display: inline-block; margin: 0 0 .3em; font: 700 .72em/1.6 var(--sans); text-transform: uppercase;
      letter-spacing: .08em; color: var(--sec); background: var(--sec-bg); padding: 0 .6em; border-radius: 999px; }

    /* ---------- "Press L" banner above the song ---------- */
    #${ID}-banner { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 0 0 18px; padding: 14px 20px;
      border-radius: 14px; cursor: pointer; background: linear-gradient(135deg, #ff8a3d, #e8590c); color: #fff;
      font: 700 20px/1.2 var(--sans); box-shadow: 0 6px 20px rgba(232,89,12,.25); white-space: normal; }
    #${ID}-banner .k { font: 700 20px/1.2 var(--sans) !important; padding: 3px 13px !important; border-radius: 9px !important;
      color: #e8590c !important; background: #fff !important; border: 0 !important; vertical-align: middle !important; }
    #${ID}-dock .k { font-size: 11px !important; color: #e8590c !important; background: #fff !important; border: 0 !important; }

    /* ---------- floating buttons (site view) ---------- */
    #${ID}-dock { position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; display: flex; gap: 8px; }
    #${ID}-dock button { display: inline-flex; align-items: center; gap: 6px; font: 700 13px var(--sans); padding: 9px 14px;
      border-radius: 10px; background: linear-gradient(135deg, #ff8a3d, #e8590c); color: #fff; border: 0; cursor: pointer;
      box-shadow: 0 6px 18px rgba(232,89,12,.3); }
    #${ID}-dock button.theme { padding: 9px 11px; background: var(--panel); color: var(--fg); border: 1px solid var(--line); }

    /* ---------- chord diagrams (Cifra Club) ---------- */
    #${ID}-strip { display: none; flex: 0 0 auto; gap: 12px; padding: 10px 16px 12px; overflow-x: auto; overflow-y: hidden;
      border-bottom: 1px solid var(--line); }
    #${ID}.chords-on #${ID}-strip { display: flex; }
    #${ID}-strip .ccd, #${ID}-picker .ccd { display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer;
      padding: 6px 4px 5px; border-radius: 10px; border: 1px solid transparent; }
    #${ID}-strip .ccd { flex: 0 0 auto; }
    #${ID}-strip .ccd:hover, #${ID}-picker .ccd:hover { background: var(--chord-bg); border-color: var(--line); }
    #${ID}-strip .ccd.on, #${ID}-picker .ccd.on { background: var(--chord-bg); border-color: var(--chord); }
    #${ID}-strip .ccd-name, #${ID}-picker .ccd-name, #${ID}-tip .tip-name { font: 700 11px var(--sans); color: var(--fg); }
    #${ID}-strip .ccd-empty { color: var(--soft); font: 500 12px var(--sans); padding: 8px 0; }
    #${ID} .ccd-svg .nut { stroke: var(--fg); stroke-width: 2; }
    #${ID} .ccd-svg .fret, #${ID} .ccd-svg .str { stroke: var(--soft); stroke-width: 1; fill: none; }
    #${ID} .ccd-svg .dot { fill: var(--chord); }
    #${ID} .ccd-svg .finger { fill: #fff; font: 700 8px var(--sans); pointer-events: none; }
    #${ID} .ccd-svg .mark, #${ID} .ccd-svg .fretnum { fill: var(--soft); font: 700 10px var(--sans); }

    /* ---------- chord hover tooltip ---------- */
    #${ID}-tip { position: absolute; z-index: 60; display: none; flex-direction: column; align-items: center; gap: 4px;
      padding: 10px 12px 8px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,.25); cursor: pointer; }
    #${ID}-tip.on { display: flex; }
    #${ID}-tip .tip-hint { font: 500 10px var(--sans); color: var(--soft); }

    /* ---------- chord variation picker ---------- */
    #${ID}-picker { position: absolute; inset: 0; z-index: 70; display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,.4); }
    #${ID}-picker.on { display: flex; }
    #${ID}-picker .cp { max-width: 92%; max-height: 84%; display: flex; flex-direction: column; background: var(--bg);
      border: 1px solid var(--line); border-radius: 14px; padding: 14px 18px; box-shadow: 0 12px 40px rgba(0,0,0,.4); }
    #${ID}-picker .cp-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
    #${ID}-picker .cp-head b { font: 700 18px var(--sans); color: var(--chord); }
    #${ID}-picker .cp-head span { font: 500 12px var(--sans); color: var(--soft); }
    #${ID}-picker .cp-grid { display: flex; flex-wrap: wrap; gap: 10px; overflow: auto; justify-content: center; }

    /* ---------- print: the view on one A4 page ---------- */
    @media print {
      body > *:not(#${ID}) { display: none !important; }
      #${ID} { position: static; display: flex !important; width: 190mm; height: 262mm; ${LIGHT} background: #fff; }
      #${ID} .bar .grp, #${ID} .bar button { display: none !important; }
      #${ID} .bar { background: none; border: 0; padding: 0 0 2mm; }
      #${ID} .cols { padding: 0; }
      #${ID}-strip, #${ID}-tip, #${ID}-picker { display: none !important; }
      @page { size: A4; margin: 10mm; }
    }`;
  const LOCK = 'html, body { overflow: hidden !important; }';

  let ov, cols, titleEl, keyEl, capoEl, keyGrp, tabBtn, lockEl, dock, openBtn, themeBtns, banner, srcPre, songMo, pageMo, raf, wake;
  let open = false, scale = 1, local = 0, lastSig = '', built = false;

  const readPref = () => { const v = store(`${ID}-on`); return v === null ? START_ON : v === '1'; };
  const sizeKey = () => `${ID}-size:${SITE.songId()}`;
  const shiftKey = () => `${ID}-shift:${SITE.songId()}`;

  function build() {
    ov = document.createElement('div');
    ov.id = ID;
    ov.innerHTML = `
      <style>${CSS}</style><style class="lock"></style><style>${SITE.css ? SITE.css() : ''}</style>
      <div class="bar">
        <div class="t"></div>
        <span class="grp kg">
          <button data-a="down" title="${L.down} ([)"><span class="k">[</span>−</button>
          <span class="key"></span>
          <button data-a="up" title="${L.up} (])">+<span class="k">]</span></button>
        </span>
        <span class="capo"></span>
        <span class="grp">
          <button data-a="tab"><span class="k">T</span>${L.tabs}</button>
          ${HAS_CHORDS ? `<button data-a="chords"><span class="k">C</span>${L.chords}</button>` : ''}
          <button data-a="print"><span class="k">P</span>${L.print}</button>
          <button data-a="theme"><span class="k">D</span><i></i></button>
          <button data-a="fs"><span class="k">F</span>${L.fullscreen}</button>
          <button data-a="minus" title="${L.smaller}"><span class="k">-</span></button>
          <button data-a="auto" title="${L.auto}"><span class="k">0</span></button>
          <button data-a="plus" title="${L.bigger}"><span class="k">+</span></button>
          <button data-a="off"><span class="k">Esc</span>${L.exit}</button>
        </span>
      </div>
      ${HAS_CHORDS ? `<div id="${ID}-strip"></div>` : ''}
      <div class="cols"></div>
      ${HAS_CHORDS ? `<div id="${ID}-tip"></div><div id="${ID}-picker"><div class="cp"></div></div>` : ''}`;
    cols = ov.querySelector('.cols');
    titleEl = ov.querySelector('.t');
    keyEl = ov.querySelector('.key');
    keyGrp = ov.querySelector('.kg');
    capoEl = ov.querySelector('.capo');
    tabBtn = ov.querySelector('[data-a="tab"]');
    lockEl = ov.querySelector('style.lock');
    chordBtn = ov.querySelector('[data-a="chords"]');
    chordStrip = HAS_CHORDS ? ov.querySelector(`#${ID}-strip`) : null;
    chordTip = HAS_CHORDS ? ov.querySelector(`#${ID}-tip`) : null;
    chordPicker = HAS_CHORDS ? ov.querySelector(`#${ID}-picker .cp`) : null;
    ov.querySelector('.bar').addEventListener('click', safe('bar', (e) => {
      const b = e.target.closest('button');
      if (b) act(b.dataset.a);
    }));
    if (HAS_CHORDS) {
      loadChords();
      chordStripOn = store(`${ID}-chords-on`) === '1';
      cols.addEventListener('mouseover', safe('tip-over', (e) => {
        const b = e.target.closest('.blk b');
        if (!b) return;
        const name = chordName((b.textContent || '').trim());
        if (!chordShape(name)) return;
        const r = b.getBoundingClientRect();
        showTip(name, r.left + r.width / 2, r.top);
      }));
      cols.addEventListener('mouseout', safe('tip-out', (e) => {
        if (e.target.closest('.blk b')) hideTip();
      }));
      chordTip.addEventListener('mouseover', safe('tip-over', () => clearTimeout(tipHideT)));
      chordTip.addEventListener('mouseout', safe('tip-out', () => hideTip()));
      ov.addEventListener('click', safe('chord-click', (e) => {
        const cell = e.target.closest('.ccd');
        if (cell) {
          const name = cell.getAttribute('data-chord');
          if (cell.closest(`#${ID}-picker`)) {
            const idx = cell.getAttribute('data-idx');
            const vs = idx !== null ? chordVariations(name) : null;
            const sh = vs && vs[+idx];
            if (name && sh) { chordPrefs[name] = sh; saveChords(); hidePicker(); renderStrip(curBlocks); }
          } else {
            renderPicker(name);
          }
          e.stopPropagation(); return;
        }
        const tip = e.target.closest(`#${ID}-tip`);
        if (tip) { renderPicker(tip.getAttribute('data-chord')); e.stopPropagation(); return; }
        const b = e.target.closest('.blk b');
        if (b) {
          const name = chordName((b.textContent || '').trim());
          if (chordShape(name)) { renderPicker(name); e.stopPropagation(); }
        }
      }));
      chordPicker.parentElement.addEventListener('click', safe('picker-bg', (e) => {
        if (e.target === chordPicker.parentElement) hidePicker();
      }));
      syncChords();
    }

    dock = document.createElement('div');
    dock.id = `${ID}-dock`;
    dock.innerHTML = `${SITE.themeOutsideView ? '<button class="theme" data-a="theme"></button>' : ''}<button class="open">⛶ ${L.open} <span class="k">L</span></button>`;
    openBtn = dock.querySelector('.open');
    openBtn.addEventListener('click', () => setOpen(true));
    const dt = dock.querySelector('.theme');
    if (dt) dt.addEventListener('click', () => act('theme'));
    themeBtns = [ov.querySelector('[data-a="theme"] i'), dt].filter(Boolean);

    banner = document.createElement('div');
    banner.id = `${ID}-banner`;
    banner.innerHTML = `<span>${L.press}</span><span class="k">L</span><span>${L.banner}</span>`;
    banner.addEventListener('click', () => setOpen(true));
    built = true;
  }

  // Put our elements back if the page removed them.
  const ensureAttached = safe('attach', () => {
    if (!ov.isConnected) document.body.appendChild(ov);
    if (!dock.isConnected) document.body.appendChild(dock);
    const p = SITE.findSong();
    dock.style.display = open || (!p && !SITE.themeOutsideView) ? 'none' : 'flex';
    openBtn.style.display = p ? 'inline-flex' : 'none';
    const host = p && SITE.bannerHost(p);
    if (host && host.parentElement && banner.nextElementSibling !== host) host.parentElement.insertBefore(banner, host);
  });

  // ---------- actions (keys and buttons share them) ----------
  const act = safe('act', (a) => {
    if (a === 'up' || a === 'down') {
      const b = SITE.keyButtons()[a];
      if (b) { b.click(); setTimeout(() => render(), 350); }
      else {
        // No transpose on the site (UG "Tab" pages): transpose inside the view only.
        local = (((local + (a === 'up' ? 1 : -1)) % 12) + 12) % 12;
        if (local > 6) local -= 12;
        store(shiftKey(), String(local));
        render(true);
      }
    }
    if (a === 'tab') { ov.classList.toggle('notab'); store(`${ID}-notab`, ov.classList.contains('notab') ? '1' : '0'); syncBtns(); fit(); }
    if (a === 'chords') { chordStripOn = !chordStripOn; store(`${ID}-chords-on`, chordStripOn ? '1' : '0'); syncChords(); fit(); }
    if (a === 'print') window.print();
    if (a === 'theme') { SITE.toggleTheme(); syncTheme(); }
    if (a === 'fs') {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen().catch(() => {});
    }
    if (a === 'minus') { scale *= 0.92; saveScale(); fit(); }
    if (a === 'plus') { scale *= 1.08; saveScale(); fit(); }
    if (a === 'auto') { scale = 1; saveScale(); fit(); }
    if (a === 'off') setOpen(false);
  });
  const saveScale = () => store(sizeKey(), String(Math.round(scale * 1e4) / 1e4));
  const syncBtns = () => tabBtn.classList.toggle('off', ov.classList.contains('notab'));
  const syncTheme = safe('theme', () => {
    const dark = SITE.isDark();
    ov.classList.toggle('dark', dark);
    dock.classList.toggle('dark', dark);
    for (const b of themeBtns) {
      b.innerHTML = dark ? ICON.sun : ICON.moon;
      (b.closest('button') || b).title = `${dark ? L.toLight : L.toDark} (D)`;
    }
  });

  // ---------- render ----------
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function lineHtml(l) {
    let out = '', at = 0;
    for (const [a, b] of l.ch) { out += esc(l.t.slice(at, a)) + '<b>' + esc(l.t.slice(a, b)) + '</b>'; at = b; }
    return out + esc(l.t.slice(at));
  }

  const render = safe('render', (force) => {
    if (!open) return;
    const p = SITE.findSong();
    if (!p) return;
    if (p !== srcPre) { srcPre = p; watchSong(); force = true; }
    const sig = p.textContent + p.childElementCount;
    if (!force && sig === lastSig) return;
    lastSig = sig;
    let blocks = SITE.parse();
    if (!blocks) return;

    const t = SITE.getTitle();
    titleEl.innerHTML = `<b>${esc(t.song)}</b>${t.artist ? `<span>${esc(t.artist)}</span>` : ''}`;
    const kb = SITE.keyButtons();
    const siteKeys = !!(kb.up || kb.down);
    const n = siteKeys ? 0 : local;
    const all = blocks.flatMap((b) => b.lines);
    const hasChords = all.some((l) => l.ch.length);
    if (n) {
      const s = all.map((l) => l.ch.map(([a, b]) => l.t.slice(a, b)).join(' ')).join(' ');
      const flats = /\b[A-G]b/.test(s) && !/\b[A-G]#/.test(s);
      blocks = blocks.map((b) => ({ kind: b.kind, lines: b.lines.map((l) => shiftLine(l, n, flats)) }));
    }
    const k = SITE.readKey();
    keyGrp.style.display = siteKeys || k || hasChords ? '' : 'none';
    keyEl.textContent = k ? `${L.key}: ${n ? shift(k, n, /^[A-G]b/.test(k)) : k}` : `${L.key}: ${n > 0 ? '+' : ''}${n}`;
    const c = SITE.readCapo();
    capoEl.textContent = [c.capo ? `${L.capo} ${c.capo}` : '', c.tuning].filter(Boolean).join(' · ');
    tabBtn.style.display = blocks.some((b) => b.kind === 'tab') ? '' : 'none';
    if (HAS_CHORDS) { chordsData = readChords(); hideTip(); hidePicker(); renderStrip(blocks); }

    const html = [];
    const lens = [];
    let sec = '', tabMax = 0;
    for (const b of blocks) {
      if (b.kind === 'sec') { sec = `<span class="sec">${esc(b.lines[0].t)}</span>\n`; continue; }
      html.push(`<div class="blk${b.kind === 'tab' ? ' tab' : ''}">${sec}${b.lines.map(lineHtml).join('\n')}</div>`);
      sec = '';
      for (const l of b.lines) { lens.push(l.t.length); if (b.kind === 'tab') tabMax = Math.max(tabMax, l.t.length); }
    }
    if (sec) html.push(`<div class="blk">${sec}</div>`);
    cols.innerHTML = html.join('');
    // Columns as wide as the longest line, so lines never run into the next column. Tabs never
    // wrap; a lyric line longer than 1.5x the usual length wraps instead of widening every column.
    lens.sort((a, b) => a - b);
    const p95 = lens.length ? lens[Math.floor((lens.length - 1) * 0.95)] : 40;
    const w = lens.length ? Math.max(tabMax, Math.min(lens[lens.length - 1], Math.ceil(p95 * 1.5))) : 40;
    // Width of one character as the browser really draws it: "ch" can be off while a web font
    // is loading or blocked, and then every line wraps.
    const probe = document.createElement('span');
    probe.style.whiteSpace = 'pre';
    probe.textContent = '0'.repeat(100);
    cols.appendChild(probe);
    const em = probe.getBoundingClientRect().width / 100 / parseFloat(getComputedStyle(cols).fontSize) || 0.6;
    probe.remove();
    cols.style.columnWidth = `${(w + 1) * em}em`;
    log(`rendered ${blocks.length} blocks`);
    fit();
  });

  // ---------- fit: binary search on font size (6..44px) ----------
  const fits = () => cols.scrollWidth <= cols.clientWidth + 1 && cols.scrollHeight <= cols.clientHeight + 1;
  function fitNow(s) {
    let lo = 6, hi = 44;
    for (let i = 0; i < 14; i++) {
      const m = (lo + hi) / 2;
      cols.style.fontSize = m + 'px';
      if (fits()) lo = m; else hi = m;
    }
    cols.style.fontSize = Math.floor(lo * s * 100) / 100 + 'px';
    cols.style.overflow = s > 1 ? 'auto' : 'hidden';
  }
  function fit() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(safe('fit', () => { if (open && ov.isConnected) fitNow(scale); }));
  }

  // Print: right before printing, fit the song to the printable part of A4 (190 x 262 mm).
  const MM = 96 / 25.4;
  window.addEventListener('beforeprint', safe('beforeprint', () => {
    if (!open) return;
    ov.style.cssText = `position:static;display:flex;width:${190 * MM}px;height:${262 * MM}px`;
    fitNow(1);
  }));
  window.addEventListener('afterprint', safe('afterprint', () => { if (!open) return; ov.style.cssText = ''; fit(); }));

  // ---------- screen stays on while the view is open ----------
  async function keepAwake(on) {
    try {
      if (on && !wake && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        wake = await navigator.wakeLock.request('screen');
        wake.addEventListener('release', () => { wake = null; });
      } else if (!on && wake) { const w = wake; wake = null; await w.release(); }
    } catch (e) { wake = null; }
  }

  // ---------- updates: MutationObservers, paused while the tab is hidden ----------
  function watchSong() {
    if (songMo) songMo.disconnect();
    songMo = null;
    if (!open || document.hidden || !srcPre) return;
    songMo = new MutationObserver(() => render());
    songMo.observe(srcPre, { childList: true, subtree: true, characterData: true });
  }
  let pending = false;
  const onPage = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(safe('page', () => {
      pending = false;
      ensureAttached();
      if (SITE.cosmetic) SITE.cosmetic();
      if (SITE.themeOutsideView) syncTheme();
      if (open) render();
    }));
  };
  function watchPage() {
    if (pageMo) pageMo.disconnect();
    pageMo = null;
    if (document.hidden) return;
    pageMo = new MutationObserver(onPage);
    pageMo.observe(document.body, { childList: true, subtree: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (!built) return;
    watchPage(); watchSong(); keepAwake(open);
    if (!document.hidden) onPage();
  });

  const setOpen = safe('setOpen', (on) => {
    open = on;
    store(`${ID}-on`, on ? '1' : '0');
    ensureAttached();
    ov.classList.toggle('on', on);
    lockEl.textContent = on ? LOCK : '';
    if (on) {
      scale = parseFloat(store(sizeKey())) || 1;
      local = parseInt(store(shiftKey()), 10) || 0;
      ov.classList.toggle('notab', store(`${ID}-notab`) === '1');
      syncTheme(); syncBtns();
      srcPre = null;
      render(true);
      keepAwake(true);
    } else {
      watchSong(); keepAwake(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  });

  // ---------- keys ----------
  const KEYS = { '[': 'down', ']': 'up', t: 'tab', c: 'chords', p: 'print', d: 'theme', f: 'fs', '+': 'plus', '=': 'plus', '-': 'minus', '0': 'auto' };
  document.addEventListener('keydown', safe('keys', (e) => {
    if (!built || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) return;
    const k = e.key.toLowerCase();
    if (k === 'l' && (open || SITE.findSong())) { setOpen(!open); }
    else if (!open && k === 'd' && SITE.themeOutsideView) act('theme');
    else if (!open && (k === '[' || k === ']')) {
      // On the page itself, [ ] press the site's own transpose buttons (when it has them).
      const b = SITE.findSong() && SITE.keyButtons()[k === ']' ? 'up' : 'down'];
      if (!b) return;
      b.click();
    }
    else if (!open) return;
    else if (e.key === 'Escape') { if (document.fullscreenElement) return; act('off'); }
    else if (KEYS[k]) act(KEYS[k]);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }), true);
  window.addEventListener('resize', () => open && fit());
  document.addEventListener('fullscreenchange', () => open && fit());
  // When the view's fonts finish loading, characters change width: measure and fit again.
  if (document.fonts) document.fonts.addEventListener('loadingdone', () => open && render(true));

  // ---------- start ----------
  // Cifra Club: wait for React hydration (React marks hydrated nodes with __react* keys), up to ~10s.
  const hydrated = () => Object.keys(document.body).some((k) => k.startsWith('__react'));
  let tries = 0;
  const start = safe('start', () => {
    if (!document.body) return setTimeout(start, 100);
    if (SITE.waitHydration && !hydrated() && ++tries < 20) return setTimeout(start, 500);
    // Health check: if the page doesn't look like what we expect, stay off and leave it alone.
    if (!SITE.healthy()) {
      if (++tries < 20) return setTimeout(start, 500);
      log('page not recognised, staying off');
      return;
    }
    build();
    ensureAttached();
    if (SITE.cosmetic) SITE.cosmetic();
    syncTheme();
    watchPage();
    if (readPref() && SITE.findSong()) setOpen(true);
    log('ready', location.hostname);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  // Cifra Club: keep the 24h passes fresh while the tab stays open.
  if (SITE.unlock !== SITES.ug.unlock) setInterval(safe('unlock', () => SITE.unlock()), 60e3);
})();
