/* Renders optional auth controls inside the existing local "حساب من" screen. */
(() => {
  'use strict';
  const service = () => window.CinemaAuth;
  let mode = 'login';
  let notice = '';
  let isBusy = false;
  const $ = id => document.getElementById(id);
  const errorText = error => {
    const messages = {
      'auth/email-already-in-use':'این ایمیل قبلاً ثبت‌نام کرده؛ از بخش ورود استفاده کن.',
      'auth/invalid-email':'نشانی ایمیل معتبر نیست.',
      'auth/weak-password':'رمز عبور ضعیفه؛ حداقل شش کاراکتر وارد کن.',
      'auth/invalid-credential':'ایمیل یا رمز عبور درست نیست.',
      'auth/wrong-password':'ایمیل یا رمز عبور درست نیست.',
      'auth/user-not-found':'ایمیل یا رمز عبور درست نیست.',
      'auth/too-many-requests':'تلاش زیادی انجام شده؛ بعداً دوباره امتحان کن.',
      'auth/network-request-failed':'اتصال اینترنت رو بررسی کن.',
      'auth/popup-closed-by-user':'پنجره ورود گوگل بسته شد.',
      'auth/popup-blocked':'مرورگر پنجره ورود گوگل رو مسدود کرد.',
      'auth/unauthorized-domain':'دامنه سایت در تنظیمات Firebase مجاز نشده.',
      'auth/operation-not-allowed':'این روش ورود هنوز در Firebase فعال نشده.',
      'auth/requires-recent-login':'برای حذف حساب، ابتدا خارج شو و دوباره وارد شو.',
      'auth/not-ready':'سرویس ورود هنوز آماده نیست.',
      'cinema/android-google-unavailable':'ورود گوگل داخل APK فعلی پشتیبانی نمی‌شه؛ می‌تونی با ایمیل وارد اپ بشی.'
    };
    return error?.code === 'cinema/verification-send-failed' ? error.message
      : messages[error?.code] || 'عملیات انجام نشد؛ اینترنت و تنظیمات حساب رو بررسی کن.';
  };
  const shell = html => '<section class="auth-panel" aria-label="ورود و ثبت‌نام">'+html+'</section>';
  const displayNotice = () => {
    const box = $('auth-notice');
    if (box) {
      box.textContent = notice;
      box.hidden = !notice;
    }
  };
  function updateHeader() {
    const state = service()?.getState();
    const accountButton = $('account');
    if (!accountButton) return;
    // Do not interpolate third-party names into HTML.
    const label = accountButton.querySelector('.account-auth-name');
    if (label) label.textContent = state?.user ? (state.user.displayName || state.user.email || 'حساب من') : 'حساب من';
  }
  const render = () => {
    const root = $('auth-root');
    const api = service();
    if (!root || !api) return;
    const state = api.getState();
    updateHeader();
    if (state.status === 'unconfigured') {
      root.innerHTML = shell('<h3>حساب آنلاین</h3><p>ثبت‌نام آنلاین هنوز فعال نشده. دفتر تماشای تو همچنان بدون حساب و فقط روی دستگاه ذخیره می‌شه.</p>');
      return;
    }
    if (state.status === 'loading') {
      root.innerHTML = shell('<p role="status">در حال اتصال به سرویس ورود…</p>');
      return;
    }
    if (state.status === 'error') {
      root.innerHTML = shell('<p role="alert">اتصال به حساب آنلاین ممکن نشد. دفتر تماشا و امکانات آفلاین همچنان در دسترس‌اند.</p><button type="button" id="auth-retry" class="auth-control">تلاش دوباره</button>');
      $('auth-retry').addEventListener('click',()=>location.reload());
      return;
    }
    if (state.user) {
      root.innerHTML = shell(
        '<h3>حساب آنلاین</h3><p>وارد شده‌ای: <strong id="auth-user-email" dir="ltr"></strong></p>'
        + (!state.user.emailVerified ? '<p class="auth-warning">ایمیل هنوز تأیید نشده. برای ثبت نظر عمومی در آینده باید ایمیل رو تأیید کنی.</p><div class="auth-actions"><button id="auth-verify" type="button" class="auth-control">ارسال دوباره ایمیل تأیید</button><button id="auth-refresh" type="button" class="auth-control">ایمیل رو تأیید کردم</button></div>' : '<p class="auth-success">حساب تأییدشده</p>')
        + '<div class="auth-actions"><button id="auth-signout" type="button" class="auth-control">خروج از حساب</button><button id="auth-delete" type="button" class="auth-control auth-danger">حذف حساب آنلاین</button></div>'
        + '<p id="auth-notice" role="status" hidden></p>'
        + '<p class="auth-disclaimer">یادداشت‌ها و لیست تماشای تو هنوز فقط روی همین دستگاه می‌مونن. ورود یا خروج اون‌ها رو پاک یا با دستگاه دیگری همگام نمی‌کنه.</p>'
      );
      $('auth-user-email').textContent = state.user.email || 'بدون ایمیل';
      $('auth-signout').addEventListener('click',()=>perform(()=>api.signOut(),'از حساب خارج شدی.'));
      $('auth-delete').addEventListener('click',()=> {
        if (!confirm('حساب آنلاین حذف بشه؟ دفتر تماشای محلی پاک نمی‌شه. این کار قابل برگشت نیست.')) return;
        perform(()=>api.deleteAccount(),'حساب آنلاین حذف شد. دفتر محلی دست‌نخورده باقی موند.');
      });
      if ($('auth-verify')) $('auth-verify').addEventListener('click',()=>perform(()=>api.sendVerification(),'ایمیل تأیید ارسال شد.'));
      if ($('auth-refresh')) $('auth-refresh').addEventListener('click',()=>perform(()=>api.refreshUser(),'وضعیت حساب بررسی شد.'));
      displayNotice();
      return;
    }
    const tabs = '<div class="auth-tabs" role="group" aria-label="روش ورود">'
      + '<button type="button" class="auth-tab" id="auth-tab-login" aria-pressed="'+(mode==='login')+'">ورود</button>'
      + '<button type="button" class="auth-tab" id="auth-tab-register" aria-pressed="'+(mode==='register')+'">ثبت‌نام</button></div>';
    const form = '<form id="auth-form">'
      + '<label for="auth-email">ایمیل</label><input id="auth-email" type="email" name="email" autocomplete="email" inputmode="email" required maxlength="254">'
      + (mode === 'reset' ? '' : '<label for="auth-password">رمز عبور</label><input id="auth-password" name="password" type="password" minlength="6" required autocomplete="'+(mode==='register'?'new-password':'current-password')+'">')
      + '<button type="submit" class="auth-submit">'+(mode==='register'?'ساخت حساب رایگان':mode==='reset'?'ارسال لینک بازیابی':'ورود با ایمیل')+'</button></form>';
    const google = mode === 'reset' ? '' : window.Cinema500Android
      ? '<p class="auth-disclaimer">ورود گوگل در APK فعلی هنوز فعال نیست؛ برای استفاده از اپ با ایمیل وارد شو.</p>'
      : '<button id="auth-google" type="button" class="auth-google">ورود با حساب گوگل</button>';
    root.innerHTML = shell('<h3>ورود و ثبت‌نام رایگان</h3>'
      + '<p>برای نظر دادن در نسخه بعد، حساب مخصوص خودت رو بساز.</p>'
      + tabs + form + google
      + (mode==='reset' ? '<button id="auth-back" type="button" class="auth-link">بازگشت به ورود</button>' : '<button id="auth-reset" type="button" class="auth-link">رمز عبور رو فراموش کردم</button>')
      + '<p id="auth-notice" role="status" hidden></p>'
      + '<p class="auth-disclaimer">حساب آنلاین فعلاً فقط برای ورود و ثبت‌نام است؛ دفتر تماشای قبلی محفوظ می‌مونه. <a href="./privacy.html">سیاست حریم خصوصی</a></p>'
    );
    $('auth-tab-login').addEventListener('click',()=>{mode='login';notice='';render()});
    $('auth-tab-register').addEventListener('click',()=>{mode='register';notice='';render()});
    $('auth-reset')?.addEventListener('click',()=>{mode='reset';notice='';render()});
    $('auth-back')?.addEventListener('click',()=>{mode='login';notice='';render()});
    $('auth-form').addEventListener('submit', event => {
      event.preventDefault();
      const email = $('auth-email').value.trim();
      const password = $('auth-password')?.value;
      if (mode === 'reset') perform(()=>api.sendReset(email),'اگر این ایمیل حساب داشته باشه، لینک بازیابی براش ارسال می‌شه.');
      else if (mode === 'register') perform(()=>api.signUp(email,password),'حساب ساخته شد. ایمیل تأیید رو بررسی کن.');
      else perform(()=>api.signIn(email,password),'با موفقیت وارد شدی.');
    });
    $('auth-google')?.addEventListener('click',()=>perform(()=>api.googleSignIn(),'با حساب گوگل وارد شدی.'));
    displayNotice();
  };
  async function perform(operation, successText) {
    if (isBusy) return;
    isBusy = true;
    const buttons = $('auth-root')?.querySelectorAll('button');
    buttons?.forEach(button=>{button.disabled=true});
    try {
      // Execute directly on the event turn before any unnecessary await (popup).
      await operation();
      notice = successText;
    } catch(error) {
      notice = errorText(error);
    } finally {
      isBusy = false;
      // Avoid replacing the current modal if the user navigated elsewhere.
      if ($('auth-root')) render();
    }
  }
  window.CinemaAuthUI = {render,updateHeader};
  window.addEventListener('cinema500-auth-changed',()=> {
    updateHeader();
    if ($('auth-root')) render();
  });
})();
