/* Offline shell, in-app install and an explicit update action. */
(() => {
  const install = document.getElementById('install-app');
  const offlineNote = document.getElementById('offline-note');
  const banner = document.getElementById('sw-update');
  const reload = document.getElementById('sw-update-reload');
  const later = document.getElementById('sw-update-later');
  let deferredPrompt = null;
  let waiting = null;
  let reloading = false;

  function syncConnection() {
    if (offlineNote) offlineNote.hidden = navigator.onLine !== false;
  }
  addEventListener('online', syncConnection);
  addEventListener('offline', syncConnection);
  syncConnection();

  addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (install) install.hidden = false;
  });
  addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (install) install.hidden = true;
  });
  if (install) {
    install.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      install.disabled = true;
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch {}
      deferredPrompt = null;
      install.hidden = true;
      install.disabled = false;
    });
  }

  if (!('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!secure) return;

  function show(worker) {
    waiting = worker;
    if (banner) banner.hidden = false;
  }
  function hide() {
    if (banner) banner.hidden = true;
  }

  if (reload) {
    reload.addEventListener('click', () => {
      if (!waiting) return;
      reloading = true;
      waiting.postMessage('skip-waiting');
    });
  }
  if (later) later.addEventListener('click', hide);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) location.reload();
  });

  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
    .then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) show(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) show(worker);
        });
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      });
    })
    .catch(() => {});
})();
