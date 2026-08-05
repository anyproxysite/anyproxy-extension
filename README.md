# AnyProxy Browser Extension

The official browser extension for **[AnyProxy](https://anyproxy.site)** — a
free, encrypted web proxy that unblocks 500+ sites in one click, right
inside your browser tab. No signup. No VPN app. No logs. Website:
**[https://anyproxy.site](https://anyproxy.site)**.

[![Website](https://img.shields.io/badge/website-anyproxy.site-FF6A2C)](https://anyproxy.site)
[![Pricing](https://img.shields.io/badge/pricing-%244.99%2Fmo-FF6A2C)](https://anyproxy.site/pricing/)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-3DDC97)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Works on Chrome, Edge, Brave, Arc, Opera, and Firefox. Unblocks YouTube,
Instagram, TikTok, X, Facebook, Reddit, ChatGPT, Telegram, WhatsApp Web,
Discord, Wikipedia, and more.

> Learn about the underlying proxy service, regions, and privacy policy at
> [anyproxy.site](https://anyproxy.site). Full pricing and Pro tier at
> [anyproxy.site/pricing](https://anyproxy.site/pricing/).

## Screenshots

<p align="center">
  <img src="icons/icon-128.png" width="96" alt="AnyProxy icon" />
</p>

*(Screenshots live in the Chrome Web Store listing.)*

## Features

- **One-click browsing.** Toolbar popup, paste a URL, hit Browse. Site
  opens through AnyProxy in a new tab.
- **Auto-detects the current tab.** Popup prefills the current site's
  hostname and updates the CTA to `Browse <Site> Anonymously`.
- **Right-click "Open in AnyProxy"** on any link.
- **Popular tiles** for YouTube, Reddit, X, Wikipedia, Facebook, Instagram.
- **Recent sites** — one click to reopen anything you've proxied.
- **Live latency** across six regions (Singapore, Frankfurt, Virginia,
  London, Tokyo, São Paulo). Popup auto-picks the fastest.
- **Zero host permissions.** The extension does not intercept traffic
  outside the popup click. Only `storage`, `contextMenus`, and
  `activeTab` — the smallest permission set that ships this feature.

Full feature list and privacy policy at
[https://anyproxy.site/privacy/](https://anyproxy.site/privacy/).

## Install

**Chrome / Edge / Brave / Arc / Opera** — Chrome Web Store
*(coming soon; direct link will land here at v1.0.1)*

**Firefox** — [addons.mozilla.org](https://addons.mozilla.org/) (search
"AnyProxy")

**From source** (any Chromium browser):

1. Clone this repo
2. Open `chrome://extensions`
3. Toggle "Developer mode" on
4. Click "Load unpacked" and select the `ap-browser-ext/` folder

**Firefox from source:**

1. Clone this repo
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on…" and pick `manifest.json`

## How it works

The extension is deliberately thin — all real proxying is done by the
[AnyProxy](https://anyproxy.site) web app. The popup:

1. Reads the URL you enter (or the active tab's hostname)
2. Opens `https://anyproxy.site/<target>?region=<slug>` in a new tab
3. AnyProxy's edge middleware picks the region, signs the URL, and
   redirects to the regional edge (e.g. `sg.anyproxy.site/r/...`) which
   fetches the page and rewrites it back through the proxy

The extension does not include a proxy engine. No `declarativeNetRequest`,
no host permissions, no traffic interception. Reviewer-friendly by design.

## Repo layout

```
ap-browser-ext/
├── manifest.json          MV3 manifest — storage, contextMenus, activeTab
├── popup/                 360×600 toolbar popup
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── background/
│   └── service-worker.js  Right-click "Open in AnyProxy" menu item
└── icons/                 16/32/48/128 PNGs
```

## Region catalog

The popup fetches the region list from
[`https://anyproxy.site/regions.json`](https://anyproxy.site/regions.json)
on open, then measures live RTT to each region's `pingUrl` from the
user's browser — three samples, keep the minimum. Results are cached in
`chrome.storage.local` for 10 minutes.

Adding a new region is a single JSON edit on the server. Extension
picks it up on the next refresh.

## Development

No build step. Edit the files in `popup/` and reload the extension in
`chrome://extensions`.

Quick sanity checks:

```bash
# Validate manifest JSON
python3 -c "import json; json.load(open('manifest.json'))"

# Parse-check popup JS
node -e "new Function(require('fs').readFileSync('popup/popup.js','utf8'))"
```

## Related repos

- **[anyproxy.site](https://anyproxy.site)** — the marketing site and
  Cloudflare Pages Functions (routing, region signing, `/regions.json`
  endpoint)

## Contributing

Issues and PRs welcome. Please open an issue before starting a large
change so we can align on the direction.

## License

MIT — see [LICENSE](LICENSE).

## Links

- Website: [https://anyproxy.site](https://anyproxy.site)
- Pricing: [https://anyproxy.site/pricing/](https://anyproxy.site/pricing/)
- Privacy: [https://anyproxy.site/privacy/](https://anyproxy.site/privacy/)
- Terms: [https://anyproxy.site/terms/](https://anyproxy.site/terms/)
- Contact: [https://anyproxy.site/contact/](https://anyproxy.site/contact/)
- Blog: [https://anyproxy.site/blog/](https://anyproxy.site/blog/)
