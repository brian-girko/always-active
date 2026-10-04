/* global navigation */
{
  /* port is used to communicate between chrome and page scripts */
  let port;
  try {
    port = document.getElementById('lwys-ctv-port');
    port.remove();
  }
  catch (e) {
    port = document.createElement('span');
    port.id = 'lwys-ctv-port';
    document.documentElement.append(port);
  }

  const block = e => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  /* visibility */
  Object.defineProperty(document, 'visibilityState', {
    get() {
      if (port.dataset.enabled === 'false') {
        return port.dataset.hidden === 'true' ? 'hidden' : 'visible';
      }
      return 'visible';
    }
  });
  Object.defineProperty(document, 'webkitVisibilityState', {
    get() {
      if (port.dataset.enabled === 'false') {
        return port.dataset.hidden === 'true' ? 'hidden' : 'visible';
      }
      return 'visible';
    }
  });

  const vstate = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
  const cstate = vstate.get.call(document);
  const once = {
    focus: true,
    // if document is hidden allow one time event
    visibilitychange: cstate === 'hidden',
    webkitvisibilitychange: cstate === 'hidden'
  };

  /* prevent redirect when hidden */
  if (window.top === window && typeof navigation !== 'undefined') {
    // Save the original property descriptor
    const redirect = e => {
      if (redirect.href) {
        console.info('[Always Active]', 'an attempt to redirect is being blocked', redirect.href);
        e.preventDefault();
        e.returnValue = 'no';
      }
    };
    navigation.addEventListener('navigate', navigateEvent => {
      if (navigateEvent.navigationType === 'reload') {
        redirect.href = navigateEvent.destination.url;
      }
    });
    document.addEventListener('visibilitychange', e => {
      delete redirect.href;
      removeEventListener('beforeunload', redirect);
      try {
        const state = vstate.get.call(document);
        if (state === 'hidden') {
          if (port.dataset.enabled === 'true' && port.dataset.redirect !== 'false') {
            addEventListener('beforeunload', redirect);
          }
        }
      }
      catch (e) {}
    });
  }

  document.addEventListener('visibilitychange', e => {
    port.dispatchEvent(new Event('state'));
    if (port.dataset.enabled === 'true' && port.dataset.visibility !== 'false') {
      if (once.visibilitychange) {
        once.visibilitychange = false;
        return;
      }
      return block(e);
    }
  }, true);
  document.addEventListener('webkitvisibilitychange', e => {
    if (port.dataset.enabled === 'true' && port.dataset.visibility !== 'false') {
      if (once.webkitvisibilitychange) {
        once.webkitvisibilitychange = false;
        return;
      }
      return block(e);
    }
  }, true);
  window.addEventListener('pagehide', e => {
    if (port.dataset.enabled === 'true' && port.dataset.visibility !== 'false') {
      block(e);
    }
  }, true);

  /* pointercapture */
  window.addEventListener('lostpointercapture', e => {
    if (port.dataset.enabled === 'true' && port.dataset.pointercapture !== 'false') {
      block(e);
    }
  }, true);

  /* hidden */
  Object.defineProperty(document, 'hidden', {
    get() {
      if (port.dataset.enabled === 'false') {
        return port.dataset.hidden === 'true';
      }
      return false;
    }
  });
  Object.defineProperty(document, 'webkitHidden', {
    get() {
      if (port.dataset.enabled === 'false') {
        return port.dataset.hidden === 'true';
      }
      return false;
    }
  });

  /* focus */
  Document.prototype.hasFocus = new Proxy(Document.prototype.hasFocus, {
    apply(target, self, args) {
      if (port.dataset.enabled === 'true' && port.dataset.focus !== 'false') {
        return true;
      }
      return Reflect.apply(target, self, args);
    }
  });

  const onfocus = e => {
    if (port.dataset.enabled === 'true' && port.dataset.focus !== 'false') {
      if (e.target === document || e.target === window) {
        if (once.focus) {
          once.focus = false;
          return;
        }
        return block(e);
      }
    }
  };
  document.addEventListener('focus', onfocus, true);
  window.addEventListener('focus', onfocus, true);

  /* blur */
  const onblur = e => {
    if (port.dataset.enabled === 'true' && port.dataset.blur !== 'false') {
      if (e.target === document || e.target === window) {
        return block(e);
      }
    }
  };
  document.addEventListener('blur', onblur, true);
  window.addEventListener('blur', onblur, true);

  /* mouse */
  window.addEventListener('mouseleave', e => {
    if (port.dataset.enabled === 'true' && port.dataset.mouseleave !== 'false') {
      if (e.target === document || e.target === window) {
        return block(e);
      }
    }
  }, true);
  window.addEventListener('mouseout', e => {
    if (port.dataset.enabled === 'true' && port.dataset.mouseout !== 'false') {
      if (e.target === document.documentElement || e.target === document.body) {
        return block(e);
      }
    }
  }, true);

  /* fullscreen protection (optional): keeps the page believing it is still fullscreen
     after the browser force-exits fullscreen on a hidden tab. The option is off by default;
     until it is enabled, the script touches nothing at all (no listeners, no overwrites).
     Once enabled, while the page is visible the fullscreen events pass through and only
     the real state is recorded; while the page is hidden, the events are blocked and the
     recorded state is spoofed. Toggling the pref installs or fully removes the protection
     on the fly. */
  {
    /* original descriptors (captured before any overwrite; invisible to the page) */
    const fele = Object.getOwnPropertyDescriptor(Document.prototype, 'fullscreenElement');
    const wfele = Object.getOwnPropertyDescriptor(Document.prototype, 'webkitFullscreenElement');
    const target = fele || wfele;

    /* the recorded state (persists across the hidden period) */
    const real = {
      element: null
    };
    const realElement = () => {
      try {
        return target ? target.get.call(document) : null;
      }
      catch (e) {
        return null;
      }
    };
    const grab = () => {
      real.element = realElement();
    };

    const protectedState = () => port.dataset.enabled === 'true' &&
      port.dataset.fullscreen !== 'false' &&
      port.dataset.hidden === 'true';

    const element = () => protectedState() ? real.element : realElement();
    const bool = () => !!element();

    const onfullscreen = e => {
      /* always track the real state; block the page's handlers only while hidden */
      grab();
      if (protectedState()) {
        return block(e);
      }
    };
    const onfullscreenerror = e => {
      if (protectedState()) {
        return block(e);
      }
    };

    const install = () => {
      grab();
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: element
      });
      Object.defineProperty(document, 'webkitFullscreenElement', {
        configurable: true,
        get: element
      });
      Object.defineProperty(document, 'fullscreen', {
        configurable: true,
        get: bool
      });
      Object.defineProperty(document, 'webkitIsFullScreen', {
        configurable: true,
        get: bool
      });
      document.addEventListener('fullscreenchange', onfullscreen, true);
      document.addEventListener('webkitfullscreenchange', onfullscreen, true);
      window.addEventListener('fullscreenchange', onfullscreen, true);
      window.addEventListener('webkitfullscreenchange', onfullscreen, true);
      document.addEventListener('fullscreenerror', onfullscreenerror, true);
      document.addEventListener('webkitfullscreenerror', onfullscreenerror, true);
      window.addEventListener('fullscreenerror', onfullscreenerror, true);
      window.addEventListener('webkitfullscreenerror', onfullscreenerror, true);

      install.active = true;
    };
    const uninstall = () => {
      document.removeEventListener('fullscreenchange', onfullscreen, true);
      document.removeEventListener('webkitfullscreenchange', onfullscreen, true);
      window.removeEventListener('fullscreenchange', onfullscreen, true);
      window.removeEventListener('webkitfullscreenchange', onfullscreen, true);
      document.removeEventListener('fullscreenerror', onfullscreenerror, true);
      document.removeEventListener('webkitfullscreenerror', onfullscreenerror, true);
      window.removeEventListener('fullscreenerror', onfullscreenerror, true);
      window.removeEventListener('webkitfullscreenerror', onfullscreenerror, true);
      for (const prop of ['fullscreenElement', 'webkitFullscreenElement', 'fullscreen', 'webkitIsFullScreen']) {
        delete document[prop];
      }
      real.element = null;

      install.active = false;
    };

    /* the decision is delivered by the ISOLATED world through the port element;
       until it arrives (or unless it is "true"), nothing is installed */
    const toggle = () => {
      if (port.dataset.fullscreen === 'true' && !install.active) {
        install();
      }
      else if (port.dataset.fullscreen !== 'true' && install.active) {
        uninstall();
      }
    };
    const check = () => {
      toggle();
      if (port.dataset.fullscreen === undefined) {
        setTimeout(check, 4);
      }
    };
    check();

    /* live install/uninstall when the pref (or a per-host policy) changes */
    port.addEventListener('fs', toggle);
  }

  /* requestAnimationFrame */
  let lastTime = 0;
  window.requestAnimationFrame = new Proxy(window.requestAnimationFrame, {
    apply(target, self, args) {
      if (port.dataset.enabled === 'true' && port.dataset.hidden === 'true') {
        const currTime = Date.now();
        const timeToCall = Math.max(0, 16 - (currTime - lastTime));
        const id = setTimeout(function() {
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
      if (port.dataset.enabled === 'true' && port.dataset.hidden === 'true') {
        clearTimeout(args[0]);
      }
      return Reflect.apply(target, self, args);
    }
  });
}

''
