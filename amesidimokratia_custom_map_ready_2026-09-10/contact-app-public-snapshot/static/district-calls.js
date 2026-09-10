(() => {
  'use strict';
  const select = document.getElementById('citizen-district');
  const status = document.getElementById('district-call-status');
  const host = document.getElementById('district-call-host');
  const external = document.getElementById('district-call-external');
  if (!select || !status || !host || !external) return;

  // Widget destinations are configured in Zadarma, not inferred from SIP IDs.
  // Keep unconfigured districts explicit; never send them to the Pafos widget.
  const widgets = {
  "pafos": {
    "url": "/static/district-call-pafos.html?v=20260910-3",
    "name": "Πάφος",
    "office": "Επαρχιακό γραφείο Πάφου",
    "action": "Κλήση στην Πάφο"
  },
  "limassol": {
    "url": "/static/district-call-limassol.html?v=20260910-3",
    "name": "Λεμεσός",
    "office": "Επαρχιακό γραφείο Λεμεσού",
    "action": "Κλήση στη Λεμεσό"
  },
  "nicosia": {
    "url": "/static/district-call-nicosia.html?v=20260910-3",
    "name": "Λευκωσία",
    "office": "Επαρχιακό γραφείο Λευκωσίας",
    "action": "Κλήση στη Λευκωσία"
  },
  "larnaca": {
    "url": "/static/district-call-larnaca.html?v=20260910-3",
    "name": "Λάρνακα",
    "office": "Επαρχιακό γραφείο Λάρνακας",
    "action": "Κλήση στη Λάρνακα"
  },
  "famagusta": {
    "url": "/static/district-call-famagusta.html?v=20260910-3",
    "name": "Αμμόχωστος",
    "office": "Επαρχιακό γραφείο Αμμοχώστου",
    "action": "Κλήση στην Αμμόχωστο"
  }
};
  const hint = document.getElementById('district-call-hint');
  const policy = document.permissionsPolicy || document.featurePolicy;
  const microphoneBlocked = policy && !policy.allowsFeature('microphone');
  function showExternalCall() {
    host.replaceChildren();
    external.classList.add('district-call-primary');
    external.textContent = widgets[select.value].action + ' ↗';
    hint.hidden = false;
  }
  window.addEventListener('message', event => {
    const frame = host.querySelector('iframe');
    if (event.origin === location.origin && event.source === frame?.contentWindow && event.data?.type === 'caiprus-microphone-blocked') showExternalCall();
  });
  let previous = '';
  select.addEventListener('change', () => {
    const oldFrame = host.querySelector('iframe');
    const activeCall = oldFrame?.contentDocument?.querySelector('.callme--connecting, .callme--speaking');
    if (activeCall && !window.confirm('Η αλλαγή επαρχίας θα τερματίσει την τρέχουσα κλήση. Συνέχεια;')) {
      select.value = previous;
      return;
    }
    previous = select.value;
    host.replaceChildren();
    external.hidden = true;
    hint.hidden = true;
    external.classList.remove('district-call-primary');
    external.removeAttribute('href');
    const widget = widgets[select.value];
    const url = widget?.url;
    if (!url) {
      status.textContent = !select.value
        ? 'Επιλέξτε επαρχία για να δείτε τις επιλογές κλήσης.'
        : select.value === 'kyrenia'
          ? 'Για την Κερύνεια, επικοινωνήστε μαζί μας με μήνυμα.'
          : 'Οι κλήσεις για αυτή την επαρχία δεν είναι ακόμη διαθέσιμες. Μπορείτε να στείλετε μήνυμα.';
      return;
    }
    status.textContent = widget.office;
    external.href = url;
    external.hidden = false;
    external.innerHTML = 'Άνοιγμα σε νέα καρτέλα <span aria-hidden="true">↗</span>';
    if (microphoneBlocked) { showExternalCall(); return; }
    const frame = document.createElement('iframe');
    frame.title = 'Τηλεφωνική επικοινωνία — ' + widget.name;
    frame.allow = 'microphone; autoplay';
    frame.src = url;
    host.appendChild(frame);
    external.href = url;
    external.hidden = false;
  });
})();
