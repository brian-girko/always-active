'use strict';

const script = document.createElement('script');
script.dataset.hidden = document.hidden;
script.addEventListener('state', () => {
  script.dataset.hidden = document.hidden;
});

script.textContent = `{
  const script = document.currentScript;
  const isFirefox = /Firefox/.test(navigator.userAgent) || typeof InstallTrigger !== 'undefined';

  const block = e => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  const once = {
    focus: true,
    visibilitychange: true,
    webkitvisibilitychange: true
  };

  /* visibility */
  Object.defineProperty(document, 'visibilityState', {
    get() {
      return 'visible';
    }
  });
  if (isFirefox === false) {
    Object.defineProperty(document, 'webkitVisibilityState', {
      get() {
        return 'visible';
      }
    });
  }
  document.addEventListener('visibilitychange', e => {
    script.dispatchEvent(new Event('state'));
    if (script.dataset.visibility !== 'false') {
      if (once.visibilitychange) {
        once.visibilitychange = false;
        return;
      }
      return block(e);
    }
  }, true);
  document.addEventListener('webkitvisibilitychange', e => {
    if (script.dataset.visibility !== 'false') {
      if (once.webkitvisibilitychange) {
        once.webkitvisibilitychange = false;
        return;
      }
      return block(e);
    }
  }, true);


  window.addEventListener('pagehide', e => script.dataset.visibility !== 'false' && block(e), true);

  /* hidden */
  Object.defineProperty(document, 'hidden', {
    get() {
      return false;
    }
  });
  Object.defineProperty(document, isFirefox ? 'mozHidden' : 'webkitHidden', {
    get() {
      return false;
    }
  });

  /* focus */
  Document.prototype.hasFocus = new Proxy(Document.prototype.hasFocus, {
    apply(target, self, args) {
      if (script.dataset.focus !== 'false') {
        return true;
      }
      return Reflect.apply(target, self, args);
    }
  });

  const onfocus = e => {
    console.log(1);
    if (script.dataset.focus !== 'false') {
      if (e.target === document || e.target === window) {
        if (once.focus && document.readyState === 'complete' && e.target === window) {
          once.focus = false;
          return;
        }
        return block(e);
      }
    }
  };
  // document.addEventListener('focus', onfocus, true);
  window.addEventListener('focus', onfocus, true);


  /* blur */
  const onblur = e => {
    if (script.dataset.blur !== 'false') {
      if (e.target === document || e.target === window) {
        return block(e);
      }
    }
  };
  document.addEventListener('blur', onblur, true);
  window.addEventListener('blur', onblur, true);

  /* mouse */
  window.addEventListener('mouseleave', e => {
    if (script.dataset.mouseleave !== 'false') {
      if (e.target === document || e.target === window) {
        return block(e);
      }
    }
  }, true);

  /* requestAnimationFrame */
  let lastTime = 0;
  window.requestAnimationFrame = new Proxy(window.requestAnimationFrame, {
    apply(target, self, args) {
      if (script.dataset.hidden === 'true') {
        const currTime = Date.now();
        const timeToCall = Math.max(0, 16 - (currTime - lastTime));
        const id = window.setTimeout(function() {
          args[0](performance.now());
        }, timeToCall);
        lastTime = currTime + timeToCall;
        return id;
      }
      else {
        return Reflect.apply(target, self, args);
      }
    }
  });
  window.cancelAnimationFrame = new Proxy(window.cancelAnimationFrame, {
    apply(target, self, args) {
      if (script.dataset.hidden === 'true') {
        clearTimeout(args[0]);
      }
      return Reflect.apply(target, self, args);
    }
  });
}`;
document.documentElement.appendChild(script);
script.remove();
const update = () => chrome.storage.local.get({
  'blur': true,
  'focus': true,
  'mouseleave': true,
  'visibility': true,
  'policies': null
}, prefs => {
  let hostname = location.hostname;
  try {
    hostname = parent.location.hostname;
  }
  catch (e) {}

  prefs.policies = prefs.policies ?? {};
  const policy = prefs.policies[hostname] || [];

  script.dataset.blur = policy.indexOf('blur') === -1 ? prefs.blur : false;
  script.dataset.focus = policy.indexOf('focus') === -1 ? prefs.focus : false;
  script.dataset.mouseleave = policy.indexOf('mouseleave') === -1 ? prefs.mouseleave : false;
  script.dataset.visibility = policy.indexOf('visibility') === -1 ? prefs.visibility : false;
});
update();
chrome.storage.onChanged.addListener(update);
