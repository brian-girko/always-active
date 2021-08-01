'use strict';

const script = document.createElement('script');
script.addEventListener('change', () => chrome.runtime.sendMessage({
  method: 'change'
}));
script.addEventListener('check', () => chrome.runtime.sendMessage({
  method: 'check'
}));
script.textContent = `{
  const script = document.currentScript;
  const isFirefox = /Firefox/.test(navigator.userAgent) || typeof InstallTrigger !== 'undefined';

  const check = () => script.dispatchEvent(new Event('check'));
  const block = e => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    check();
  };

  /* visibility */
  Object.defineProperty(document, 'visibilityState', {
    get() {
      check();
      return 'visible';
    }
  });
  document.addEventListener('visibilitychange', e => script.dataset.visibility !== 'false' && block(e), true);
  document.addEventListener('webkitvisibilitychange', e => script.dataset.visibility !== 'false' && block(e), true);
  document.addEventListener('mozvisibilitychange', e => script.dataset.visibility !== 'false' && block(e), true);

  /* hidden */
  Object.defineProperty(document, 'hidden', {
    get() {
      check();
      return false;
    }
  });
  if (isFirefox) {
    Object.defineProperty(document, 'mozHidden', {
      get() {
        check();
        return false;
      }
    });
  }
  else {
    Object.defineProperty(document, 'webkitHidden', {
      get() {
        check();
        return false;
      }
    });
  }

  /* focus */
  document.addEventListener('hasFocus', e => script.dataset.focus !== 'false' && block(e), true);
  document.__proto__.hasFocus = function() {return true};

  /* blur */
  document.addEventListener('blur', e => script.dataset.blur !== 'false' && block(e), true);
  window.addEventListener('blur', e => script.dataset.blur !== 'false' && block(e), true);

  /* mouse*/
  window.addEventListener('mouseleave', e => script.dataset.mouseleave !== 'false' && block(e), true);
}`;
document.documentElement.appendChild(script);
script.remove();
const update = () => chrome.storage.local.get({
  'blur': true,
  'focus': true,
  'mouseleave': true,
  'visibility': true,
  'policies': {
    'docs.google.com': ['blur']
  }
}, prefs => {
  let hostname = location.hostname;
  try {
    hostname = parent.location.hostname;
  }
  catch (e) {}

  const policy = prefs.policies[hostname] || [];

  script.dataset.blur = policy.indexOf('blur') === -1 ? prefs.blur : false;
  script.dataset.focus = policy.indexOf('focus') === -1 ? prefs.focus : false;
  script.dataset.mouseleave = policy.indexOf('mouseleave') === -1 ? prefs.mouseleave : false;
  script.dataset.visibility = policy.indexOf('visibility') === -1 ? prefs.visibility : false;
});
update();
chrome.storage.onChanged.addListener(update);
