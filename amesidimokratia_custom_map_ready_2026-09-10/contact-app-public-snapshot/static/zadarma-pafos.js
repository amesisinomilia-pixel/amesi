(() => {
  'use strict';
  if (window.parent !== window) document.body.classList.add('embedded');
  const status = document.getElementById('widget-status');
  const target = document.getElementById('myZadarmaCallmeWidget19647');
  const retry = document.getElementById('widget-retry');
  retry.addEventListener('click', () => location.reload());
  const policy = document.permissionsPolicy || document.featurePolicy;
  if (policy && !policy.allowsFeature('microphone')) {
    if (window.parent !== window) window.parent.postMessage({type:'caiprus-microphone-blocked'}, location.origin);
    status.textContent = 'Για χρήση του μικροφώνου, ανοίξτε την κλήση σε νέα καρτέλα από τον σύνδεσμο κάτω από αυτό το πλαίσιο.';
    return;
  }
  let timer;
  let finished = false;
  const observer = new MutationObserver(() => {
    if (target.classList.contains('z-callme-widget')) {
      finished = true;
      clearTimeout(timer);
      observer.disconnect();
      status.textContent = 'Πατήστε το κουμπί κλήσης και επιτρέψτε τη χρήση του μικροφώνου.';
      retry.hidden = true;
    }
  });
  observer.observe(target, { attributes: true, childList: true, subtree: true });
  function fail() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    observer.disconnect();
    target.hidden = true;
    status.textContent = 'Δεν ήταν δυνατή η φόρτωση της κλήσης. Δοκιμάστε ξανά ή στείλτε μήνυμα μέσω CaiPRUS.';
    retry.hidden = false;
  }
  timer = setTimeout(fail, 20000);
  const scripts = document.getElementById('zadarmaScripts');
  scripts.addEventListener('error', fail, true);
  const loader = document.createElement('script');
  loader.src = 'https://my.zadarma.com/callmewidget/v2.0.9/loader.js';
  scripts.appendChild(loader);
  window.addEventListener('load', () => {
    if (finished) return;
    try {
      // The vendor JSONP callbacks require this instance on window.
      window.myZadarmaCallmeWidget19647 = new ZadarmaCallmeWidget('myZadarmaCallmeWidget19647');
      window.myZadarmaCallmeWidget19647.create({
        widgetId: 'zstMgSEz14hjAkPnkbrkme3jdX7K69hzdnrc6JnbT9mPXVk924v37Zt6tau7Ur7xjGAt8t5114Yx3cBBFezu7svbuVR4RZez6eb0fa3d0622aa41eca2fa80cd346908',
        sipId: '588091_1', domElement: 'myZadarmaCallmeWidget19647'
      }, {
        shape: 'square', language: 'en', width: '0', dtmf: false,
        font: "'Trebuchet MS','Helvetica CY',sans-serif",
        color_call: 'rgb(255, 255, 255)', color_bg_call: 'rgb(126, 211, 33)', color_border_call: 'rgb(191, 233, 144)',
        is_custom_hover: 1, color_call_hover: 'rgb(255, 255, 255)', bg_call_hover: 'rgb(100, 167, 26)', border_call_hover: 'rgb(178, 211, 141)',
        color_connection: 'rgb(255, 255, 255)', color_bg_connection: 'rgb(33, 211, 166)', color_border_connection: 'rgb(144, 233, 211)',
        color_calling: 'rgb(255, 255, 255)', color_border_calling: 'rgb(255, 218, 128)', color_bg_calling: 'rgb(255, 181, 0)',
        color_ended: 'rgb(255, 255, 255)', color_bg_ended: 'rgb(164, 164, 164)', color_border_ended: 'rgb(210, 210, 210)'
      });
    } catch (_) { fail(); }
  }, { once: true });
})();
