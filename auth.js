/* Cinema500 optional identity: personal journal remains local and independent. */
(() => {
  'use strict';
  if (window.CinemaAuth) return;
  const config = window.CINEMA500_FIREBASE_CONFIG;
  const configured = !!config && ['apiKey','authDomain','projectId','appId'].every(key =>
    typeof config[key] === 'string' && !!config[key].trim()
  );
  const state = {status: configured ? 'loading' : 'unconfigured', user: null};
  let auth, lib;
  const emit = () => window.dispatchEvent(new Event('cinema500-auth-changed'));
  const snapshot = () => ({
    status: state.status,
    user: state.user && {...state.user}
  });
  const requireService = () => {
    if (!auth || !lib) throw Object.assign(new Error('سرویس ورود هنوز آماده نیست.'), {code:'auth/not-ready'});
    return auth;
  };
  const mapUser = user => user ? ({
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    emailVerified: !!user.emailVerified,
    providers: (user.providerData || []).map(provider => provider.providerId)
  }) : null;

  window.CinemaAuth = {
    isConfigured: () => configured,
    getState: snapshot,
    async signUp(email,password) {
      const a = requireService();
      const result = await lib.createUserWithEmailAndPassword(a,email,password);
      try { await lib.sendEmailVerification(result.user); }
      catch (error) {
        throw Object.assign(new Error('حساب ساخته شد ولی ایمیل تأیید ارسال نشد. از گزینه «ارسال دوباره» استفاده کن.'), {
          code:'cinema/verification-send-failed', cause:error
        });
      }
    },
    signIn(email,password) {
      return lib.signInWithEmailAndPassword(requireService(),email,password);
    },
    googleSignIn() {
      if (window.Cinema500Android) {
        throw Object.assign(new Error('ورود گوگل در WebView اندروید مجاز نیست. برای حساب گوگل از سایت در مرورگر استفاده کن؛ ورود مستقیم اپ در نسخه بعد با روش بومی اضافه می‌شود.'),{code:'cinema/android-google-unavailable'});
      }
      const a = requireService();
      const provider = new lib.GoogleAuthProvider();
      provider.setCustomParameters({prompt:'select_account'});
      // Called directly from a click handler so browser popup permission is retained.
      return lib.signInWithPopup(a,provider);
    },
    signOut() {
      return lib.signOut(requireService());
    },
    async sendVerification() {
      const a = requireService();
      if (!a.currentUser) throw Object.assign(new Error('اول وارد حسابت شو.'),{code:'auth/not-logged-in'});
      return lib.sendEmailVerification(a.currentUser);
    },
    sendReset(email) {
      return lib.sendPasswordResetEmail(requireService(),email);
    },
    async refreshUser() {
      const a = requireService();
      if (!a.currentUser) return;
      await a.currentUser.reload();
      state.user = mapUser(a.currentUser);
      emit();
    },
    async deleteAccount() {
      const a = requireService();
      if (!a.currentUser) throw Object.assign(new Error('وارد حساب نشده‌ای.'),{code:'auth/not-logged-in'});
      await lib.deleteUser(a.currentUser);
      // The locally stored journal is NOT deleted without a separate user action.
    }
  };
  if (!configured) return;

  (async () => {
    // Pin a reviewed Firebase JS SDK version; no Firebase requests without config.
    const version = '13.1.0';
    const [{initializeApp}, authLib] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/' + version + '/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/' + version + '/firebase-auth.js')
    ]);
    lib = authLib;
    auth = lib.getAuth(initializeApp(config));
    lib.onAuthStateChanged(auth, user => {
      state.user = mapUser(user);
      state.status = user ? 'signed-in' : 'signed-out';
      emit();
    }, () => {
      state.status = 'error';
      emit();
    });
  })().catch(() => {
    state.status = 'error';
    emit();
  });
})();
