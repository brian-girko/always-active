const log = (...args) => chrome.storage.local.get({
  log: false
}, prefs => prefs.log && console.log(...args));

/* enable or disable */
const activate = () => {
  if (activate.busy) {
    return;
  }
  activate.busy = true;

  chrome.storage.local.get({
    enabled: true
  }, async prefs => {
    try {
      await chrome.scripting.unregisterContentScripts();

      if (prefs.enabled) {
        const props = {
          'matches': ['*://*/*'],
          'allFrames': true,
          'matchOriginAsFallback': true,
          'runAt': 'document_start'
        };
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
        chrome.action.setIcon({
          path: {
            '16': 'data/icons/16.png',
            '32': 'data/icons/32.png',
            '48': 'data/icons/48.png'
          }
        });
      }
      else {
        chrome.action.setIcon({
          path: {
            '16': 'data/icons/disabled/16.png',
            '32': 'data/icons/disabled/32.png',
            '48': 'data/icons/disabled/48.png'
          }
        });
      }
    }
    catch (e) {
      chrome.action.setBadgeBackgroundColor({color: '#b16464'});
      chrome.action.setBadgeText({text: 'E'});
      chrome.action.setTitle({title: 'Blocker Registration Failed: ' + e.message});
      console.error('Blocker Registration Failed', e);
    }
    activate.busy = false;
  });
};
chrome.runtime.onStartup.addListener(activate);
chrome.runtime.onInstalled.addListener(activate);
chrome.storage.onChanged.addListener(ps => {
  if (ps.enabled) {
    activate();
  }
});

/* action */
chrome.action.onClicked.addListener(tab => chrome.storage.local.get({
  enabled: true
}, prefs => {
  chrome.storage.local.set({
    enabled: prefs.enabled === false
  }, () => chrome.tabs.reload(tab.id));
}));

/* messaging */
chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.method === 'check') {
    log('check event from', sender.tab);
  }
  else if (request.method === 'change') {
    log('page visibility state is changed', sender.tab);
  }
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
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
