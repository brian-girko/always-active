'use strict';

const script = document.createElement('script');
script.addEventListener('change', () => chrome.runtime.sendMessage({
  method: 'change'
}));
script.addEventListener('check', () => chrome.runtime.sendMessage({
  method: 'check'
}));
script.textContent = `
  {
    const script = document.currentScript;

    const check = () => script.dispatchEvent(new Event('check'));

    Object.defineProperty(document, 'visibilityState', {
      get() {
        check();
        return 'visible';
      }
    });
    Object.defineProperty(document, 'hidden', {
      get() {
        check();
        return false;
      }
    });

    const block = e => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      script.dispatchEvent(new Event('change'));
    };
    document.addEventListener('visibilitychange', block, true);
    document.addEventListener('webkitvisibilitychange', block, true);
    document.addEventListener('mozvisibilitychange', block, true);
    document.addEventListener('hasFocus', block, true);
    document.__proto__.hasFocus = function() {return true};

    if (/Firefox/.test(navigator.userAgent)) {
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
    document.addEventListener('blur', e => script.dataset.blur !== 'false' && block(e), true);
    window.addEventListener('blur', e => script.dataset.blur !== 'false' && block(e), true);
    window.addEventListener('mouseleave', e => script.dataset.mouseleave !== 'false' && block(e), true);
  }
`;
document.documentElement.appendChild(script);
script.remove();
chrome.storage.local.get({
  'blur': true,
  'mouseleave': true
}, prefs => {
  script.dataset.blur = prefs.blur;
  script.dataset.mouseleave = prefs.mouseleave;
});
chrome.storage.onChanged.addListener(prefs => {
  if (prefs.blur) {
    script.dataset.blur = prefs.blur.newValue;
  }
  if (prefs.mouseleave) {
    script.dataset.mouseleave = prefs.mouseleave.newValue;
  }
});