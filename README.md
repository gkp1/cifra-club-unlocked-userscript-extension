<img src="language/flags/us.svg" width="20" height="15" alt=""> **English** &nbsp;·&nbsp; <a href="language/README.pt-BR.md"><img src="language/flags/br.svg" width="20" height="15" alt=""> Português (Brasil)</a>

# Chords Unlocked: Ultimate Guitar + Cifra Club · Userscript Extension

[![Discord](https://img.shields.io/badge/Discord-Join%20the%20server-5865F2?logo=discord&logoColor=white)](https://discord.gg/rtVf2zyM8c)

A small, free userscript that makes [Ultimate Guitar](https://tabs.ultimate-guitar.com) and [Cifra Club](https://www.cifraclub.com.br) nicer to play from. Three things it does on any song, on both sites:

1. **Easy, free chord transpose:** `[` `]` move the key half a step, on the page or in the full-screen view. On Ultimate Guitar it works on every chords and tab page, even tab pages that have no transpose button. The chords stay over the right words.
2. **Tabs toggle with smart chord detection:** `T` hides or shows the tablature. The script tells chords, lyrics, tablature and section names apart by itself, even on tab pages that don't mark the chords.
3. **Full-screen view:** press `L` and the whole song fits on one screen, in auto-sized columns, no scrolling.

| Dark | Light |
|---|---|
| ![The full-screen view in dark mode on Ultimate Guitar: the whole song in three columns, with highlighted chords, section labels and tablature](screenshots/view-dark.png) | ![The same full-screen view in light mode](screenshots/view-light.png) |

**Also**
- **Ultimate Guitar:** the ad slots and the "Sign up" popup are hidden
- **Cifra Club:** "Dividir em colunas" and "Pedal passador" open without the ad (the pedal needs a free login)
- **Key and capo at a glance:** the view shows the current key, even after you transpose, plus the capo (and the tuning on Ultimate Guitar)
- **Print and theme:** `P` prints the whole song on one page, `D` switches light/dark (on Cifra Club, the site and the view together)
- **Made for playing:** the screen stays on while the view is open, and your text size is remembered per song

No more of this on Cifra Club:

![The "Assista um anúncio rápido" popup that shows up when you pick Dividir em colunas](screenshots/ad-popup.png)

## Install

1. Install Tampermonkey or Violentmonkey, the recommended userscript managers:
   - **Tampermonkey:** <img src="assets/icons/chrome.svg" width="16" height="16" alt=""> [Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) &nbsp;·&nbsp; <img src="assets/icons/firefox.svg" width="16" height="16" alt=""> [Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/)
   - **Violentmonkey:** <img src="assets/icons/chrome.svg" width="16" height="16" alt=""> [Chrome](https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag) &nbsp;·&nbsp; <img src="assets/icons/firefox.svg" width="16" height="16" alt=""> [Firefox](https://addons.mozilla.org/firefox/addon/violentmonkey/)

   ⚠️ **On Chrome or Edge: right-click the extension's icon → Manage extension → turn on Allow User Scripts.**
2. Click here: **[Install the script](https://raw.githubusercontent.com/gkp1/cifra-club-unlocked-userscript-extension/main/cifraclub-unlocked.user.js)**. Your userscript manager opens an install page; click **Install**.
3. Open any song on Ultimate Guitar or Cifra Club, or reload the page. An orange "Press L" banner shows up above the chords.

Updates arrive automatically through your userscript manager.

## Shortcuts

| Key | What it does | Where |
|---|---|---|
| `L` | Open / close the full-screen view | song pages |
| `[` / `]` | Key half a step down / up | song pages and the full-screen view (on Ultimate Guitar tab pages with no transpose button, in the view) |
| `D` | Light / dark theme | anywhere on Cifra Club, full-screen view on Ultimate Guitar |
| `T` | Show / hide tablature | full-screen view, songs with tabs |
| `P` | Print or save as PDF, on one page | full-screen view |
| `F` | Browser fullscreen | full-screen view |
| `+` / `-` | Bigger / smaller text | full-screen view |
| `0` | Back to automatic size | full-screen view |
| `Esc` | Close the full-screen view | full-screen view |

Every button shows its key. The buttons and hints follow your browser's language: Portuguese if your browser is in Portuguese, English otherwise.

## Settings

Open the script in your userscript manager and change the lines in the Config block near the top:

```js
const START_ON = false; // open songs in the one-screen view? (then remembers your last choice)
const UNLOCK = true;    // Cifra Club: columns and pedal without the ad. Ultimate Guitar: hide ads and the sign-up popup
```

## How the unlock works

**Cifra Club:** when you watch the ad, Cifra Club stores a 24-hour pass in a cookie in your browser. The script writes that same cookie and renews it when it expires, so the site sees the feature as already unlocked.

**Ultimate Guitar:** the script hides the ad slots and the sign-up popup on your screen. When a page has no transpose button, it changes the chords in the view by itself.

That's all it does:

- Everything happens in your browser. The script downloads nothing and sends nothing anywhere.
- It doesn't touch your account, doesn't log in for you, and doesn't pretend you're a subscriber.
- Features the sites check on their servers stay as they are. Ultimate Guitar's Official and Pro tabs stay locked, and the script stays off on those pages.

If a site changes how this works, the script may stop working there until it's updated. [Open an issue](https://github.com/gkp1/cifra-club-unlocked-userscript-extension/issues) if you notice that.

## Notes

- Unofficial project, not affiliated with Cifra Club, Studio Sol or Ultimate Guitar.
- If you use these sites a lot, consider supporting them with [Cifra Club PRO](https://www.cifraclub.com.br/assine/) or Ultimate Guitar Pro.

## License

[MIT](LICENSE)
