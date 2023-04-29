/* Tests:
  http://www2.stat.duke.edu/~cc248/jsphylosvg/js/yui/tests/event/tests/manual/window-focus-test.html
  https://page-visibility.vercel.app/
*/

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
  port.dataset.blur = policy.includes('blur') ? false : prefs.blur;
  port.dataset.focus = policy.includes('focus') ? false : prefs.focus;
  port.dataset.mouseleave = policy.includes('mouseleave') ? false : prefs.mouseleave;
  port.dataset.visibility = policy.includes('visibility') ? false : prefs.visibility;
});
update();
chrome.storage.onChanged.addListener(update);
