/* Spring-based motion: scroll reveals, hero parallax, progress bar and view transitions. */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compact = window.matchMedia('(max-width:700px)');
  const active = new Set();
  const backdrops = new WeakMap();
  let sceneAnimations = [];
  let progressBar = null;
  let progressFill = null;
  let scrollTicking = false;
  let heroVisual = null;

  const canMove = () => !reduce.matches && document.visibilityState !== 'hidden' && typeof Element.prototype.animate === 'function';
  const spring = 'cubic-bezier(.16,1,.3,1)';

  function animate(node, frames, options = {}) {
    if (!node || !canMove()) return;
    const animation = node.animate(frames, { duration: 360, easing: spring, fill: 'both', ...options });
    active.add(animation);
    animation.finished.catch(() => {}).finally(() => active.delete(animation));
    return animation;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') for (const animation of active) animation.cancel();
  });
  reduce.addEventListener?.('change', () => {
    if (reduce.matches) for (const animation of active) animation.cancel();
  });

  /* Scroll progress line, built in JS so the markup stays untouched. */
  function mountProgress() {
    if (progressBar || !document.body) return;
    progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    progressBar.setAttribute('aria-hidden', 'true');
    progressFill = document.createElement('i');
    progressBar.append(progressFill);
    document.body.append(progressBar);
  }

  function paintScroll() {
    scrollTicking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    if (progressFill) progressFill.style.width = (ratio * 100).toFixed(2) + '%';
    if (!heroVisual) heroVisual = document.querySelector('#hero-visual');
    if (heroVisual && !reduce.matches && !compact.matches) {
      const shift = Math.min(scrollY, 720) * 0.07;
      heroVisual.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0) scale(1.04)';
    }
  }

  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(paintScroll);
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });

  const revealed = new Set();
  const sections = new WeakSet();

  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
    let offset = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      const node = entry.target;
      const id = node.dataset.id || node.dataset.motionKey || node.id;
      if (id && revealed.has(id)) continue;
      if (id) revealed.add(id);
      const isCard = node.matches('.card');
      const frames = isCard
        ? [{ opacity: 0, transform: 'translateY(16px) scale(.985)' }, { opacity: 1, transform: 'none' }]
        : [{ opacity: 0, transform: 'translateY(24px)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'none' }];
      animate(node, frames, { duration: isCard ? 620 : 780, delay: Math.min(offset++, 4) * 55 });
    }
  }, { threshold: 0.06, rootMargin: '0px 0px -6% 0px' }) : null;

  const revealSelector = '.card,.rank-banner,.dashboard-title,.curated-heading,.dashboard,.rank-summary,main > section:not(.cinema-hero)';

  function watch(root) {
    if (!observer) return;
    const nodes = root.matches?.(revealSelector) ? [root] : root.querySelectorAll?.(revealSelector) || [];
    for (const node of nodes) {
      if (compact.matches && node.matches('.card')) continue;
      if (node.matches('main > section')) {
        if (sections.has(node)) continue;
        sections.add(node);
      }
      if (node.dataset.motionObserved) continue;
      node.dataset.motionObserved = 'true';
      const key = node.dataset.id || node.dataset.motionKey || node.id;
      if (key && revealed.has(key)) continue;
      observer.observe(node);
    }
  }

  if (observer) {
    watch(document);
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (node.nodeType !== 1) continue;
          observer.unobserve(node);
          for (const child of node.querySelectorAll(revealSelector)) observer.unobserve(child);
        }
        for (const node of record.addedNodes) if (node.nodeType === 1) watch(node);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* Tactile press feedback for every control. */
  document.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('button:not(:disabled),a.hero-link,[role="tab"]');
    if (!button) return;
    animate(button, [{ scale: '1' }, { scale: '.96' }, { scale: '1' }], { duration: 280, easing: spring });
  }, { passive: true });

  function backdrop(node, url) {
    let state = backdrops.get(node);
    if (!state) {
      state = { url: null, version: 0, slot: 0, layers: [document.createElement('div'), document.createElement('div')] };
      for (const layer of state.layers) {
        layer.className = 'hero-backdrop-pane';
        layer.style.opacity = '0';
        node.append(layer);
      }
      node.style.backgroundImage = 'none';
      backdrops.set(node, state);
    }
    if (state.url === url) return;
    state.url = url;
    const version = ++state.version;
    const paint = () => {
      if (version !== state.version) return;
      const next = state.layers[1 - state.slot];
      const old = state.layers[state.slot];
      for (const layer of state.layers) for (const animation of layer.getAnimations()) animation.cancel();
      next.style.backgroundImage = 'url(' + JSON.stringify(url) + ')';
      next.style.opacity = '1';
      old.style.opacity = '0';
      const leaving = old.style.backgroundImage ? animate(old, [{ opacity: 1 }, { opacity: 0 }], { duration: 620 }) : null;
      animate(next, [
        { opacity: 0, transform: 'scale(1.06)' },
        { opacity: 1, transform: 'scale(1)' }
      ], { duration: 760, easing: spring });
      state.slot = 1 - state.slot;
      const release = () => {
        if (version === state.version) old.style.backgroundImage = 'none';
      };
      if (leaving) leaving.finished.then(release, () => {});
      else release();
    };
    const img = new Image();
    img.decoding = 'async';
    img.onload = paint;
    img.onerror = () => {
      if (version === state.version) node.style.backgroundImage = 'url(' + JSON.stringify(url) + ')';
    };
    img.src = url;
  }

  /* Circular reveal for theme changes, with a plain fallback. */
  function transition(update, event) {
    if (typeof update !== 'function') return;
    if (!canMove() || typeof document.startViewTransition !== 'function' || typeof document.documentElement.animate !== 'function') {
      update();
      return;
    }
    const point = event && typeof event.clientX === 'number'
      ? { x: event.clientX, y: event.clientY }
      : { x: innerWidth / 2, y: 80 };
    const radius = Math.hypot(Math.max(point.x, innerWidth - point.x), Math.max(point.y, innerHeight - point.y));
    const vt = document.startViewTransition(update);
    vt.ready.then(() => {
      document.documentElement.animate([
        { clipPath: 'circle(0px at ' + point.x + 'px ' + point.y + 'px)' },
        { clipPath: 'circle(' + radius.toFixed(0) + 'px at ' + point.x + 'px ' + point.y + 'px)' }
      ], { duration: 620, easing: spring, pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
  }

  window.CinemaMotion = {
    animate,
    backdrop,
    transition,
    scene() {
      for (const animation of sceneAnimations) animation?.cancel();
      sceneAnimations = ['#featured-title', '#featured-fa', '#featured-meta', '#hero-description'].map((selector, index) =>
        animate(document.querySelector(selector), [
          { opacity: .2, transform: 'translateY(12px)', filter: 'blur(4px)' },
          { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }
        ], { duration: 620, delay: index * 55 })
      );
    },
    grid() {
      animate(document.querySelector('#grid'), [
        { opacity: .5, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'none' }
      ], { duration: 320 });
    },
    reveal(node) {
      animate(node, [
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'none' }
      ], { duration: 340 });
    }
  };

  mountProgress();
  paintScroll();
})();
