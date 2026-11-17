/* Optional Google sign-in for a static site.
   The ID token is decoded in the browser to show a name and avatar; the watch
   journal keeps living in this browser's storage. */
(function () {
  const STORE = 'cinema-google-profile';
  const GSI_SRC = 'https://accounts.google.com/gsi/client';
  const config = window.CINEMA_AUTH || {};
  const clientId = typeof config.googleClientId === 'string' ? config.googleClientId.trim() : '';
  const listeners = new Set();
  let profile = read();
  let scriptPromise = null;
  let initialized = false;

  function read() {
    try {
      const raw = window.localStorage.getItem(STORE);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && parsed.sub ? parsed : null;
    } catch {
      return null;
    }
  }

  function save(next) {
    try {
      if (next) window.localStorage.setItem(STORE, JSON.stringify(next));
      else window.localStorage.removeItem(STORE);
    } catch {}
  }

  function emit() {
    for (const listener of listeners) {
      try { listener(profile); } catch {}
    }
  }

  function decode(credential) {
    try {
      const part = String(credential).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
      const json = decodeURIComponent(
        Array.prototype.map
          .call(window.atob(padded), (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const claims = JSON.parse(json);
      if (!claims || !claims.sub) return null;
      return {
        sub: String(claims.sub),
        email: String(claims.email || ''),
        name: String(claims.name || claims.given_name || ''),
        picture: String(claims.picture || '')
      };
    } catch {
      return null;
    }
  }

  function loadScript() {
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('gsi_load_failed'));
      document.head.appendChild(script);
    });
    return scriptPromise;
  }

  function initialize() {
    if (initialized || !clientId) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response) => {
        const next = decode(response && response.credential);
        if (!next) return;
        profile = next;
        save(next);
        emit();
      }
    });
    initialized = true;
  }

  function escape(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function signedInMarkup(current) {
    return (
      '<div class="auth-signed"><img class="auth-avatar" src="' + escape(current.picture) + '" alt="" width="44" height="44" referrerpolicy="no-referrer">' +
      '<div class="auth-identity"><b>' + escape(current.name || 'کاربر گوگل') + '</b><span>' + escape(current.email) + '</span></div></div>' +
      '<button type="button" class="auth-signout" id="google-signout">خروج از حساب گوگل</button>'
    );
  }

  function mount(node, options) {
    if (!node) return;
    const settings = options || {};
    const root = node;

    function paint() {
      root.innerHTML = '';
      if (profile) {
        root.className = 'auth-card is-signed';
        root.innerHTML = signedInMarkup(profile);
        const out = root.querySelector('#google-signout');
        if (out) {
          out.onclick = () => {
            profile = null;
            save(null);
            if (window.google && window.google.accounts && window.google.accounts.id) {
              window.google.accounts.id.disableAutoSelect();
            }
            paint();
            if (settings.onChange) settings.onChange(null);
          };
        }
        return;
      }

      root.className = 'auth-card';
      if (!clientId) {
        root.innerHTML =
          '<p class="auth-note">ورود با گوگل هنوز فعال نشده است. شناسهٔ کلاینت گوگل در فایل <code>auth-config.js</code> تنظیم شود.</p>';
        return;
      }

      root.innerHTML =
        '<div class="auth-intro"><b>ثبت‌نام با گوگل</b><span>با حساب گوگل وارد شو تا اسم و عکست روی این حساب ذخیره شود.</span>' +
        '<small>اطلاعات تماشا همچنان فقط در همین مرورگر می‌ماند.</small></div><div class="auth-button" id="google-button"></div>';
      const holder = root.querySelector('#google-button');
      loadScript()
        .then(() => {
          initialize();
          window.google.accounts.id.renderButton(holder, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text: 'continue_with',
            locale: 'fa',
            width: 260
          });
        })
        .catch(() => {
          root.innerHTML = '<p class="auth-note">بارگذاری ورود گوگل انجام نشد؛ اتصال اینترنت را بررسی کن و دوباره تلاش کن.</p>';
        });
    }

    paint();
    if (settings.onChange) listeners.add(settings.onChange);
  }

  window.CinemaAuth = {
    getProfile: () => profile,
    isConfigured: Boolean(clientId),
    mount,
    onChange(listener) {
      if (typeof listener === 'function') listeners.add(listener);
    },
    signOut() {
      profile = null;
      save(null);
      emit();
    }
  };
})();
