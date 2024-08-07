const toast = document.getElementById('toast');

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
  'visibility': true,
  'pointercapture': true,
  'mouseleave': true,
  'log': false,
  'faqs': true,
  'policies': null,
  'hosts': []
}, prefs => {
  document.getElementById('visibilityState').checked = prefs.visibilityState;
  document.getElementById('hidden').checked = prefs.hidden;
  document.getElementById('focus').checked = prefs.focus;
  document.getElementById('visibility').checked = prefs.visibility;
  document.getElementById('pointercapture').checked = prefs.pointercapture;
  document.getElementById('blur').checked = prefs.blur;
  document.getElementById('mouseleave').checked = prefs.mouseleave;
  document.getElementById('log').checked = prefs.log;
  document.getElementById('faqs').checked = prefs.faqs;
  document.getElementById('policies').value = prefs.policies ? JSON.stringify(prefs.policies, null, '  ') : '';
  document.getElementById('hosts').value = prefs.hosts.join(', ');
});

document.getElementById('save').addEventListener('click', () => {
  const prefs = {
    'visibilityState': document.getElementById('visibilityState').checked,
    'hidden': document.getElementById('hidden').checked,
    'blur': document.getElementById('blur').checked,
    'mouseleave': document.getElementById('mouseleave').checked,
    'visibility': document.getElementById('visibility').checked,
    'pointercapture': document.getElementById('pointercapture').checked,
    'focus': document.getElementById('focus').checked,
    'log': document.getElementById('log').checked,
    'faqs': document.getElementById('faqs').checked
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
    if (h === '*') {
      hosts.push(h);
    }
    else {
      try {
        const href = h.toLowerCase().startsWith('http') ? h : 'http://' + h + '/';
        const {hostname} = new URL(href);
        hosts.push(hostname);
      }
      catch (e) {}
    }
  }

  chrome.runtime.sendMessage({
    method: 'validate',
    hosts
  }, message => {
    if (message) {
      notify(message);
    }
    else {
      prefs.hosts = hosts;
      document.getElementById('hosts').value = hosts.join(', ');
      chrome.storage.local.set(prefs, () => {
        notify('Options saved');
      });
    }
  });
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
