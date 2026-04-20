# TickTock Town

A mobile-friendly clock-learning web app for children ages 4–9, in English and Norwegian.
Pure static HTML/CSS/JS — no build step, no backend, no dependencies.

## Quick start (local)

The app uses ES modules, so it must be served over HTTP (opening `index.html`
with `file://` will fail with CORS errors).

```bash
# From the project root
python3 -m http.server 8733
# then open http://localhost:8733
```

Any static HTTP server works. A few alternatives:

```bash
npx serve .              # Node
php -S localhost:8733    # PHP
ruby -run -e httpd .     # Ruby
caddy file-server --listen :8733
```

### Mobile testing on the same Wi-Fi

```bash
# Find your machine's LAN IP, then bind the server to 0.0.0.0
python3 -m http.server 8733 --bind 0.0.0.0
# On the phone, open http://<your-lan-ip>:8733
```

Use Chrome DevTools' device toolbar (`Cmd/Ctrl+Shift+M`) for quick desktop
simulation — test at 375×667 (iPhone SE) and 768×1024 (iPad).

## Project layout

```
/
├── index.html           # App shell + <template> blocks for each screen
├── styles.css           # All styling (pastel theme, animations, a11y modes)
├── README.md
└── js/
    ├── main.js          # Entry point + router
    ├── state.js         # Persisted state (localStorage)
    ├── i18n.js          # EN / NO strings + native time phrasing
    ├── audio.js         # Web Audio SFX + SpeechSynthesis
    ├── tikko.js         # Owl mascot SVG (6 outfits)
    ├── clock.js         # Draggable analog clock component
    ├── screens.js       # Splash, language, onboarding, hub, trophy, settings, gate
    └── games.js         # Bakery, Garden, Station, Lighthouse, Market, Routine, Free Play
```

No bundler, no transpiler. Edit, save, refresh.

## Deployment

Since the app is 100% static, any static host works. Upload the entire project
directory (`index.html`, `styles.css`, `js/`, `README.md`).

### GitHub Pages (automated)

The repo ships with `.github/workflows/deploy.yml`, which publishes the site
to GitHub Pages on every push to `main`.

1. Push the repo to GitHub:
   ```bash
   git init && git add . && git commit -m "Initial"
   git branch -M main
   git remote add origin git@github.com:<you>/ticktock-town.git
   git push -u origin main
   ```
2. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**
   (one-time setup; the workflow handles the rest).
3. Push any commit to `main` — or trigger a run manually from the **Actions**
   tab (`Deploy to GitHub Pages → Run workflow`).

The site is live at `https://<you>.github.io/<repo>/` once the workflow
completes (~1 min). The `page_url` is also printed in the Actions run summary.

### Netlify

```bash
npm i -g netlify-cli
netlify deploy --dir . --prod
```

Or drag the project folder onto https://app.netlify.com/drop.

### Vercel

```bash
npm i -g vercel
vercel --prod
```

Accept defaults (no build command, output directory `.`).

### Cloudflare Pages

Connect the GitHub repo in the Cloudflare dashboard. Build command: *(none)*.
Build output directory: `/`.

### AWS S3 + CloudFront

```bash
aws s3 sync . s3://<bucket>/ --exclude ".git/*" --exclude "*.md"
aws s3 website s3://<bucket>/ --index-document index.html
```

Front with CloudFront for HTTPS and caching.

### Any Nginx / Apache server

Point the document root at the project directory. The only requirements are:

- Serve `.js` files with `Content-Type: application/javascript` (default on all
  modern servers).
- Serve over HTTPS in production — `SpeechSynthesis` and `AudioContext` both
  require a secure context on most browsers.

Example nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name ticktock.example.com;
    root /var/www/ticktock-town;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
```

## Browser requirements

- ES modules (all browsers since 2018)
- Web Audio API (universal)
- Pointer Events (universal; falls back on older Safari with polyfill if needed)
- SpeechSynthesis API (iOS 7+, Android 4.4+)

Norwegian voice availability depends on the device. macOS/iOS ships with
high-quality "Nora" (nb-NO). Android requires Google TTS with the Norwegian
language pack installed. On devices without a Norwegian voice, speech falls
back silently — the on-screen digital time remains visible.

## Production upgrades

This is a functional prototype. For a polished release, consider:

1. **Replace SpeechSynthesis with recorded audio.** The design spec intentionally
   avoids TTS, which mispronounces Norwegian phrases like `halv tre`. Record
   each of the ~90 time phrases per language (5-minute intervals × 12 hours +
   prompts) and play back with `<audio>` preloaded. Swap `speak()` and
   `speakTheTime()` in `js/audio.js`.
2. **Pre-composed music.** Swap the synthesized marimba loop in
   `audio.js:startMusic()` for a looping `<audio>` track per building.
3. **Hand-painted assets.** Replace emoji building icons and SVG mascot with
   illustrated PNG/SVG artwork. Update `js/tikko.js` and the `.building` CSS
   classes.
4. **PWA / offline.** Add a service worker + `manifest.json` for installable
   "Add to Home Screen" behaviour with offline play. All code and assets are
   already cacheable.
5. **Analytics (privacy-respecting).** Plausible or simple server-side logs —
   avoid anything that tracks children.
6. **Multi-profile.** `state.js` keeps a single profile in localStorage;
   extend to an object keyed by profile ID for family support.

## Resetting local state

The app writes one key: `ticktock-town-v1`.

```js
// In the browser console:
localStorage.removeItem("ticktock-town-v1"); location.reload();
```

Or use **Grown-ups → Reset progress** after passing the parent gate.

## License

Add a LICENSE file before publishing. MIT is a common choice for prototypes.
