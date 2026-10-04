const log = (...args) => chrome.storage.local.get({
  log: false
}, prefs => prefs.log && console.log(...args));

const i18n = (...args) => chrome.i18n.getMessage(...args) || '';

const notify = async (tabId, title, symbol = '!') => {
  tabId = tabId || (await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  }))[0].id;

  chrome.action.setBadgeText({
    tabId,
    text: symbol
  });
  chrome.action.setTitle({
    tabId,
    title
  });
};

/* non-visual state indication (accessibility) */
const setState = async tab => {
  if (!tab?.id) {
    return;
  }
  let hostname = '';
  if (tab.url?.startsWith('http')) {
    try {
      const a = await chrome.scripting.executeScript({
        target: {
          tabId: tab.id,
          allFrames: true
        },
        func: () => location.hostname,
        injectImmediately: true
      });
      hostname = ((a || []).find(o => o.frameId === 0) || (a || [])[0] || {}).result || new URL(tab.url).hostname;
    }
    catch (e) {
      try {
        hostname = new URL(tab.url).hostname;
      }
      catch (e) {}
    }
  }

  if (!hostname) {
    chrome.action.setBadgeText({tabId: tab.id, text: ''});
    chrome.action.setTitle({tabId: tab.id, title: i18n('action_title_unknown')});
    return;
  }
  const {hosts, enabled, badge} = await chrome.storage.local.get({
    enabled: true,
    badge: true,
    hosts: []
  });
  const active = enabled && (hosts.includes('*') || hosts.includes(hostname));
  const text = badge ? (active ? 'ON' : 'OFF') : '';
  chrome.action.setBadgeText({tabId: tab.id, text});
  chrome.action.setBadgeBackgroundColor({tabId: tab.id, color: active ? [27, 94, 32, 255] : [176, 24, 24, 255]});
  chrome.action.setTitle({tabId: tab.id, title: i18n(active ? 'action_title_enabled' : 'action_title_disabled', hostname)});
};

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
  if (ps.enabled || ps.hosts) {
    activate();
  }
});
activate.actions = [];

/* action */
chrome.action.onClicked.addListener(tab => chrome.storage.local.get({
  hosts: []
}, async prefs => {
  if (tab.url?.startsWith('http')) {
    const {hosts} = prefs;

    const a = await chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        allFrames: true
      },
      func: () => location.hostname,
      injectImmediately: true
    }).catch(e => [{
      result: new URL(tab.url).hostname,
      frameId: 0
    }]);

    const hostnames = (a || []).map(o => o.result).filter((s, i, l) => s && l.indexOf(s) === i);
    const top = a.find(o => o.frameId === 0).result;

    if (top) {
      const n = hosts.indexOf(top);
      let message = '';
      // removing from the list
      if (n >= 0) {
        message = 'Removed the following hostnames:\n\n' + hostnames.join(', ') + '\n';
        // remove all hostnames from the list
        for (const hostname of hostnames) {
          const n = hosts.indexOf(hostname);
          if (n >= 0) {
            hosts.splice(n, 1);
          }
        }
      }
      // adding to the list
      else {
        message = 'Added the following hostnames:\n' + hostnames.join(', ') + '\n';
        for (const hostname of hostnames) {
          const n = hosts.indexOf(hostname);
          if (n < 0) {
            hosts.push(hostname);
          }
        }
      }
      validate(hosts).then(async error => {
        if (error) {
          notify(tab.id, error);
        }
        else {
          const active = hosts.includes('*') || hosts.includes(top);
          const {badge} = await chrome.storage.local.get({badge: true});
          // immediate non-visual feedback in the button's accessible label
          chrome.action.setBadgeText({tabId: tab.id, text: badge ? (active ? 'ON' : 'OFF') : ''});
          chrome.action.setBadgeBackgroundColor({
            tabId: tab.id,
            color: active ? [27, 94, 32, 255] : [176, 24, 24, 255]
          });
          let title = i18n(active ? 'action_title_enabled' : 'action_title_disabled', top);
          if (hosts.includes('*')) {
            title += '\n' + i18n('title_star_note');
          }
          chrome.action.setTitle({tabId: tab.id, title});
          activate.actions.push(() => chrome.tabs.reload(tab.id));
          chrome.storage.local.set({hosts});
        }
      });
    }
    else {
      notify(tab.id, 'Cannot find the hostname of this tab');
    }
  }
  else {
    notify(tab.id, 'Tab does not have a valid hostname');
  }
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
    chrome.action.setIcon({
      tabId: sender.tab.id,
      path: {
        '16': '/data/icons/16.png',
        '32': '/data/icons/32.png',
        '48': '/data/icons/48.png'
      }
    });
    setState(sender.tab);
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
