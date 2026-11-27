(() => {
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const num = (value, digits = 0) => Number(value).toLocaleString('fa-IR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const norm = value => String(value ?? '').toLowerCase()
  .replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)))
  .replace(/[يى]/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/[\u200c\u200e\u200f]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const DATA = (window.ANIME_CATALOGUE && window.ANIME_CATALOGUE.titles) || [];
const GENRES = Array.from(new Set(DATA.flatMap(title => title.genres))).sort((a, b) => a.localeCompare(b, 'fa'));
const byId = new Map(DATA.map(title => [title.id, title]));

const KEY = 'anime500:';
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(KEY + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(KEY + key, JSON.stringify(value)); return true; }
    catch (error) { return false; }
  }
};

const known = list => (Array.isArray(list) ? list : []).filter(id => byId.has(id));
const state = {
  view: 'collection',
  type: 'tv',
  q: '',
  genre: 'all',
  sort: 'score',
  listTab: 'wanted',
  seen: new Set(known(store.get('seen', []))),
  wanted: new Set(known(store.get('wanted', []))),
  ratings: new Map(Object.entries(store.get('ratings', {}) || {}).filter(([id, value]) => byId.has(id) && Number(value) >= 1 && Number(value) <= 10).map(([id, value]) => [id, Number(value)]))
};
state.seen.forEach(id => state.wanted.delete(id));

/* ---------- helpers ---------- */

function hues(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const first = 188 + (hash % 148);
  return [first, (first + 58) % 360];
}

function mark(title) {
  const words = String(title || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase() || 'A';
}

function lengthLabel(title) {
  return title.type === 'tv' ? `${num(title.episodes)} قسمت` : `${num(title.runtime)} دقیقه`;
}

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 1900);
}

/* ---------- rendering ---------- */

function cardMarkup(title, index) {
  const seen = state.seen.has(title.id);
  const wanted = state.wanted.has(title.id);
  return `<article class="card" style="--i:${index % 14}">
  <div class="art">
    <span class="halftone"></span><span class="streaks"></span>
    <span class="jp">${esc(title.jp)}</span>
    <span class="mark">${esc(mark(title.title))}</span>
    <span class="score"><svg aria-hidden="true"><use href="#i-star"/></svg>${num(title.rating, 1)}</span>
    ${seen ? '<span class="badge-seen"><svg aria-hidden="true"><use href="#i-check"/></svg>دیدم</span>' : ''}
    <span class="type">${title.type === 'tv' ? 'SERIES' : 'FILM'}</span>
    <button type="button" class="art-open" data-open="${title.id}" aria-label="جزئیات ${esc(title.fa)}"></button>
    <div class="poster-acts">
      <button type="button" class="pa ${wanted ? 'on' : ''}" data-act="want" data-id="${title.id}" aria-pressed="${wanted}" aria-label="${wanted ? 'حذف از' : 'افزودن به'} لیست تماشا: ${esc(title.fa)}"><svg aria-hidden="true"><use href="#i-bookmark"/></svg></button>
      <button type="button" class="pa ${seen ? 'on' : ''}" data-act="seen" data-id="${title.id}" aria-pressed="${seen}" aria-label="${seen ? 'برداشتن علامت دیده‌شدن' : 'ثبت تماشا'}: ${esc(title.fa)}"><svg aria-hidden="true"><use href="#i-check"/></svg></button>
    </div>
  </div>
  <div class="card-body">
    <button type="button" class="c-title" data-open="${title.id}">${esc(title.fa)}</button>
    <div class="c-sub" dir="ltr">${esc(title.title)}</div>
    <div class="c-meta"><span>${num(title.year)}</span><i></i><span>${lengthLabel(title)}</span></div>
    <div class="card-acts">
      <button type="button" class="mini want ${wanted ? 'on' : ''}" data-act="want" data-id="${title.id}" aria-pressed="${wanted}"><svg aria-hidden="true"><use href="#i-bookmark"/></svg>${wanted ? 'در لیستم' : 'می‌خوام ببینم'}</button>
      <button type="button" class="mini ${seen ? 'on' : ''}" data-act="seen" data-id="${title.id}" aria-pressed="${seen}"><svg aria-hidden="true"><use href="#i-check"/></svg>${seen ? 'دیدم' : 'دیدم؟'}</button>
    </div>
  </div>
</article>`;
}

function filtered() {
  const query = norm(state.q);
  let list = DATA.filter(title => title.type === state.type && (state.genre === 'all' || title.genres.includes(state.genre)));
  if (query) {
    list = list.filter(title => norm([title.fa, title.title, title.jp, title.studio, title.year, title.genres.join(' ')].join(' ')).includes(query));
  }
  const sorters = {
    score: (a, b) => b.rating - a.rating || b.year - a.year,
    new: (a, b) => b.year - a.year || b.rating - a.rating,
    old: (a, b) => a.year - b.year || b.rating - a.rating,
    name: (a, b) => a.fa.localeCompare(b.fa, 'fa')
  };
  return list.sort(sorters[state.sort] || sorters.score);
}

function renderGrid() {
  const list = filtered();
  const grid = $('#grid');
  grid.innerHTML = list.map(cardMarkup).join('');
  grid.hidden = list.length === 0;
  $('#empty').hidden = list.length > 0;
  if (!list.length) {
    $('#empty-copy').textContent = state.q ? 'برای «' + state.q + '» چیزی پیدا نشد. نام دیگری یا بخشی از نام را امتحان کن.' : 'با این ژانر در این دسته چیزی نیست؛ ژانر را عوض کن.';
  }
  const typeLabel = state.type === 'tv' ? 'سریال' : 'فیلم';
  $('#result-note').innerHTML = `<b>${num(list.length)}</b> ${typeLabel}${state.genre === 'all' ? '' : ' · ' + esc(state.genre)}${state.q ? ' · جست‌وجو' : ''}`;
}

function renderCounts() {
  const tv = DATA.filter(title => title.type === 'tv').length;
  const movie = DATA.filter(title => title.type === 'movie').length;
  $('#count-tv').textContent = num(tv);
  $('#count-movie').textContent = num(movie);
  $('#nav-want').textContent = num(state.wanted.size);
  $('#tab-want').textContent = num(state.wanted.size);
  $('#tab-seen').textContent = num(state.seen.size);
  $('#foot-count').textContent = num(DATA.length) + ' عنوان';
}

function renderWatchlist() {
  const set = state.listTab === 'wanted' ? state.wanted : state.seen;
  const list = DATA.filter(title => set.has(title.id)).sort((a, b) => b.rating - a.rating);
  $('#list-grid').innerHTML = list.map(cardMarkup).join('');
  $('#list-grid').hidden = list.length === 0;
  $('#list-empty').hidden = list.length > 0;
  $('#list-empty-title').textContent = state.listTab === 'wanted' ? 'لیست تماشا خالی است' : 'هنوز چیزی را ندیده علامت نزدی';
  $('#list-empty-copy').textContent = state.listTab === 'wanted'
    ? 'روی نشانک کنار هر انیمه بزن تا برای بعد ذخیره شود.'
    : 'زیر هر کارت «دیدم» را بزن؛ بعد اینجا آمار و پیشرفتت را ببین.';
  $$('.list-tabs button').forEach(button => {
    const active = button.dataset.tab === state.listTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
}

function renderStats() {
  const seenTitles = DATA.filter(title => state.seen.has(title.id));
  const rated = Array.from(state.ratings.entries()).filter(([id]) => byId.has(id));
  const average = rated.length ? rated.reduce((sum, [, value]) => sum + value, 0) / rated.length : 0;
  const percent = DATA.length ? Math.round((seenTitles.length / DATA.length) * 100) : 0;

  const genreCount = new Map();
  seenTitles.forEach(title => title.genres.forEach(genreName => genreCount.set(genreName, (genreCount.get(genreName) || 0) + 1)));
  const topGenres = Array.from(genreCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = topGenres.length ? topGenres[0][1] : 0;

  const seriesSeen = seenTitles.filter(title => title.type === 'tv').length;
  const movieSeen = seenTitles.filter(title => title.type === 'movie').length;

  $('#stats-body').innerHTML = `
  <div class="stats">
    <div class="stat"><span><svg aria-hidden="true"><use href="#i-check"/></svg>دیده‌شده</span><b>${num(seenTitles.length)}</b><small>از ${num(DATA.length)} عنوان</small></div>
    <div class="stat"><span><svg aria-hidden="true"><use href="#i-bookmark"/></svg>در لیست تماشا</span><b>${num(state.wanted.size)}</b><small>منتظر تماشا</small></div>
    <div class="stat"><span><svg aria-hidden="true"><use href="#i-star"/></svg>نمره‌های تو</span><b>${rated.length ? num(average, 1) : '—'}</b><small>${num(rated.length)} اثر نمره‌دار</small></div>
    <div class="stat"><span><svg aria-hidden="true"><use href="#i-tv"/></svg>سریال / فیلم</span><b>${num(seriesSeen)} / ${num(movieSeen)}</b><small>از دیده‌شده‌ها</small></div>
  </div>
  <div class="progress-card">
    <h3>پیشرفت مجموعه — ${num(percent)}٪</h3>
    <div class="bar"><i style="width:${percent}%"></i></div>
  </div>
  ${topGenres.length ? `<div class="progress-card"><h3>ژانرهایی که بیشتر دیده‌ای</h3><div class="genre-bars">${topGenres.map(([genreName, count]) => `<div class="gb"><span>${esc(genreName)}</span><div class="bar"><i style="width:${Math.round((count / max) * 100)}%"></i></div><b>${num(count)}</b></div>`).join('')}</div></div>` : ''}
  ${seenTitles.length ? '' : '<div class="empty" style="margin:30px auto"><svg aria-hidden="true"><use href="#i-chart"/></svg><h3>هنوز آماری نیست</h3><p>چند انیمه را دیدم بزن تا این صفحه پر شود.</p></div>'}`;
}

/* ---------- hero ---------- */

let heroIndex = 0;
let heroTimer = null;

function heroPool() {
  return DATA.slice().sort((a, b) => b.rating - a.rating || b.year - a.year).slice(0, 6);
}

function renderHero() {
  const pool = heroPool();
  const host = $('#hero');
  if (!pool.length || !host) return;
  const position = heroIndex % pool.length;
  const title = pool[position];
  const [h1, h2] = hues(title.id);
  const wanted = state.wanted.has(title.id);
  const seen = state.seen.has(title.id);

  host.innerHTML = `
  <div class="hero-copy">
    <div class="eyebrow"><span class="dot"></span>پیشنهاد ویژهٔ انیمه<span aria-hidden="true">·</span><span>${num(position + 1)} از ${num(pool.length)}</span></div>
    <h1><span>${esc(title.fa)}</span><span class="en">${esc(title.title)}</span></h1>
    <div class="hero-jp" dir="ltr">${esc(title.jp)}</div>
    <p class="hero-summary">${esc(title.summary)}</p>
    <div class="meta-row">
      <span class="chip score"><svg aria-hidden="true" width="12" height="12"><use href="#i-star"/></svg><b>${num(title.rating, 1)}</b></span>
      <span class="chip">${num(title.year)}</span>
      <span class="chip">${esc(title.studio)}</span>
      <span class="chip">${lengthLabel(title)}</span>
      <span class="chip">${esc(title.genres[0])}</span>
    </div>
    <div class="hero-actions">
      <button type="button" class="btn primary" data-open="${title.id}"><svg aria-hidden="true"><use href="#i-play"/></svg>جزئیات و خلاصه</button>
      <button type="button" class="btn ghost ${wanted ? 'on' : ''}" data-act="want" data-id="${title.id}" aria-pressed="${wanted}"><svg aria-hidden="true"><use href="#i-bookmark"/></svg>${wanted ? 'در لیست تماشا' : 'افزودن به لیست'}</button>
      <button type="button" class="btn ghost ${seen ? 'on' : ''}" data-act="seen" data-id="${title.id}" aria-pressed="${seen}"><svg aria-hidden="true"><use href="#i-check"/></svg>${seen ? 'دیده‌ام' : 'دیدم'}</button>
    </div>
  </div>
  <div class="hero-art" style="--h1:${h1};--h2:${h2}">
    <span class="ring"></span><span class="halftone"></span>
    <span class="jp">${esc(title.jp)}</span>
    <span class="mark">${esc(mark(title.title))}</span>
    <div class="hero-nav">
      <button type="button" data-act="hero-prev" aria-label="پیشنهاد قبلی"><svg aria-hidden="true"><use href="#i-right"/></svg></button>
      <button type="button" data-act="hero-next" aria-label="پیشنهاد بعدی"><svg aria-hidden="true"><use href="#i-left"/></svg></button>
      <div class="hero-dots">${pool.map((item, index) => `<i data-act="hero-dot" data-i="${index}" class="${index === position ? 'on' : ''}" role="button" tabindex="0" aria-label="پیشنهاد ${num(index + 1)}"></i>`).join('')}</div>
    </div>
  </div>`;
}

function startHeroTimer() {
  stopHeroTimer();
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  heroTimer = setInterval(() => {
    if (state.view !== 'collection' || document.hidden) return;
    heroIndex += 1;
    renderHero();
  }, 8500);
}

function stopHeroTimer() {
  if (heroTimer) clearInterval(heroTimer);
  heroTimer = null;
}

/* ---------- detail dialog ---------- */

function openDetail(id) {
  const title = byId.get(id);
  const dialog = $('#detail');
  if (!title || !dialog) return;
  const [h1, h2] = hues(title.id);
  const rating = state.ratings.get(title.id) || 0;
  const seen = state.seen.has(title.id);
  const wanted = state.wanted.has(title.id);

  $('#detail-body').innerHTML = `<div class="detail">
    <div class="art" style="--h1:${h1};--h2:${h2}" aria-hidden="true">
      <span class="halftone"></span>
      <span class="jp">${esc(title.jp)}</span>
      <span class="mark">${esc(mark(title.title))}</span>
    </div>
    <div class="detail-body">
      <h2 id="detail-title">${esc(title.fa)}</h2>
      <div class="en">${esc(title.title)}</div>
      <div class="jp-line" dir="ltr">${esc(title.jp)}</div>
      <div class="meta-row" style="margin-top:10px">
        <span class="chip score"><svg aria-hidden="true" width="12" height="12"><use href="#i-star"/></svg><b>${num(title.rating, 1)}</b></span>
        <span class="chip">${num(title.year)}</span>
        <span class="chip">${title.type === 'tv' ? 'سریال' : 'فیلم'}</span>
        ${title.genres.map(genreName => `<span class="chip">${esc(genreName)}</span>`).join('')}
      </div>
      <p class="summary">${esc(title.summary)}</p>
      <div class="facts">
        <div class="fact"><span>استودیو</span><b>${esc(title.studio)}</b></div>
        <div class="fact"><span>سال انتشار</span><b>${num(title.year)}</b></div>
        <div class="fact"><span>${title.type === 'tv' ? 'تعداد قسمت' : 'مدت'}</span><b>${lengthLabel(title)}</b></div>
      </div>
      <div class="rate-row">
        <h3>نمرهٔ تو (۱ تا ۱۰)${rating ? ' — نمرهٔ فعلی: ' + num(rating) : ''}</h3>
        <div class="rate">${Array.from({ length: 10 }, (_, index) => index + 1).map(value => `<button type="button" class="${value === rating ? 'on' : ''}" data-act="rate" data-id="${title.id}" data-n="${value}" aria-pressed="${value === rating}" aria-label="نمرهٔ ${num(value)}">${num(value)}</button>`).join('')}</div>
      </div>
      <div class="detail-actions">
        <button type="button" class="btn ghost ${wanted ? 'on' : ''}" data-act="want" data-id="${title.id}" aria-pressed="${wanted}"><svg aria-hidden="true"><use href="#i-bookmark"/></svg>${wanted ? 'در لیست تماشا' : 'افزودن به لیست'}</button>
        <button type="button" class="btn ${seen ? 'ghost on' : 'primary'}" data-act="seen" data-id="${title.id}" aria-pressed="${seen}"><svg aria-hidden="true"><use href="#i-check"/></svg>${seen ? 'دیدم' : 'ثبت تماشا'}</button>
        ${rating ? `<button type="button" class="btn ghost" data-act="clear-rate" data-id="${title.id}">پاک کردن نمره</button>` : ''}
      </div>
    </div>
  </div>`;

  if (!dialog.open) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
}

function closeDetail() {
  const dialog = $('#detail');
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

/* ---------- actions ---------- */

function afterChange() {
  renderCounts();
  renderGrid();
  if (state.view === 'watchlist') renderWatchlist();
  if (state.view === 'stats') renderStats();
  if ($('#detail').open) {
    const id = $('#detail [data-act="seen"]')?.dataset.id;
    if (id) openDetail(id);
  }
}

function toggleSeen(id) {
  if (!byId.has(id)) return;
  if (state.seen.has(id)) {
    state.seen.delete(id);
    toast('از دیده‌شده‌ها برداشته شد');
  } else {
    state.seen.add(id);
    state.wanted.delete(id);
    store.set('wanted', Array.from(state.wanted));
    toast('به دیده‌شده‌ها اضافه شد');
  }
  store.set('seen', Array.from(state.seen));
  renderHero();
  afterChange();
}

function toggleWant(id) {
  if (!byId.has(id)) return;
  if (state.wanted.has(id)) {
    state.wanted.delete(id);
    toast('از لیست تماشا حذف شد');
  } else {
    if (state.seen.has(id)) {
      toast('این را قبلاً دیده‌ای');
      return;
    }
    state.wanted.add(id);
    toast('به لیست تماشا اضافه شد');
  }
  store.set('wanted', Array.from(state.wanted));
  renderHero();
  afterChange();
}

function setRating(id, value) {
  if (!byId.has(id) || !(value >= 1 && value <= 10)) return;
  if (state.ratings.get(id) === value) state.ratings.delete(id);
  else state.ratings.set(id, value);
  store.set('ratings', Object.fromEntries(state.ratings));
  openDetail(id);
  if (state.view === 'stats') renderStats();
  toast('نمره‌ات ذخیره شد');
}

function clearRating(id) {
  state.ratings.delete(id);
  store.set('ratings', Object.fromEntries(state.ratings));
  openDetail(id);
  if (state.view === 'stats') renderStats();
  toast('نمره پاک شد');
}

function setType(type) {
  state.type = type;
  $$('.seg button').forEach(button => {
    const active = button.dataset.type === type;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  renderGrid();
}

function showView(view) {
  state.view = view;
  $('#collection-view').hidden = view !== 'collection';
  $('#watchlist-view').hidden = view !== 'watchlist';
  $('#stats-view').hidden = view !== 'stats';
  $$('[data-act="view"]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  if (view === 'watchlist') renderWatchlist();
  if (view === 'stats') renderStats();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  store.set('theme', theme);
  const use = $('#theme-icon');
  if (use) use.setAttribute('href', theme === 'dark' ? '#i-moon' : '#i-sun');
  const button = $('#theme');
  if (button) button.setAttribute('aria-label', theme === 'dark' ? 'روشن‌کردن تم' : 'تاریک‌کردن تم');
}

/* ---------- events ---------- */

document.addEventListener('click', event => {
  const actionEl = event.target.closest('[data-act]');
  if (actionEl) {
    const { act } = actionEl.dataset;
    if (act === 'view') showView(actionEl.dataset.view);
    else if (act === 'type') setType(actionEl.dataset.type);
    else if (act === 'want') toggleWant(actionEl.dataset.id);
    else if (act === 'seen') toggleSeen(actionEl.dataset.id);
    else if (act === 'rate') setRating(actionEl.dataset.id, Number(actionEl.dataset.n));
    else if (act === 'clear-rate') clearRating(actionEl.dataset.id);
    else if (act === 'list-tab') { state.listTab = actionEl.dataset.tab; renderWatchlist(); }
    else if (act === 'hero-next') { heroIndex += 1; renderHero(); }
    else if (act === 'hero-prev') { heroIndex = (heroIndex - 1 + heroPool().length) % heroPool().length; renderHero(); }
    else if (act === 'hero-dot') { heroIndex = Number(actionEl.dataset.i); renderHero(); }
    else if (act === 'theme') setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    else if (act === 'close') closeDetail();
    return;
  }
  const openEl = event.target.closest('[data-open]');
  if (openEl) openDetail(openEl.dataset.open);
});

document.addEventListener('keydown', event => {
  if (event.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
    event.preventDefault();
    $('#q').focus();
  }
});

const search = $('#q');
if (search) {
  search.addEventListener('input', () => {
    state.q = search.value.trim();
    if (state.view !== 'collection') showView('collection');
    renderGrid();
  });
}

const genreSelect = $('#genre');
if (genreSelect) {
  GENRES.forEach(genreName => {
    const option = document.createElement('option');
    option.value = genreName;
    option.textContent = genreName;
    genreSelect.appendChild(option);
  });
  genreSelect.addEventListener('change', () => {
    state.genre = genreSelect.value;
    renderGrid();
  });
}

const sortSelect = $('#sort');
if (sortSelect) {
  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    renderGrid();
  });
}

const detailDialog = $('#detail');
if (detailDialog) {
  detailDialog.addEventListener('click', event => {
    if (event.target === detailDialog) closeDetail();
  });
}

const heroHost = $('#hero');
if (heroHost) {
  heroHost.addEventListener('mouseenter', stopHeroTimer);
  heroHost.addEventListener('mouseleave', startHeroTimer);
  heroHost.addEventListener('focusin', stopHeroTimer);
}

/* petals */
const petals = $('#petals');
if (petals && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
  for (let i = 0; i < 9; i += 1) {
    const petal = document.createElement('span');
    petal.className = 'petal';
    petal.style.left = `${6 + Math.random() * 88}vw`;
    petal.style.animationDuration = `${16 + Math.random() * 16}s`;
    petal.style.animationDelay = `${-Math.random() * 26}s`;
    petal.style.transform = `scale(${0.6 + Math.random() * 0.8})`;
    petals.appendChild(petal);
  }
}

/* ---------- init ---------- */
const storedTheme = store.get('theme', document.documentElement.dataset.theme || 'dark');
setTheme(storedTheme === 'light' ? 'light' : 'dark');
renderCounts();
renderHero();
renderGrid();
renderWatchlist();
startHeroTimer();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopHeroTimer();
  else startHeroTimer();
});
})();
