(() => {
  const config = window.CINEMA_AUTH_CONFIG || {};
  const enabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl || '') && /^(sb_publishable_|eyJ)/.test(config.supabasePublishableKey || '');
  const listeners = new Set();
  let client, sequence = 0;
  let state = {enabled, loading: enabled, user: null, error: ''};
  const emit = patch => {state = {...state, ...patch}; for (const fn of listeners) fn({...state});};
  window.CinemaAuth = {
    subscribe(fn) {listeners.add(fn); fn({...state}); return () => listeners.delete(fn);},
    async signIn() {
      if (!enabled || !client || state.loading) throw Error('auth_unavailable');
      const {error} = await client.auth.signInWithOAuth({provider: 'google', options: {
        redirectTo: new URL('./', window.location.href).href,
        queryParams: {prompt: 'select_account'}
      }});
      if (error) throw error;
    },
    async signOut() {
      if (!client) throw Error('auth_unavailable');
      const {error} = await client.auth.signOut({scope: 'local'});
      if (error) throw error;
      ++sequence;
      emit({user: null, loading: false, error: ''});
    }
  };
  if (!enabled) return; // Guest use never loads the auth SDK or contacts an identity service.
  async function validate(session) {
    const attempt = ++sequence;
    if (!session) {emit({user: null, loading: false, error: ''}); return;}
    const {data, error} = await client.auth.getUser();
    if (attempt !== sequence) return;
    if (error || !data.user) {emit({user: null, loading: false, error: 'ورود تأیید نشد؛ اتصال را بررسی کن و دوباره وارد شو.'}); return;}
    const user = data.user;
    emit({user: {id: user.id, name: user.user_metadata?.full_name || user.user_metadata?.name || 'کاربر سینما۵۰۰', email: user.email || ''}, loading: false, error: ''});
  }
  (async () => {
    try {
      const {createClient} = await import('./vendor/supabase-2.118.0.js');
      client = createClient(config.supabaseUrl, config.supabasePublishableKey, {auth: {
        flowType: 'pkce', persistSession: true, autoRefreshToken: true,
        detectSessionInUrl: true, storageKey: 'cinema500-auth-session'
      }});
      client.auth.onAuthStateChange((_event, session) => {
        // Keep server verification outside the SDK's auth callback/lock.
        setTimeout(() => {validate(session).catch(() => emit({user: null, loading: false, error: 'ارتباط با سرویس ورود برقرار نشد.'}));}, 0);
      });
      const {data, error} = await client.auth.getSession();
      if (error) throw error;
      await validate(data.session);
    } catch {
      emit({user: null, loading: false, error: 'سرویس ورود در دسترس نیست؛ دفتر مهمان همچنان قابل استفاده است.'});
    }
  })();
})();
