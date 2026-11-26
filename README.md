# AnyProxy extension — free web proxy for Chrome, Edge and Firefox

The official browser extension for **[AnyProxy](https://anyproxy.site)**, a free web proxy that opens websites inside your browser tab. Paste a URL or click the toolbar button, and the page loads through an AnyProxy server instead of directly from your device. No install beyond the extension, no account needed.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-install-FF6A2C)](https://chromewebstore.google.com/detail/gdeefgkephoadlankpbacofdfmdnncmi)
[![Website](https://img.shields.io/badge/website-anyproxy.site-FF6A2C)](https://anyproxy.site)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-3DDC97)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> Not to be confused with other projects named "anyproxy" (for example the Alibaba developer tool or the anyproxy.net service). This repository is the extension for **anyproxy.site** only.

## Install

- **Chrome, Edge, Brave, Opera, Arc:** [Chrome Web Store](https://chromewebstore.google.com/detail/gdeefgkephoadlankpbacofdfmdnncmi)
- **Firefox:** coming soon. Until then, load it from source (below).
- **Without an extension:** use the web app at [anyproxy.site](https://anyproxy.site).

## Features

- **One click:** open the current site, or paste any URL, through AnyProxy.
- **Right-click "Open in AnyProxy"** on any link.
- **Region picker with live latency:** free regions in Singapore, Frankfurt and Virginia; [Pro](https://anyproxy.site/pricing/) adds Tokyo and Los Angeles.
- **Recent sites** to reopen anything you've opened before.
- **Small permission set:** `storage`, `contextMenus`, `activeTab`. The extension does not intercept or read your browsing traffic.

## How it works

The extension is a thin launcher. All proxying happens in the [AnyProxy web app](https://anyproxy.site):

1. The popup reads the URL you enter (or the active tab's address).
2. It opens `https://anyproxy.site/?u=<url>` with your chosen region in a new tab.
3. AnyProxy fetches the page from that region's server and shows it in your tab.

There is no proxy engine, no `declarativeNetRequest` rule set and no host permission in this code.

## What AnyProxy is (and isn't)

- A browser-based web proxy: it covers the tab you open through it, not your whole device. It is not a VPN.
- Many sites sit behind Cloudflare's "Just a moment…" check. AnyProxy completes that check on your behalf; the first visit can take a few seconds. Test data: [web proxy that works with Cloudflare (2026)](https://anyproxy.site/blog/web-proxy-that-works-with-cloudflare-2026/).
- Free to use. Pro ($4.99/month) adds more regions and removes ads on AnyProxy pages: [pricing](https://anyproxy.site/pricing/).

Guides: [free web proxy](https://anyproxy.site/proxy/) · [help center](https://anyproxy.site/help/) · [privacy policy](https://anyproxy.site/privacy/)

## Load from source

**Chromium browsers**
1. Clone this repo.
2. Open `chrome://extensions` and turn on Developer mode.
3. Click "Load unpacked" and pick this folder.

**Firefox**
1. Clone this repo.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click "Load Temporary Add-on…" and pick `manifest.json`.

## Support

- **Is it down, or is it just me?** Check [status.anyproxy.site](https://status.anyproxy.site): live status and 30-day uptime for each region, whether popular sites are working right now, recent fixes, and a form to report a site that won't open.
- Questions or bugs: open an issue here or write to support@anyproxy.site.

## License

MIT, see [LICENSE](LICENSE).
