const log = (...args) => chrome.storage.local.get({
  log: false
}, prefs => prefs.log && console.log(...args));

const i18n = (...args) => chrome.i18n.getMessage(...args) || '';

const COLORS = {
  on: [27, 94, 32, 255],
  off: [176, 24, 24, 255]
};

/* preference mirror: set-icon paints are synchronous, no storage read needed */
let badge = true;
chrome.storage.local.get({badge: true}, prefs => badge = prefs.badge);

const paint = (tabId, text, color, title) => {
  chrome.action.setBadgeText({tabId, text});
  if (color) {
    chrome.action.setBadgeBackgroundColor({
      tabId,
      color
    });
  }
  if (title) {
    chrome.action.setTitle({tabId, title});
  }
};

const urlHost = url => {
  try {
    return new URL(url).hostname;
  }
  catch (e) {
    return '';
  }
};

const notify = async (tabId, title, symbol = '!') => {
  tabId = tabId || (await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  }))[0]?.id;
  if (tabId) {
    paint(tabId, symbol, COLORS.off, title);
  }
};

/* click-time only: shows the confirm dialog in the page and, on accept, asks
   the page to send the reload message back to the worker */
const askReload = (tabId, key, method) => chrome.scripting.executeScript({
  target: {tabId},
  world: 'ISOLATED',
  injectImmediately: true,
  func: (key, method) => {
    if (window.confirm(chrome.i18n.getMessage(key) || '')) {
      chrome.runtime.sendMessage({
        method,
        hostname: location.hostname
      });
    }
  },
  args: [key, method]
}).catch(e => console.log('[Always Active]', 'Cannot prompt the page', e));

const validate = async hosts => {
  if (hosts.length === 0) {
    return '';
  }

  let message = '';
  try {
    await chrome.scripting.registerContentScripts([{
      'matches': hosts.map(h => '*://' + h + '/*'),
      'allFrames': true,
      'matchOriginAsFallback': true,
      'runAt': 'document_start',
      'id': 'test',
      'js': ['data/inject/test.js']
    }]);
  }
  catch (e) {
    message = e.message;
  }
  try {
    await chrome.scripting.unregisterContentScripts({
      ids: ['test']
    });
  }
  catch (e) {}

  return message;
};

/* wildcard-aware list membership: matches exact hosts, '*', and '*.' patterns
   the same way match patterns do ('*.example.com' covers example.com and
   any-depth subdomains like www.example.com, a.b.example.com) */
const matchesHost = (hostname, entry) => {
  hostname = hostname.toLowerCase();
  entry = entry.toLowerCase();
  if (entry === '*') {
    return true;
  }
  if (entry === hostname) {
    return true;
  }
  if (entry.startsWith('*.')) {
    const domain = entry.slice(2);
    return hostname === domain || hostname.endsWith('.' + domain);
  }
  return false;
};

/* inject the registered scripts into the already-open document (no reload needed);
   only runs in response to a user click */
const applyNow = tabId => Promise.all([
  chrome.scripting.executeScript({
    target: {tabId, allFrames: true},
    files: ['data/inject/main.js'],
    world: 'MAIN',
    injectImmediately: true
  }),
  chrome.scripting.executeScript({
    target: {tabId, allFrames: true},
    files: ['data/inject/isolated.js'],
    world: 'ISOLATED',
    injectImmediately: true
  })
]);

/* enable or disable */
const activate = () => {
  if (activate.busy) {
    return;
  }
  activate.busy = true;

  chrome.storage.local.get({
    enabled: true,
    hosts: []
  }, async prefs => {
    try {
      await chrome.scripting.unregisterContentScripts();

      if (prefs.enabled && prefs.hosts.length) {
        const props = {
          'allFrames': true,
          'matchOriginAsFallback': true,
          'runAt': 'document_start'
        };
        if (prefs.hosts.includes('*')) {
          props['matches'] = ['*://*/*'];
        }
        else {
          props['matches'] = prefs.hosts.map(h => '*://' + h + '/*');
        }

        await chrome.scripting.registerContentScripts([{
          ...props,
          'id': 'main',
          'js': ['data/inject/main.js'],
          'world': 'MAIN'
        }, {
          ...props,
          'id': 'isolated',
          'js': ['data/inject/isolated.js'],
          'world': 'ISOLATED'
        }]);
      }
    }
    catch (e) {
      notify(undefined, 'Blocker Registration Failed: ' + e.message);
      console.error('Blocker Registration Failed', e);
    }
    for (const c of activate.actions) {
      c();
    }
    activate.actions.length = 0;
    activate.busy = false;
  });
};
chrome.runtime.onStartup.addListener(activate);
chrome.runtime.onInstalled.addListener(activate);
chrome.storage.onChanged.addListener(ps => {
  if (ps.badge) {
    badge = ps.badge.newValue;
  }
  if (ps.enabled || ps.hosts) {
    activate();
  }
});
activate.actions = [];

/* action */
chrome.action.onClicked.addListener(tab => chrome.storage.local.get({
  hosts: [],
  enabled: true,
  badge: true,
  reload: false
}, async prefs => {
  if (!tab.url?.startsWith('http')) {
    return notify(tab.id, 'Tab does not have a valid hostname');
  }

  const {enabled, badge, reload: legacy} = prefs;
  let hosts = prefs.hosts.slice();

  const a = await chrome.scripting.executeScript({
    target: {
      tabId: tab.id,
      allFrames: true
    },
    world: 'ISOLATED',
    func: () => ({
      hostname: location.hostname,
      /* one marker on the ISOLATED world's global object; set by the
         registered content script of this same extension in the same frame */
      protected: self.PROTECTED === true
    }),
    injectImmediately: true
  }).catch(e => [{
    result: {
      hostname: urlHost(tab.url),
      protected: false
    },
    frameId: 0
  }]);

  const hostnames = (a || []).map(o => o.result?.hostname).filter((s, i, l) => s && l.indexOf(s) === i);
  const topEntry = (a || []).find(o => o.frameId === 0) || a[0] || {};
  const top = topEntry.result?.hostname;
  if (!top) {
    return notify(tab.id, 'Cannot find the hostname of this tab');
  }
  const topProtected = topEntry.result?.protected === true;

  // removing from the list; both a listed host (covered) and a protected page
  // (the list entry might be a wildcard like *.example.com, or the doc is an
  // old session-restored tab) count as "on"
  if (topProtected || hosts.some(h => matchesHost(top, h))) {
    for (const hostname of hostnames) {
      hosts = hosts.filter(h => !matchesHost(hostname, h));
    }
  }
  // adding to the list; skip hosts already covered by an existing entry
  else {
    for (const hostname of hostnames) {
      if (!hosts.some(h => matchesHost(hostname, h))) {
        hosts.push(hostname);
      }
    }
  }

  const active = enabled && hosts.some(h => matchesHost(top, h));
  let title = i18n(active ? 'action_title_enabled' : 'action_title_disabled', top);
  if (hosts.includes('*')) {
    title += '\n' + i18n('title_star_note');
  }

  validate(hosts).then(async error => {
    if (error) {
      return notify(tab.id, error);
    }

    if (legacy) { // previous behavior; reload destroys the unsaved state
      activate.actions.push(() => chrome.tabs.reload(tab.id));
      chrome.storage.local.set({hosts}); // triggers activate(); drains activate.actions
      return;
    }

    chrome.storage.local.set({hosts}); // triggers activate();

    if (active) {
      try {
        await applyNow(tab.id);
      }
      catch (e) {
        console.error('[Always Active]', 'Immediate injection failed; reloading the tab', e);
        paint(tab.id, badge ? 'ON' : '', COLORS.on, title);
        chrome.tabs.reload(tab.id);
        return;
      }
      /* the script is running now; it has already reported its ON state */
      paint(tab.id, badge ? 'R' : '', COLORS.on, title + '\n' + i18n('action_title_reload_recommended'));
      askReload(tab.id, 'prompt_reload_recommended', 'reload-recommended');
    }
    else { // the host is removed; the open page keeps its protection until it is reloaded
      if (topProtected) {
        paint(tab.id, badge ? 'R' : '', COLORS.off, title + '\n' + i18n('action_title_reload_required'));
        askReload(tab.id, 'prompt_reload_required', 'reload-required');
      }
      else {
        paint(tab.id, badge ? 'OFF' : '', COLORS.off, title);
      }
    }
  });
}));

/* messaging */
chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'check') {
    log('check event from', sender.tab);
  }
  else if (request.method === 'change') {
    log('page visibility state is changed', sender.tab);
  }
  else if (request.method === 'set-icon') {
    if (sender.tab?.id) {
      chrome.action.setIcon({
        tabId: sender.tab.id,
        path: {
          '16': '/data/icons/16.png',
          '32': '/data/icons/32.png',
          '48': '/data/icons/48.png'
        }
      });
      const hostname = request.hostname || urlHost(sender.url) || '';
      if (hostname) {
        paint(sender.tab.id, badge ? 'ON' : '', COLORS.on, i18n('action_title_enabled', hostname));
      }
    }
  }
  else if (request.method === 'reload-required' || request.method === 'reload-recommended') {
    log('reload request from', sender.tab);
    if (sender.tab?.id) {
      if (request.method === 'reload-required') {
        /* paint the post-reload state before starting the reload */
        chrome.storage.local.get({badge: true}, ({badge}) => paint(
          sender.tab.id,
          badge ? 'OFF' : '',
          COLORS.off,
          i18n('action_title_disabled', request.hostname || urlHost(sender.url) || '')
        ));
      }
      chrome.tabs.reload(sender.tab.id);
    }
  }
  else if (request.method === 'validate') {
    validate(request.hosts).then(message => response(message));
    return true;
  }
});

/* operation mode (for old users) */
const mode = ({reason}) => {
  // do not offer mode selection to the new users
  if (reason !== 'update') {
    chrome.storage.local.set({
      'mode-displayed': true
    });
    return;
  }

  chrome.storage.local.get({
    'mode-displayed': false,
    'hosts': []
  }, async prefs => {
    if (prefs['mode-displayed']) {
      return;
    }
    chrome.storage.local.set({
      'mode-displayed': true
    });
    // user already know how to deal with the change
    if (prefs.hosts.length) {
      return;
    }

    const width = 600;
    const height = 300;
    const win = await chrome.windows.getCurrent();

    chrome.windows.create({
      url: '/data/guide/index.html',
      width,
      height,
      left: win.left + Math.round((win.width - width) / 2),
      top: win.top + Math.round((win.height - height) / 2),
      type: 'popup'
    });
  });
};
chrome.runtime.onInstalled.addListener(mode);

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const {homepage_url: page, name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, lastFocusedWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
