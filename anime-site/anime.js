(() => {
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const num = (value, digits = 0) => Number(value).toLocaleString('fa-IR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const faDigits = value => String(value ?? '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const yearNum = value => (value ? faDigits(value) : '—');
const norm = value => String(value ?? '').toLowerCase()
  .replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)))
  .replace(/[يى]/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/[\u200c\u200e\u200f]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const DATA = (window.ANIME_CATALOGUE && window.ANIME_CATALOGUE.titles) || [];
const POSTERS = window.ANIME_POSTERS || {};
const GENRES = Array.from(new Set(DATA.flatMap(title => title.genres))).sort((a, b) => a.localeCompare(b, 'fa'));
const byId = new Map(DATA.map(title => [title.id, title]));

/* ---------- دادهٔ زنده (مستقیم از AniList، در مرورگر) ---------- */

const LIVE_STORE = 'anime500:live';
const GENRE_MAP = {
  Action: 'اکشن', Adventure: 'ماجراجویی', Comedy: 'کمدی', Drama: 'درام', Ecchi: 'اچی',
  Fantasy: 'فانتزی', Horror: 'ترسناک', 'Mahou Shoujo': 'دختر جادویی', Mecha: 'مکا',
  Music: 'موزیکال', Mystery: 'معمایی', Psychological: 'روان‌شناختی', Romance: 'عاشقانه',
  'Sci-Fi': 'علمی‌تخیلی', 'Slice of Life': 'برشی از زندگی', Sports: 'ورزشی',
  Supernatural: 'فراطبیعی', Thriller: 'هیجان‌انگیز'
};
const LIVE_STATUS = { RELEASING: 'airing', FINISHED: 'done', NOT_YET_RELEASED: 'soon', CANCELLED: 'done', HIATUS: 'airing' };
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#039': "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…' };

const ANILIST_FIELDS = `
  id title{romaji english native} format status episodes duration seasonYear
  startDate{year month day} averageScore popularity genres description(asHtml:false)
  coverImage{extraLarge color} studios(isMain:true){nodes{name}}
  nextAiringEpisode{airingAt episode} siteUrl`;

const LIVE_QUERY = `query {
  upcoming: Page(page:1,perPage:36){ media(type:ANIME,status:NOT_YET_RELEASED,sort:POPULARITY_DESC,isAdult:false){${ANILIST_FIELDS}} }
  airing: Page(page:1,perPage:30){ media(type:ANIME,status:RELEASING,sort:POPULARITY_DESC,isAdult:false){${ANILIST_FIELDS}} }
  trending: Page(page:1,perPage:24){ media(type:ANIME,sort:TRENDING_DESC,status_in:[RELEASING,FINISHED],isAdult:false){${ANILIST_FIELDS}} }
  top: Page(page:1,perPage:12){ media(type:ANIME,sort:SCORE_DESC,popularity_greater:20000,isAdult:false){${ANILIST_FIELDS}} }
}`;

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
      if (ENTITIES[code]) return ENTITIES[code];
      if (/^#x/i.test(code)) return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (/^#/.test(code)) return String.fromCodePoint(parseInt(code.slice(1), 10));
      return match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function shorten(text, limit = 280) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (stop > limit * 0.5) return cut.slice(0, stop + 1);
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : cut) + '…';
}

function normalizeLive(media) {
  const info = media.title || {};
  const cover = media.coverImage || {};
  const next = media.nextAiringEpisode || null;
  const date = media.startDate || {};
  return {
    id: `l${media.id}`,
    anilistId: media.id,
    type: media.format === 'MOVIE' ? 'movie' : 'tv',
    format: media.format || 'TV',
    status: LIVE_STATUS[media.status] || 'done',
    title: info.english || info.romaji || info.native || `Anime ${media.id}`,
    romaji: info.romaji || '',
    jp: info.native || '',
    year: media.seasonYear || date.year || 0,
    rating: media.averageScore ? Math.round(media.averageScore) / 10 : 0,
    studio: (media.studios && media.studios.nodes && media.studios.nodes[0] && media.studios.nodes[0].name) || '—',
    episodes: media.episodes || 0,
    runtime: media.duration || 0,
    genres: (media.genres || []).map(name => GENRE_MAP[name] || name),
    summary: shorten(stripHtml(media.description)),
    summaryLang: 'en',
    poster: cover.extraLarge || '',
    color: cover.color || '',
    popularity: media.popularity || 0,
    airingAt: next ? next.airingAt : 0,
    nextEp: next ? next.episode : 0,
    startAt: date.year ? Math.floor(Date.UTC(date.year, (date.month || 1) - 1, date.day || 1) / 1000) : 0,
    siteUrl: media.siteUrl || `https://anilist.co/anime/${media.id}`,
    live: true
  };
}

async function fetchAniListLive(signal) {
  const response = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: LIVE_QUERY })
  });
  if (!response.ok) throw new Error(`AniList HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.errors) throw new Error('AniList error');
  const data = payload.data || {};
  const next = { updatedAt: Date.now(), source: 'AniList' };
  LIVE_KEYS.forEach(key => {
    const media = (data[key] && data[key].media) || [];
    next[key] = media.filter(item => item.coverImage && item.coverImage.extraLarge).map(normalizeLive);
  });
  if (!next.upcoming.length && !next.airing.length) throw new Error('empty');
  return next;
}

function cachedLive() {
  try {
    const raw = localStorage.getItem(LIVE_STORE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.updatedAt || !Array.isArray(parsed.upcoming)) return null;
    if (Date.now() - parsed.updatedAt > 6 * 3600 * 1000) return null;
    return parsed;
  } catch (error) { return null; }
}

const LIVE_KEYS = ['upcoming', 'airing', 'trending', 'top'];
const EMPTY_LIVE = { updatedAt: 0, source: 'AniList', upcoming: [], airing: [], trending: [], top: [] };
const cachedSnapshot = cachedLive();
let live = Object.assign({}, EMPTY_LIVE, cachedSnapshot || window.ANIME_LIVE || {});
const liveById = new Map();
const liveMeta = {
  state: cachedSnapshot ? 'live' : (window.ANIME_LIVE && window.ANIME_LIVE.updatedAt ? 'snapshot' : 'empty'),
  lastFetch: cachedSnapshot ? cachedSnapshot.updatedAt : 0,
  busy: false
};

function registerLive() {
  liveById.clear();
  LIVE_KEYS.forEach(key => (live[key] || []).forEach(item => {
    if (!liveById.has(item.id)) liveById.set(item.id, item);
  }));
}

const titleOf = id => byId.get(id) || liveById.get(id);
const known = list => (Array.isArray(list) ? list : []).filter(id => !!titleOf(id));

registerLive();

const PAGE_SIZE = 60;
const titleFa = title => title.fa || title.title;
const altTitle = title => title.fa ? title.title : (title.jp || '');
const posterRemote = title => title.poster || '';
const posterLocal = title => POSTERS[title.id] || title.local || '';
const posterOf = title => posterRemote(title) || posterLocal(title);

/* تصویر: اول پوستر باکیفیت AniList، بعد پوستر محلی، بعد گرادیان */
window.animeImgError = img => {
  const fallback = img.getAttribute('data-fb');
  if (fallback) {
    img.removeAttribute('data-fb');
    img.src = fallback;
    return;
  }
  img.style.display = 'none';
};

function imgTag(title, { eager = false } = {}) {
  const src = posterOf(title);
  if (!src) return '';
  const local = posterLocal(title);
  const fallback = posterRemote(title) && local ? ` data-fb="${esc(local)}"` : '';
  return `<img src="${esc(src)}"${fallback} alt="پوستر ${esc(titleFa(title))}" width="460" height="650" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" onerror="animeImgError(this)">`;
}

/* ---------- تاریخ و شمارش معکوس ---------- */

const MONTH_FMT = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { month: 'long', year: 'numeric' }) : null;
const DAY_FMT = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
const CLOCK_FMT = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }) : null;

function untilText(ts) {
  const diff = ts * 1000 - Date.now();
  if (diff <= 0) return 'همین حالا';
  const minutes = Math.floor(diff / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${num(days)} روز و ${num(hours)} ساعت`;
  if (hours > 0) return `${num(hours)} ساعت و ${num(minutes % 60)} دقیقه`;
  return `${num(Math.max(minutes, 1))} دقیقه`;
}

function releaseShort(title) {
  if (title.startAt) {
    const date = new Date(title.startAt * 1000);
    const near = title.startAt * 1000 - Date.now() < 200 * 86400000;
    const fmt = near ? DAY_FMT : MONTH_FMT;
    return fmt ? fmt.format(date) : yearNum(title.year);
  }
  return title.year ? yearNum(title.year) : 'تاریخ نامشخص';
}

function clockText(ts) {
  if (!ts) return '—';
  const date = new Date(ts);
  const time = CLOCK_FMT ? CLOCK_FMT.format(date) : date.toLocaleTimeString('fa-IR');
  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay ? time : `${faDigits(date.getFullYear())}/${faDigits(date.getMonth() + 1)} · ${time}`;
}

function formatLabel(item) {
  return ({ TV: 'SERIES', MOVIE: 'FILM', ONA: 'ONA', OVA: 'OVA', SPECIAL: 'SPECIAL', TV_SHORT: 'SHORT' })[item.format] || 'ANIME';
}

/* ---------- ذخیره‌سازی ---------- */

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

const state = {
  view: 'collection',
  type: 'all',
  q: '',
  genre: 'all',
  sort: 'popular',
  listTab: 'wanted',
  liveTab: 'upcoming',
  upSort: 'soon',
  limit: PAGE_SIZE,
  sig: '',
  seen: new Set(known(store.get('seen', []))),
  wanted: new Set(known(store.get('wanted', []))),
  ratings: new Map(Object.entries(store.get('ratings', {}) || {}).filter(([id, value]) => !!titleOf(id) && Number(value) >= 1 && Number(value) <= 10).map(([id, value]) => [id, Number(value)]))
};
state.seen.forEach(id => state.wanted.delete(id));

/* ---------- helpers ---------- */

function hue(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return 320 + (hash % 40);
}

const fallbackStyle = title => `--c1:${esc(title.color || `hsl(${hue(title.id)} 62% 52%)`)}`;

function mark(title) {
  const words = String(title || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase() || 'A';
}

function lengthLabel(title) {
  if (title.type === 'movie') return title.runtime ? `${num(title.runtime)} دقیقه` : 'مدت نامشخص';
  if (title.status === 'soon') return releaseShort(title);
  return title.episodes ? `${num(title.episodes)} قسمت` : 'قسمت‌ها نامشخص';
}

function summaryMarkup(title, className = 'summary') {
  if (!title.summary) return '';
  const isEn = title.summaryLang === 'en';
  return `<p class="${className}"${isEn ? ' dir="ltr" lang="en"' : ''}>${esc(title.summary)}</p>`;
}

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2100);
}

function posterMarkup(title, { eager = false } = {}) {
  return `<div class="poster" style="${fallbackStyle(title)}">
      <span class="fallback" aria-hidden="true"><span>${esc(mark(title.title))}</span></span>
      ${imgTag(title, { eager })}
      <span class="shade" aria-hidden="true"></span>
      ${title.rating > 0 ? `<span class="score"><svg aria-hidden="true"><use href="#i-star"/></svg>${num(title.rating, 1)}</span>` : ''}
      <span class="type" dir="ltr">${formatLabel(title)}</span>
      ${title.status === 'soon' ? '<span class="soon-tag">در راه</span>' : ''}
      ${state.seen.has(title.id) ? '<span class="badge-seen"><svg aria-hidden="true"><use href="#i-check"/></svg>دیدم</span>' : ''}
      <button type="button" class="art-open" data-open="${title.id}" aria-label="جزئیات ${esc(titleFa(title))}"></button>
      <div class="poster-acts">
        <button type="button" class="pa ${state.wanted.has(title.id) ? 'on' : ''}" data-act="want" data-id="${title.id}" aria-pressed="${state.wanted.has(title.id)}" aria-label="${state.wanted.has(title.id) ? 'حذف از' : 'افزودن به'} لیست تماشا: ${esc(titleFa(title))}"><svg aria-hidden="true"><use href="#i-bookmark"/></svg></button>
        ${title.status === 'soon' ? '' : `<button type="button" class="pa ${state.seen.has(title.id) ? 'on' : ''}" data-act="seen" data-id="${title.id}" aria-pressed="${state.seen.has(title.id)}" aria-label="${state.seen.has(title.id) ? 'برداشتن علامت دیده‌شدن' : 'ثبت تماشا'}: ${esc(titleFa(title))}"><svg aria-hidden="true"><use href="#i-check"/></svg></button>`}
      </div>
    </div>`;
}

/* ---------- cards ---------- */

function cardMeta(title) {
  const soon = title.status === 'soon';
  const parts = [];
  if (!soon) parts.push(yearNum(title.year));
  if (soon) parts.push(`<span class="rel">${esc(releaseShort(title))}</span>`);
  else parts.push(esc(lengthLabel(title)));
  if (title.genres[0]) parts.push(esc(title.genres[0]));
  return parts.filter(Boolean).join('<i></i>');
}

function cardMarkup(title, index) {
  const seen = state.seen.has(title.id);
  const wanted = state.wanted.has(title.id);
  const alt = altTitle(title);
  return `<article class="card" style="--i:${index % 12}">
  ${posterMarkup(title)}
  <div class="card-body">
    <button type="button" class="c-title" data-open="${title.id}">${esc(titleFa(title))}</button>
    ${alt ? `<div class="c-sub"${/[A-Za-z]/.test(alt) ? ' dir="ltr"' : ''}>${esc(alt)}</div>` : ''}
    <div class="c-meta">${cardMeta(title)}</div>
    <div class="card-acts">
      <button type="button" class="mini want ${wanted ? 'on' : ''}" data-act="want" data-id="${title.id}" aria-pressed="${wanted}"><svg aria-hidden="true"><use href="#i-bookmark"/></svg>${wanted ? 'در لیستم' : title.status === 'soon' ? 'یادآوری' : 'می‌خوام'}</button>
      ${title.status === 'soon' ? '' : `<button type="button" class="mini ${seen ? 'on' : ''}" data-act="seen" data-id="${title.id}" aria-pressed="${seen}"><svg aria-hidden="true"><use href="#i-check"/></svg>${seen ? 'دیدم' : 'دیدم؟'}</button>`}
    </div>
  </div>
</article>`;
}

function railMarkup(title, rank) {
  return `<article class="rail-card">
  <div class="poster" style="${fallbackStyle(title)}">
    <span class="fallback" aria-hidden="true"><span>${esc(mark(title.title))}</span></span>
    ${imgTag(title)}
    <span class="shade" aria-hidden="true"></span>
    <span class="rk">${num(rank)}</span>
    <button type="button" class="art-open" data-open="${title.id}" aria-label="جزئیات ${esc(titleFa(title))}"></button>
  </div>
  <div class="rname">${esc(titleFa(title))}</div>
  <div class="rmeta"><svg width="11" height="11" aria-hidden="true" style="color:var(--gold)"><use href="#i-star"/></svg>${num(title.rating, 1)}<i>·</i>${yearNum(title.year)}</div>
</article>`;
}

/* ---------- فهرست زنده ---------- */

function liveCardMarkup(title) {
  let tag = title.rating > 0
    ? `<span class="ltag"><svg aria-hidden="true"><use href="#i-star"/></svg>${num(title.rating, 1)}</span>`
    : `<span class="ltag">${esc(formatLabel(title))}</span>`;
  if (state.liveTab === 'airing' && title.airingAt) {
    tag = `<span class="ltag now" data-count="${title.airingAt}" data-ep="${title.nextEp || 0}">قسمت ${num(title.nextEp || 0)} · ${untilText(title.airingAt)}</span>`;
  } else if (title.status === 'soon') {
    tag = `<span class="ltag soon"><svg aria-hidden="true"><use href="#i-calendar"/></svg>${esc(releaseShort(title))}</span>`;
  }
  const sub = title.status === 'airing' && title.nextEp ? `قسمت ${num(title.nextEp)}` : (title.status === 'soon' ? releaseShort(title) : yearNum(title.year));
  return `<button type="button" class="lcard" data-open="${title.id}">
    <div class="poster" style="${fallbackStyle(title)}">
      <span class="fallback" aria-hidden="true"><span>${esc(mark(title.title))}</span></span>
      ${imgTag(title)}
      <span class="shade" aria-hidden="true"></span>
      <span class="lbadge">${tag}</span>
    </div>
    <div class="lname">${esc(titleFa(title))}</div>
    <div class="lmeta"><span>${esc(sub)}</span><i></i><span>${esc(title.genres[0] || '')}</span></div>
  </button>`;
}

function renderLiveTabs() {
  $$('[data-act="live-tab"]').forEach(button => {
    const active = button.dataset.tab === state.liveTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const upcomingCount = (live.upcoming || []).length;
  const airingCount = (live.airing || []).length;
  const cu = $('#live-count-upcoming');
  const ca = $('#live-count-airing');
  if (cu) cu.textContent = num(upcomingCount);
  if (ca) ca.textContent = num(airingCount);
}

function renderLiveMeta() {
  const pill = $('#live-pill');
  const pillText = $('#live-pill-text');
  const timeEl = $('#live-time');
  const upTime = $('#upcoming-time');
  const note = $('#live-note');
  const isLive = liveMeta.state === 'live';
  const isSnapshot = liveMeta.state === 'snapshot';
  if (pill) {
    pill.classList.toggle('off', !isLive);
    pill.title = isLive ? 'دادهٔ زنده از AniList' : 'نسخهٔ ذخیره‌شدهٔ داده‌ها';
  }
  if (pillText) pillText.textContent = isLive ? 'زنده' : isSnapshot ? 'ذخیره‌شده' : 'آفلاین';
  const stamp = clockText(live.updatedAt);
  if (timeEl) timeEl.textContent = stamp;
  if (upTime) upTime.textContent = stamp;
  if (note) {
    const count = (live.upcoming || []).length;
    note.textContent = isLive
      ? `دادهٔ زنده از AniList · ${num(count)} عنوان در راه · هر ۵ دقیقه خودکار تازه می‌شود.`
      : isSnapshot
        ? `اتصال زنده برقرار نشد؛ آخرین عکس فوری (${stamp}) نمایش داده می‌شود.`
        : 'دادهٔ زنده در دسترس نیست؛ با دکمهٔ «تازه‌سازی» دوباره امتحان کن.';
  }
  const copy = $('#upcoming-copy');
  if (copy) {
    const count = (live.upcoming || []).length;
    copy.textContent = count
      ? `${num(count)} عنوان اعلام‌شده که هنوز پخششان شروع نشده — مستقیم از AniList و تازه‌شونده.`
      : 'فعلاً عنوانی در فهرست «در راه» نیست؛ کمی بعد دوباره سر بزن.';
  }
  const foot = $('#foot-count');
  if (foot) foot.textContent = `${num(DATA.length)} عنوان · ${num((live.upcoming || []).length + (live.airing || []).length)} زنده`;
}

function renderLiveRail() {
  const host = $('#live-rail');
  if (!host) return;
  const items = live[state.liveTab] || [];
  renderLiveTabs();
  if (!items.length) {
    host.innerHTML = `<div class="live-skel"></div><div class="live-skel"></div><div class="live-skel"></div><div class="live-skel"></div><div class="live-skel"></div>`;
    return;
  }
  host.innerHTML = items.map(liveCardMarkup).join('');
}

function upcomingItems() {
  const list = (live.upcoming || []).slice();
  if (state.upSort === 'popular') {
    return list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0) || (a.startAt || Infinity) - (b.startAt || Infinity));
  }
  return list.sort((a, b) => {
    const av = a.startAt || Number.MAX_SAFE_INTEGER;
    const bv = b.startAt || Number.MAX_SAFE_INTEGER;
    return av - bv || (b.popularity || 0) - (a.popularity || 0);
  });
}

function renderUpcoming() {
  const grid = $('#upcoming-grid');
  if (!grid) return;
  const items = upcomingItems();
  grid.innerHTML = items.map(cardMarkup).join('');
  grid.hidden = items.length === 0;
  const empty = $('#upcoming-empty');
  if (empty) empty.hidden = items.length > 0;
  const seasons = $('#upcoming-seasons');
  if (seasons) {
    const counts = new Map();
    items.forEach(item => {
      const date = item.startAt ? new Date(item.startAt * 1000) : null;
      const key = date ? faDigits(date.getFullYear()) : (item.year ? yearNum(item.year) : 'نامشخص');
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    seasons.textContent = Array.from(counts.entries()).slice(0, 4).map(([year, count]) => `${year}: ${num(count)}`).join(' · ');
  }
  $$('[data-act="up-sort"]').forEach(button => {
    const active = button.dataset.sort === state.upSort;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
}

function tickCountdowns() {
  $$('[data-count]').forEach(el => {
    const ts = Number(el.dataset.count);
    if (!ts) return;
    const ep = el.dataset.ep;
    el.textContent = ep && Number(ep) > 0 ? `قسمت ${num(ep)} · ${untilText(ts)}` : untilText(ts);
  });
}

function renderLive() {
  renderLiveMeta();
  renderLiveRail();
  renderUpcoming();
}

async function loadLive({ silent = false } = {}) {
  if (liveMeta.busy) return;
  liveMeta.busy = true;
  const pill = $('#live-pill');
  if (pill) pill.classList.add('loading');
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 9000) : null;
  try {
    const payload = await fetchAniListLive(controller ? controller.signal : undefined);
    live = Object.assign({}, EMPTY_LIVE, payload);
    try { localStorage.setItem(LIVE_STORE, JSON.stringify(payload)); } catch (error) { /* حافظه پر است */ }
    liveMeta.state = 'live';
    registerLive();
    renderLive();
    renderCounts();
    if (state.view === 'watchlist') renderWatchlist();
    if (document.querySelector('#detail[open] [data-act="seen"]')) {
      const active = document.querySelector('#detail [data-act="seen"]');
      if (active && active.dataset.id) openDetail(active.dataset.id);
    }
    if (!silent) toast('داده‌های زنده تازه شد');
  } catch (error) {
    liveMeta.state = live.updatedAt ? 'snapshot' : 'empty';
    renderLiveMeta();
    if (!silent) toast('اتصال به AniList برقرار نشد؛ نسخهٔ ذخیره‌شده نمایش داده می‌شود');
  } finally {
    if (timer) clearTimeout(timer);
    liveMeta.busy = false;
    liveMeta.lastFetch = Date.now();
    if (pill) pill.classList.remove('loading');
  }
}

/* ---------- rendering ---------- */

function filtered() {
  const query = norm(state.q);
  let list = DATA.filter(title => (state.type === 'all' || title.type === state.type) && (state.genre === 'all' || title.genres.includes(state.genre)));
  if (query) {
    list = list.filter(title => norm([titleFa(title), title.title, title.romaji, title.jp, title.studio, title.year, title.genres.join(' ')].join(' ')).includes(query));
  }
  const sorters = {
    popular: (a, b) => b.popularity - a.popularity || b.rating - a.rating,
    score: (a, b) => b.rating - a.rating || b.popularity - a.popularity,
    new: (a, b) => b.year - a.year || b.rating - a.rating,
    old: (a, b) => a.year - b.year || b.rating - a.rating,
    name: (a, b) => titleFa(a).localeCompare(titleFa(b), 'fa'),
    'year-score': (a, b) => (b.year + b.rating) - (a.year + a.rating)
  };
  return list.sort(sorters[state.sort] || sorters.popular);
}

function renderGrid() {
  const list = filtered();
  const sig = [state.type, state.q, state.genre, state.sort].join('|');
  if (sig !== state.sig) {
    state.sig = sig;
    state.limit = PAGE_SIZE;
  }
  const shown = list.slice(0, state.limit);
  const grid = $('#grid');
  grid.innerHTML = shown.map(cardMarkup).join('');
  grid.hidden = list.length === 0;
  $('#empty').hidden = list.length > 0;
  if (!list.length) {
    $('#empty-copy').textContent = state.q ? 'برای «' + state.q + '» چیزی پیدا نشد. نام دیگری یا بخشی از نام را امتحان کن.' : 'با این ژانر در این دسته چیزی نیست؛ ژانر یا نوع را عوض کن.';
  }
  const more = $('#more');
  if (more) {
    const remaining = list.length - shown.length;
    more.hidden = remaining <= 0;
    more.textContent = remaining > 0 ? `نمایش ${num(Math.min(remaining, PAGE_SIZE))} عنوان بیشتر (${num(remaining)} باقی‌مانده)` : '';
  }
  const typeLabel = state.type === 'tv' ? 'سریال' : state.type === 'movie' ? 'فیلم' : 'عنوان';
  $('#result-note').innerHTML = `<b>${num(list.length)}</b> ${typeLabel}${state.genre === 'all' ? '' : ' · ' + esc(state.genre)}${state.q ? ' · جست‌وجو' : ''}`;
}

function renderGenres() {
  const host = $('#genres');
  if (!host) return;
  const counts = new Map();
  DATA.filter(title => state.type === 'all' || title.type === state.type).forEach(title => {
    title.genres.forEach(genreName => counts.set(genreName, (counts.get(genreName) || 0) + 1));
  });
  const available = GENRES.filter(genreName => counts.has(genreName));
  if (state.genre !== 'all' && !available.includes(state.genre)) state.genre = 'all';
  host.innerHTML = `<button type="button" class="chip ${state.genre === 'all' ? 'on' : ''}" data-act="genre" data-genre="all">همهٔ ژانرها</button>` +
    available.map(genreName => `<button type="button" class="chip ${state.genre === genreName ? 'on' : ''}" data-act="genre" data-genre="${esc(genreName)}">${esc(genreName)} <span style="opacity:.6;font-size:10px">${num(counts.get(genreName))}</span></button>`).join('');
}

function renderCounts() {
  const tv = DATA.filter(title => title.type === 'tv').length;
  const movie = DATA.filter(title => title.type === 'movie').length;
  $('#count-all').textContent = num(DATA.length);
  $('#count-tv').textContent = num(tv);
  $('#count-movie').textContent = num(movie);
  ['#nav-want', '#tab-want'].forEach(sel => {
    const el = $(sel);
    if (el) el.textContent = num(state.wanted.size);
  });
  $('#tab-seen').textContent = num(state.seen.size);
  const dock = $('#dock-want');
  if (dock) {
    dock.hidden = state.wanted.size === 0;
    dock.textContent = state.wanted.size > 99 ? '۹۹+' : num(state.wanted.size);
  }
  renderLiveMeta();
}

function renderRail() {
  const host = $('#rail');
  if (!host) return;
  const list = DATA.filter(title => title.popularity > 150000 || title.local)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10);
  host.innerHTML = list.map((title, index) => railMarkup(title, index + 1)).join('');
}

function renderWatchlist() {
  const set = state.listTab === 'wanted' ? state.wanted : state.seen;
  const list = Array.from(set).map(titleOf).filter(Boolean).sort((a, b) => b.rating - a.rating);
  $('#list-grid').innerHTML = list.map(cardMarkup).join('');
  $('#list-grid').hidden = list.length === 0;
  $('#list-empty').hidden = list.length > 0;
  $('#list-empty-title').textContent = state.listTab === 'wanted' ? 'لیست تماشا خالی است' : 'هنوز چیزی را ندیده علامت نزدی';
  $('#list-empty-copy').textContent = state.listTab === 'wanted'
    ? 'روی نشانک کنار هر انیمه بزن تا برای بعد ذخیره شود — حتی از بخش «در راه».'
    : 'زیر هر کارت «دیدم» را بزن؛ بعد اینجا آمار و پیشرفتت را ببین.';
  $$('.list-tabs button').forEach(button => {
    const active = button.dataset.tab === state.listTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
}

function renderStats() {
  const seenTitles = DATA.filter(title => state.seen.has(title.id));
  const rated = Array.from(state.ratings.entries()).filter(([id]) => !!titleOf(id));
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
  <div class="progress-card">
    <h3>در راه، برای تماشا</h3>
    <p style="font-size:12px;color:var(--muted)">${num((live.upcoming || []).length)} عنوان اعلام‌شده در صف انتشار و ${num((live.airing || []).length)} عنوان در حال پخش — بخش «در راه» را ببین.</p>
  </div>
  ${seenTitles.length ? '' : '<div class="empty" style="margin:26px auto"><svg aria-hidden="true"><use href="#i-chart"/></svg><h3>هنوز آماری نیست</h3><p>چند انیمه را «دیدم» بزن تا این صفحه پر شود.</p></div>'}`;
}

/* ---------- hero ---------- */

let heroIndex = 0;
let heroTimer = null;

function heroPool() {
  const popular = DATA.filter(title => title.popularity > 120000);
  const pool = (popular.length >= 8 ? popular : DATA).slice().sort((a, b) => b.rating - a.rating);
  return pool.slice(0, 8);
}

function renderHero() {
  const pool = heroPool();
  const host = $('#hero');
  if (!pool.length || !host) return;
  const position = heroIndex % pool.length;
  const title = pool[position];
  const wanted = state.wanted.has(title.id);
  const seen = state.seen.has(title.id);
  const alt = altTitle(title);

  host.innerHTML = `
  <div class="hero-copy">
    <div class="eyebrow"><span class="dot"></span>انتخاب امروز از ${num(DATA.length)} عنوان<span aria-hidden="true">·</span><span>${num(position + 1)} از ${num(pool.length)}</span></div>
    <h1><span>${esc(titleFa(title))}</span><span class="en">${esc(title.title)}</span></h1>
    ${title.jp ? `<div class="hero-jp" dir="ltr">${esc(title.jp)}</div>` : (alt && alt !== title.title ? `<div class="hero-jp" dir="ltr">${esc(alt)}</div>` : '')}
    ${summaryMarkup(title, 'hero-summary')}
    <div class="meta-row">
      <span class="chip score"><svg aria-hidden="true" width="12" height="12"><use href="#i-star"/></svg><b>${num(title.rating, 1)}</b></span>
      <span class="chip">${yearNum(title.year)}</span>
      ${title.studio && title.studio !== '—' ? `<span class="chip">${esc(title.studio)}</span>` : ''}
      <span class="chip">${lengthLabel(title)}</span>
      ${title.genres.slice(0, 2).map(genreName => `<span class="chip">${esc(genreName)}</span>`).join('')}
    </div>
    <div class="hero-actions">
      <button type="button" class="btn primary" data-open="${title.id}"><svg aria-hidden="true"><use href="#i-play"/></svg>جزئیات و خلاصه</button>
      <button type="button" class="btn ghost ${wanted ? 'on' : ''}" data-act="want" data-id="${title.id}" aria-pressed="${wanted}"><svg aria-hidden="true"><use href="#i-bookmark"/></svg>${wanted ? 'در لیست تماشا' : 'افزودن به لیست'}</button>
      <button type="button" class="btn ghost ${seen ? 'on' : ''}" data-act="seen" data-id="${title.id}" aria-pressed="${seen}"><svg aria-hidden="true"><use href="#i-check"/></svg>${seen ? 'دیده‌ام' : 'دیدم'}</button>
    </div>
    <div class="hero-nav">
      <button type="button" data-act="hero-prev" aria-label="پیشنهاد قبلی"><svg aria-hidden="true"><use href="#i-right"/></svg></button>
      <button type="button" data-act="hero-next" aria-label="پیشنهاد بعدی"><svg aria-hidden="true"><use href="#i-left"/></svg></button>
      <div class="hero-dots">${pool.map((item, index) => `<i data-act="hero-dot" data-i="${index}" class="${index === position ? 'on' : ''}" role="button" tabindex="0" aria-label="پیشنهاد ${num(index + 1)}"></i>`).join('')}</div>
    </div>
  </div>
  <div class="hero-poster" style="${fallbackStyle(title)}">
    <span class="fallback" aria-hidden="true"><span>${esc(mark(title.title))}</span></span>
    ${imgTag(title, { eager: true })}
    <span class="hero-rank">پیشنهاد ${num(position + 1)}</span>
  </div>`;
}

function startHeroTimer() {
  stopHeroTimer();
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  heroTimer = setInterval(() => {
    if (state.view !== 'collection' || document.hidden) return;
    heroIndex += 1;
    renderHero();
  }, 8000);
}

function stopHeroTimer() {
  if (heroTimer) clearInterval(heroTimer);
  heroTimer = null;
}

/* ---------- detail dialog ---------- */

function franchiseKey(value) {
  return norm(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean).slice(0, 2).join(' ');
}

function relatedTo(title) {
  const base = franchiseKey(title.title);
  const picked = new Set([base]);
  const pool = DATA
    .filter(item => item.id !== title.id && item.anilistId !== title.anilistId)
    .map(item => ({ item, shared: item.genres.filter(genreName => title.genres.includes(genreName)).length }))
    .filter(entry => entry.shared > 0)
    .sort((a, b) => b.shared - a.shared || b.item.popularity - a.item.popularity || b.item.rating - a.item.rating);
  const result = [];
  // از هر فرنچایز فقط یک عنوان، تا به‌جای فصل‌های تکراری تنوع داشته باشیم.
  for (const entry of pool) {
    const key = franchiseKey(entry.item.title);
    if (picked.has(key)) continue;
    picked.add(key);
    result.push(entry.item);
    if (result.length === 4) break;
  }
  return result;
}

function openDetail(id) {
  const title = titleOf(id);
  const dialog = $('#detail');
  if (!title || !dialog) return;
  const rating = state.ratings.get(title.id) || 0;
  const seen = state.seen.has(title.id);
  const wanted = state.wanted.has(title.id);
  const related = relatedTo(title);
  const alt = altTitle(title);
  const soon = title.status === 'soon';
  const link = title.siteUrl || (title.anilistId ? `https://anilist.co/anime/${title.anilistId}` : '');

  $('#detail-body').innerHTML = `<div class="detail">
    <div class="detail-poster" style="${fallbackStyle(title)}">
      <span class="fallback" aria-hidden="true"><span>${esc(mark(title.title))}</span></span>
      ${imgTag(title, { eager: true })}
    </div>
    <div class="detail-body">
      <h2 id="detail-title">${esc(titleFa(title))}</h2>
      ${alt ? `<div class="en"${/[A-Za-z]/.test(alt) ? ' dir="ltr"' : ''}>${esc(alt)}</div>` : ''}
      ${title.jp && title.jp !== alt ? `<div class="jp-line" dir="ltr">${esc(title.jp)}</div>` : ''}
      <div class="meta-row" style="margin-top:10px">
        ${title.rating > 0 ? `<span class="chip score"><svg aria-hidden="true" width="12" height="12"><use href="#i-star"/></svg><b>${num(title.rating, 1)}</b></span>` : '<span class="chip live">بدون نمره</span>'}
        <span class="chip">${yearNum(title.year)}</span>
        <span class="chip">${esc(formatLabel(title))}</span>
        ${soon ? `<span class="chip live"><svg aria-hidden="true" width="11" height="11"><use href="#i-calendar"/></svg>${esc(releaseShort(title))}</span>` : ''}
        ${title.genres.map(genreName => `<span class="chip">${esc(genreName)}</span>`).join('')}
      </div>
      ${title.airingAt ? `<div class="airing-box"><span class="live-dot" aria-hidden="true"></span><span>قسمت <b>${num(title.nextEp || 0)}</b> — <span data-count="${title.airingAt}" data-ep="${title.nextEp || 0}">${untilText(title.airingAt)}</span></span></div>` : ''}
      ${summaryMarkup(title)}
      ${title.summaryLang === 'en' ? '<div class="summary-note">خلاصهٔ رسمی AniList به انگلیسی — برگردان فارسی هنوز ندارد</div>' : ''}
      <div class="facts">
        <div class="fact"><span>استودیو</span><b>${esc(title.studio || '—')}</b></div>
        <div class="fact"><span>${soon ? 'شروع پخش' : 'سال انتشار'}</span><b>${soon ? esc(releaseShort(title)) : yearNum(title.year)}</b></div>
        <div class="fact"><span>${title.type === 'movie' ? 'مدت' : 'تعداد قسمت'}</span><b>${lengthLabel(title)}</b></div>
      </div>
      <div class="rate-row">
        <h3>نمرهٔ تو (۱ تا ۱۰)${rating ? ' — نمرهٔ فعلی: ' + num(rating) : ''}</h3>
        <div class="rate">${Array.from({ length: 10 }, (_, index) => index + 1).map(value => `<button type="button" class="${value === rating ? 'on' : ''}" data-act="rate" data-id="${title.id}" data-n="${value}" aria-pressed="${value === rating}" aria-label="نمرهٔ ${num(value)}">${num(value)}</button>`).join('')}</div>
      </div>
      <div class="detail-actions">
        <button type="button" class="btn ghost ${wanted ? 'on' : ''}" data-act="want" data-id="${title.id}" aria-pressed="${wanted}"><svg aria-hidden="true"><use href="#i-bookmark"/></svg>${wanted ? 'در لیست تماشا' : soon ? 'یادآوری کن' : 'افزودن به لیست'}</button>
        ${soon ? '' : `<button type="button" class="btn ${seen ? 'ghost on' : 'primary'}" data-act="seen" data-id="${title.id}" aria-pressed="${seen}"><svg aria-hidden="true"><use href="#i-check"/></svg>${seen ? 'دیدم' : 'ثبت تماشا'}</button>`}
        ${rating ? `<button type="button" class="btn ghost" data-act="clear-rate" data-id="${title.id}">پاک کردن نمره</button>` : ''}
        ${link ? `<a class="btn ghost" href="${esc(link)}" target="_blank" rel="noopener noreferrer">صفحهٔ AniList</a>` : ''}
      </div>
      ${related.length ? `<div class="related"><h3>اگر این را دوست داشتی</h3><div class="related-row">${related.map(item => `<article class="related-item">
        <div class="poster" style="${fallbackStyle(item)}">
          <span class="fallback" aria-hidden="true"><span>${esc(mark(item.title))}</span></span>
          ${imgTag(item)}
          <button type="button" class="art-open" data-open="${item.id}" aria-label="جزئیات ${esc(titleFa(item))}"></button>
        </div>
        <div class="rn">${esc(titleFa(item))}</div>
      </article>`).join('')}</div></div>` : ''}
    </div>
  </div>`;

  if (!dialog.open) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
  dialog.scrollTop = 0;
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
  renderGenres();
  if (state.view === 'watchlist') renderWatchlist();
  if (state.view === 'stats') renderStats();
  if (state.view === 'upcoming') renderUpcoming();
  if ($('#detail').open) {
    const el = $('#detail [data-act="seen"], #detail [data-act="want"]');
    if (el && el.dataset.id) openDetail(el.dataset.id);
  }
}

function toggleSeen(id) {
  if (!titleOf(id)) return;
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
  if (!titleOf(id)) return;
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
  if (!titleOf(id) || !(value >= 1 && value <= 10)) return;
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
  $$('.seg button[data-type]').forEach(button => {
    const active = button.dataset.type === type;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  renderGenres();
  renderGrid();
}

function showView(view) {
  state.view = view;
  $('#collection-view').hidden = view !== 'collection';
  $('#upcoming-view').hidden = view !== 'upcoming';
  $('#watchlist-view').hidden = view !== 'watchlist';
  $('#stats-view').hidden = view !== 'stats';
  $$('[data-act="view"]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  if (view === 'upcoming') renderUpcoming();
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
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#07060b' : '#fff8fb');
}

/* ---------- events ---------- */

document.addEventListener('click', event => {
  const actionEl = event.target.closest('[data-act]');
  if (actionEl) {
    const { act } = actionEl.dataset;
    if (act === 'view') showView(actionEl.dataset.view);
    else if (act === 'type') setType(actionEl.dataset.type);
    else if (act === 'genre') {
      state.genre = actionEl.dataset.genre;
      renderGenres();
      renderGrid();
    }
    else if (act === 'live-tab') { state.liveTab = actionEl.dataset.tab; renderLiveRail(); }
    else if (act === 'up-sort') { state.upSort = actionEl.dataset.sort; renderUpcoming(); }
    else if (act === 'live-refresh') {
      actionEl.disabled = true;
      loadLive().finally(() => { actionEl.disabled = false; });
    }
    else if (act === 'want') toggleWant(actionEl.dataset.id);
    else if (act === 'seen') toggleSeen(actionEl.dataset.id);
    else if (act === 'rate') setRating(actionEl.dataset.id, Number(actionEl.dataset.n));
    else if (act === 'clear-rate') clearRating(actionEl.dataset.id);
    else if (act === 'list-tab') { state.listTab = actionEl.dataset.tab; renderWatchlist(); }
    else if (act === 'more') { state.limit += PAGE_SIZE; renderGrid(); }
    else if (act === 'hero-next') { heroIndex += 1; renderHero(); }
    else if (act === 'hero-prev') { heroIndex = (heroIndex - 1 + heroPool().length) % heroPool().length; renderHero(); }
    else if (act === 'hero-dot') { heroIndex = Number(actionEl.dataset.i); renderHero(); }
    else if (act === 'theme') setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    else if (act === 'close') closeDetail();
    else if (act === 'jump') {
      showView('collection');
      const target = document.getElementById(actionEl.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
  const count = window.innerWidth < 760 ? 5 : 9;
  for (let i = 0; i < count; i += 1) {
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
renderRail();
renderGenres();
renderGrid();
renderWatchlist();
renderLive();
startHeroTimer();
loadLive({ silent: true });
tickCountdowns();

setInterval(tickCountdowns, 20000);
setInterval(() => {
  if (document.hidden) return;
  if (Date.now() - liveMeta.lastFetch > 280000) loadLive({ silent: true });
}, 45000);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopHeroTimer();
    return;
  }
  startHeroTimer();
  if (Date.now() - liveMeta.lastFetch > 120000) loadLive({ silent: true });
});
})();
