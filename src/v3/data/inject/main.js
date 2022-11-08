{
  const port = document.getElementById('lwys-ctv-port');
  port.remove();

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

  document.addEventListener('visibilitychange', e => {
    port.dispatchEvent(new Event('state'));
    if (port.dataset.enabled === 'true' && port.dataset.visibility !== 'false') {
      return block(e);
    }
  }, true);
  document.addEventListener('webkitvisibilitychange', e => {
    if (port.dataset.enabled === 'true' && port.dataset.visibility !== 'false') {
      return block(e);
    }
  }, true);
  window.addEventListener('pagehide', e => {
    if (port.dataset.enabled === 'true' && port.dataset.visibility !== 'false') {
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
        return block(e);
      }
    }
  };
  document.addEventListener('blur', onfocus, true);
  window.addEventListener('blur', onfocus, true);

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

  /* requestAnimationFrame */
  let lastTime = 0;
  window.requestAnimationFrame = new Proxy(window.requestAnimationFrame, {
    apply(target, self, args) {
      if (port.dataset.enabled === 'true' && port.dataset.hidden === 'true') {
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
      if (port.dataset.enabled === 'true' && port.dataset.hidden === 'true') {
        clearTimeout(args[0]);
      }
      return Reflect.apply(target, self, args);
    }
  });
}
