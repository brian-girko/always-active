const port = document.createElement('div');
port.id = 'lwys-ctv-port';
port.dataset.hidden = document.hidden;
port.dataset.enabled = true;
document.documentElement.appendChild(port);

port.addEventListener('state', () => {
  port.dataset.hidden = document.hidden;
});

const update = () => chrome.storage.local.get({
  'enabled': true,
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

  port.dataset.enabled = prefs.enabled;
  port.dataset.blur = policy.indexOf('blur') === -1 ? prefs.blur : false;
  port.dataset.focus = policy.indexOf('focus') === -1 ? prefs.focus : false;
  port.dataset.mouseleave = policy.indexOf('mouseleave') === -1 ? prefs.mouseleave : false;
  port.dataset.visibility = policy.indexOf('visibility') === -1 ? prefs.visibility : false;
});
update();
chrome.storage.onChanged.addListener(update);
