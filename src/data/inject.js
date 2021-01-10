'use strict';

const script = document.createElement('script');
script.addEventListener('change', () => chrome.runtime.emit({
  method: 'change'
}));
script.addEventListener('check', () => chrome.runtime.emit({
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
    document.addEventListener('blur', block, true);
    window.addEventListener('blur', block, true);

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
  }
`;
document.documentElement.appendChild(script);
script.remove();
