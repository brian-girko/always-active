'use strict';

const script = document.createElement('script');
script.textContent = `
  Object.defineProperty(document, 'visibilityState', {
    get() {
      return 'visible';
    }
  });
  Object.defineProperty(document, 'hidden', {
    get() {
      return false;
    }
  });
  {
    const block = e => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    document.addEventListener('visibilitychange', block, true);
    document.addEventListener('webkitvisibilitychange', block, true);
    document.addEventListener('mozvisibilitychange', block, true);
  }
  if (/Firefox/.test(navigator.userAgent)) {
    Object.defineProperty(document, 'mozHidden', {
      get() {
        return false;
      }
    });
  }
  else {
    Object.defineProperty(document, 'webkitHidden', {
      get() {
        return false;
      }
    });
  }
`;
document.documentElement.appendChild(script);
script.remove();
