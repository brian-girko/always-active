document.getElementById('save').onclick = () => {
  if (document.getElementById('per-host').checked) {
    return window.close();
  }
  chrome.storage.local.get({
    hosts: []
  }, prefs => {
    prefs.hosts.push('*');
    prefs.hosts = prefs.hosts.filter((s, i, l) => s && l.indexOf(s) === i);
    chrome.storage.local.set(prefs, () => window.close());
  });
};

focus();
