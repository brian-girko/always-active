const toast = document.getElementById('toast');
const hostsBox = document.getElementById('hosts');
const allSites = document.getElementById('all-sites');

const syncAllSites = () => {
  allSites.checked = hostsBox.value.split(/\s*,\s*/).some(h => h === '*');
};

allSites.addEventListener('change', () => {
  const list = hostsBox.value.split(/\s*,\s*/).filter(h => h && h !== '*');
  if (allSites.checked) {
    list.push('*');
  }
  hostsBox.value = list.join(', ');
});
hostsBox.addEventListener('input', syncAllSites);

const notify = (message, timeout = 1000) => {
  toast.textContent = message;
  clearTimeout(notify.id);
  notify.id = setTimeout(() => toast.textContent = '', timeout);
};

chrome.storage.local.get({
  'visibilityState': true,
  'hidden': true,
  'blur': true,
  'focus': true,
  'redirect': true,
  'visibility': true,
  'pointercapture': true,
  'mouseleave': true,
  'mouseout': true,
  'log': false,
  'faqs': true,
  'badge': true,
  'reload': false,
  'policies': null,
  'hosts': []
}, prefs => {
  document.getElementById('visibilityState').checked = prefs.visibilityState;
  document.getElementById('hidden').checked = prefs.hidden;
  document.getElementById('focus').checked = prefs.focus;
  document.getElementById('redirect').checked = prefs.redirect;
  document.getElementById('visibility').checked = prefs.visibility;
  document.getElementById('pointercapture').checked = prefs.pointercapture;
  document.getElementById('blur').checked = prefs.blur;
  document.getElementById('mouseleave').checked = prefs.mouseleave;
  document.getElementById('mouseout').checked = prefs.mouseout;
  document.getElementById('log').checked = prefs.log;
  document.getElementById('faqs').checked = prefs.faqs;
  document.getElementById('badge').checked = prefs.badge;
  document.getElementById('reload').checked = prefs.reload;
  document.getElementById('policies').value = prefs.policies ? JSON.stringify(prefs.policies, null, '  ') : '';
  hostsBox.value = prefs.hosts.join(', ');
  syncAllSites();

  if (typeof navigation === 'undefined') {
    document.getElementById('redirect').checked = false;
    document.getElementById('redirect-container').classList.add('disabled');
  }
});


document.getElementById('save').addEventListener('click', async () => {
  const prefs = {
    'visibilityState': document.getElementById('visibilityState').checked,
    'hidden': document.getElementById('hidden').checked,
    'blur': document.getElementById('blur').checked,
    'mouseleave': document.getElementById('mouseleave').checked,
    'mouseout': document.getElementById('mouseout').checked,
    'visibility': document.getElementById('visibility').checked,
    'pointercapture': document.getElementById('pointercapture').checked,
    'focus': document.getElementById('focus').checked,
    'redirect': document.getElementById('redirect').checked,
    'log': document.getElementById('log').checked,
    'faqs': document.getElementById('faqs').checked,
    'badge': document.getElementById('badge').checked,
    'reload': document.getElementById('reload').checked
  };

  let policies = null;
  if (document.getElementById('policies').value) {
    try {
      policies = JSON.parse(document.getElementById('policies').value);
      document.getElementById('policies').value = JSON.stringify(policies, null, '  ');
    }
    catch (e) {
      console.error(e);
      return notify('Policies Error: ' + e.message);
    }
  }
  prefs.policies = policies;

  const hosts = [];
  for (const h of document.getElementById('hosts').value.split(/\s*,\s*/)) {
    const msg = await chrome.runtime.sendMessage({
      method: 'validate',
      hosts: [h]
    });
    if (!msg) {
      hosts.push(h);
    }
    else {
      console.info('Host is not valid', h, msg);
      notify(h + ': ' + msg);
    }
  }
  // test all
  const msg = await chrome.runtime.sendMessage({
    method: 'validate',
    hosts
  });
  if (msg) {
    notify(msg);
  }
  else {
    prefs.hosts = hosts;
    hostsBox.value = hosts.join(', ');
    syncAllSites();
    await chrome.storage.local.set(prefs);
    notify('Options saved');
  }
});

// reset
document.getElementById('reset').addEventListener('click', e => {
  if (e.detail === 1) {
    notify('Double-click to reset!');
  }
  else {
    localStorage.clear();
    chrome.storage.local.clear(() => {
      chrome.runtime.reload();
      window.close();
    });
  }
});

// support
document.getElementById('support').addEventListener('click', () => chrome.tabs.create({
  url: chrome.runtime.getManifest().homepage_url + '?rd=donate'
}));

// report
document.getElementById('report').addEventListener('click', () => chrome.tabs.create({
  url: chrome.runtime.getManifest().homepage_url + '#reviews'
}));

// test
document.getElementById('test').addEventListener('click', () => chrome.tabs.create({
  url: 'https://webbrowsertools.com/test-always-active/'
}));

// links
const links = window.links = (d = document) => {
  for (const a of [...d.querySelectorAll('[data-href]')]) {
    if (a.hasAttribute('href') === false) {
      a.href = chrome.runtime.getManifest().homepage_url + '#' + a.dataset.href;
    }
  }
};
document.addEventListener('DOMContentLoaded', () => links());
