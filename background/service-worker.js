// AnyProxy — MV3 service worker
// Registers a right-click menu on links: "Open in AnyProxy".

'use strict';

const PROXY_ORIGIN = 'https://anyproxy.site';
const MENU_ID = 'anyproxy-open-link';

function buildProxyUrl(target) {
  return `${PROXY_ORIGIN}/?u=${encodeURIComponent(target)}`;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Open in AnyProxy',
      contexts: ['link'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const link = info.linkUrl;
  if (!link || !/^https?:\/\//i.test(link)) return;
  chrome.tabs.create({ url: buildProxyUrl(link), index: (tab && typeof tab.index === 'number') ? tab.index + 1 : undefined });
});
