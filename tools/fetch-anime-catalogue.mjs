/**
 * انیمه ۵۰۰ — ساخت کاتالوگ بزرگ از AniList
 *
 * هزاران عنوان (سریال، فیلم، ONA، OVA و ویژه) را با پوستر باکیفیت (extraLarge)
 * از AniList می‌گیرد، نام/خلاصهٔ فارسی عنوان‌های موجود را حفظ می‌کند و
 * anime-site/anime-data.js را بازتولید می‌کند.
 *
 * اجرا: node tools/fetch-anime-catalogue.mjs            (پیش‌فرض ۳۰۰۰ عنوان)
 *       TARGET=1000 node tools/fetch-anime-catalogue.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { genreFa } from './anime-genres.mjs';
import { stripHtml, shorten, slug } from './anime-format.mjs';

const TARGET = Number(process.env.TARGET || 3000);
const OUT_JS = new URL('../anime-site/anime-data.js', import.meta.url);
const FA_SOURCE = new URL('./anime-fa-source.json', import.meta.url);
const POSTER_MAP = new URL('../anime-site/poster-map.js', import.meta.url);
const PAUSE = Number(process.env.PAUSE || 2100);

const QUERY = `query($page:Int){
  Page(page:$page,perPage:50){
    pageInfo{hasNextPage}
    media(type:ANIME,sort:POPULARITY_DESC,isAdult:false,format_in:[TV,TV_SHORT,MOVIE,ONA,OVA,SPECIAL]){
      id
      title{romaji english native}
      format
      status
      episodes
      duration
      seasonYear
      startDate{year month day}
      averageScore
      popularity
      genres
      description(asHtml:false)
      coverImage{extraLarge color}
      studios(isMain:true){nodes{name}}
    }
  }
}`;

const STATUS = { RELEASING: 'airing', FINISHED: 'done', NOT_YET_RELEASED: 'soon', CANCELLED: 'done', HIATUS: 'airing' };

const norm = value => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '')
  .trim();

async function loadPersianSource() {
  if (existsSync(FA_SOURCE)) {
    return JSON.parse(await readFile(FA_SOURCE, 'utf8'));
  }
  const code = await readFile(new URL('../anime-site/anime-data.js', import.meta.url), 'utf8');
  const sandbox = {};
  new Function('window', code)(sandbox);
  const titles = (sandbox.ANIME_CATALOGUE && sandbox.ANIME_CATALOGUE.titles) || [];
  const source = titles.map(title => ({
    id: title.id,
    title: title.title,
    fa: title.fa,
    jp: title.jp,
    summary: title.summary,
    type: title.type,
    year: title.year,
    studio: title.studio,
    episodes: title.episodes,
    runtime: title.runtime
  }));
  await writeFile(FA_SOURCE, JSON.stringify(source, null, 1) + '\n');
  return source;
}

async function loadLocalPosters() {
  try {
    const code = await readFile(POSTER_MAP, 'utf8');
    const sandbox = {};
    new Function('window', code)(sandbox);
    return sandbox.ANIME_POSTERS || {};
  } catch (error) {
    return {};
  }
}

async function fetchPage(page, attempt = 1) {
  const response = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { page } })
  });
  if (response.status === 429 || response.status >= 500) {
    if (attempt > 6) throw new Error(`AniList HTTP ${response.status} (page ${page})`);
    const wait = 3000 * attempt;
    console.warn(`  ! HTTP ${response.status} — تلاش دوباره پس از ${wait}ms`);
    await new Promise(resolve => setTimeout(resolve, wait));
    return fetchPage(page, attempt + 1);
  }
  if (!response.ok) throw new Error(`AniList HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.errors) throw new Error(`AniList: ${JSON.stringify(payload.errors)}`);
  return payload.data.Page;
}

async function main() {
  const persian = await loadPersianSource();
  const localPosters = await loadLocalPosters();
  const byNorm = new Map();
  persian.forEach(item => {
    [item.title, item.fa].forEach(key => {
      const n = norm(key);
      if (n && !byNorm.has(n)) byNorm.set(n, item);
    });
  });

  const media = [];
  const seen = new Set();
  let page = 1;
  while (media.length < TARGET && page <= 90) {
    const result = await fetchPage(page);
    for (const item of result.media) {
      if (seen.has(item.id)) continue;
      if (!item.averageScore || !item.coverImage || !item.coverImage.extraLarge) continue;
      if (!item.seasonYear && !(item.startDate && item.startDate.year)) continue;
      seen.add(item.id);
      media.push(item);
      if (media.length >= TARGET) break;
    }
    console.log(`  · صفحهٔ ${page}: ${result.media.length} عنوان (جمع: ${media.length})`);
    if (!result.pageInfo.hasNextPage) break;
    page += 1;
    await new Promise(resolve => setTimeout(resolve, PAUSE));
  }

  const usedIds = new Set();
  const matchedIds = new Set();
  const titles = media.map(item => {
    const english = item.title.english || '';
    const romaji = item.title.romaji || '';
    const displayTitle = english || romaji || item.title.native || `Anime ${item.id}`;
    const match = byNorm.get(norm(english)) || byNorm.get(norm(romaji));
    if (match) matchedIds.add(match.id);
    let id = match ? match.id : slug(displayTitle, `a${item.id}`);
    if (usedIds.has(id)) id = `${id}-${item.id}`;
    usedIds.add(id);

    const year = item.seasonYear || (item.startDate && item.startDate.year) || 0;
    const isMovie = item.format === 'MOVIE';
    const genres = Array.from(new Set(item.genres.map(name => genreFa(name))));
    const summaryFa = match && match.summary ? String(match.summary).trim() : '';
    const summaryEn = stripHtml(item.description);
    const studio = (item.studios && item.studios.nodes && item.studios.nodes[0] && item.studios.nodes[0].name) || '—';

    return {
      id,
      anilistId: item.id,
      type: isMovie ? 'movie' : 'tv',
      format: item.format,
      status: STATUS[item.status] || 'done',
      title: displayTitle,
      romaji,
      fa: match && match.fa ? match.fa : '',
      jp: (match && match.jp) || item.title.native || '',
      year,
      rating: Math.round(item.averageScore) / 10,
      studio: (match && match.studio) || studio,
      episodes: isMovie ? 0 : (item.episodes || 0),
      runtime: item.duration || 0,
      genres,
      summary: summaryFa || shorten(summaryEn, 280),
      summaryLang: summaryFa ? 'fa' : 'en',
      poster: item.coverImage.extraLarge,
      color: item.coverImage.color || '',
      popularity: item.popularity || 0,
      local: localPosters[id] || ''
    };
  });

  // عنوان‌های دست‌چین‌شدهٔ فارسی که در فهرست محبوب AniList نبودند، با پوستر محلی نگه داشته می‌شوند.
  persian.forEach(item => {
    if (matchedIds.has(item.id) || usedIds.has(item.id)) return;
    usedIds.add(item.id);
    titles.push({
      id: item.id,
      anilistId: 0,
      type: item.type === 'movie' ? 'movie' : 'tv',
      format: item.type === 'movie' ? 'MOVIE' : 'TV',
      status: 'done',
      title: item.title,
      romaji: '',
      fa: item.fa || '',
      jp: item.jp || '',
      year: item.year || 0,
      rating: Number(item.rating) || 0,
      studio: item.studio || '—',
      episodes: item.type === 'movie' ? 0 : (item.episodes || 0),
      runtime: item.runtime || 0,
      genres: Array.isArray(item.genres) ? item.genres : [],
      summary: item.summary || '',
      summaryLang: 'fa',
      poster: '',
      color: '',
      popularity: 0,
      local: localPosters[item.id] || ''
    });
  });

  titles.sort((a, b) => b.popularity - a.popularity);

  const payload = `/* انیمه ۵۰۰ — کاتالوگ ${titles.length} عنوان (تولیدشده از AniList)
   اجرا: node tools/fetch-anime-catalogue.mjs — این فایل را دستی ویرایش نکن. */
window.ANIME_CATALOGUE = {
  "updatedAt": "${new Date().toISOString().slice(0, 10)}",
  "source": "AniList",
  "titles": [
${titles.map(title => JSON.stringify(title)).join(',\n')}
  ]
};
`;
  await writeFile(OUT_JS, payload);
  const faCount = titles.filter(title => title.fa).length;
  const size = Buffer.byteLength(payload) / 1024;
  console.log(`✓ ${titles.length} عنوان نوشته شد (${size.toFixed(0)}KB) — ${faCount} نام فارسی، ${titles.filter(t => t.type === 'movie').length} فیلم، ${titles.filter(t => t.type === 'tv').length} سریال`);
}

main().catch(error => {
  console.error('✗', error.message);
  process.exit(1);
});
