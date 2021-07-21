const toast = document.getElementById('toast');

chrome.storage.local.get({
  'visibilityState': true,
  'hidden': true,
  'blur': true,
  'mouseleave': true
}, prefs => {
  document.getElementById('visibilityState').checked = prefs.visibilityState;
  document.getElementById('hidden').checked = prefs.hidden;
  document.getElementById('blur').checked = prefs.blur;
  document.getElementById('mouseleave').checked = prefs.mouseleave;
});

document.getElementById('save').addEventListener('click', () => chrome.storage.local.set({
  'visibilityState': document.getElementById('visibilityState').checked,
  'hidden': document.getElementById('hidden').checked,
  'blur': document.getElementById('blur').checked,
  'mouseleave': document.getElementById('mouseleave').checked
}, () => {
  toast.textContent = 'Options Saved';
  setTimeout(() => toast.textContent = '', 1000);
}));
// reset
document.getElementById('reset').addEventListener('click', e => {
  if (e.detail === 1) {
    toast.textContent = 'Double-click to reset!';
    window.setTimeout(() => toast.textContent = '', 750);
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
