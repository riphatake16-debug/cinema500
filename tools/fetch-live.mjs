import { writeFile } from 'node:fs/promises';
import { genreFa } from './anime-genres.mjs';
import { stripHtml, shorten } from './anime-format.mjs';

/**
 * عکس فوری از فهرست‌های زندهٔ AniList برای وقتی که مرورگر به AniList دسترسی ندارد.
 * نسخهٔ زنده در مرورگر مستقیم از AniList خوانده می‌شود.
 * اجرا: node tools/fetch-live.mjs
 */
const OUT = new URL('../anime-site/live-data.js', import.meta.url);

const FIELDS = `
  id title{romaji english native} format status episodes duration seasonYear
  startDate{year month day} averageScore popularity genres description(asHtml:false)
  coverImage{extraLarge color} studios(isMain:true){nodes{name}}
  nextAiringEpisode{airingAt episode} siteUrl`;

const COUNTS = { upcoming: 36, airing: 30, trending: 24, top: 12 };
const FILTERS = {
  upcoming: 'type:ANIME,status:NOT_YET_RELEASED,sort:POPULARITY_DESC,isAdult:false',
  airing: 'type:ANIME,status:RELEASING,sort:POPULARITY_DESC,isAdult:false',
  trending: 'type:ANIME,sort:TRENDING_DESC,status_in:[RELEASING,FINISHED],isAdult:false',
  top: 'type:ANIME,sort:SCORE_DESC,popularity_greater:20000,isAdult:false'
};

const STATUS = { RELEASING: 'airing', FINISHED: 'done', NOT_YET_RELEASED: 'soon', CANCELLED: 'done', HIATUS: 'airing' };

const QUERY = `query {
${Object.keys(COUNTS).map(key => `  ${key}: Page(page:1,perPage:${COUNTS[key]}){ media(${FILTERS[key]}){${FIELDS}} }`).join('\n')}
}`;

function normalize(media) {
  const info = media.title || {};
  const cover = media.coverImage || {};
  const next = media.nextAiringEpisode || null;
  const date = media.startDate || {};
  return {
    id: `l${media.id}`,
    anilistId: media.id,
    type: media.format === 'MOVIE' ? 'movie' : 'tv',
    format: media.format || 'TV',
    status: STATUS[media.status] || 'done',
    title: info.english || info.romaji || info.native || `Anime ${media.id}`,
    romaji: info.romaji || '',
    jp: info.native || '',
    year: media.seasonYear || date.year || 0,
    rating: media.averageScore ? Math.round(media.averageScore) / 10 : 0,
    studio: (media.studios && media.studios.nodes && media.studios.nodes[0] && media.studios.nodes[0].name) || '—',
    episodes: media.episodes || 0,
    runtime: media.duration || 0,
    genres: (media.genres || []).map(name => genreFa(name)),
    summary: shorten(stripHtml(media.description), 280),
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

try {
  const response = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: QUERY })
  });
  if (!response.ok) throw new Error(`AniList HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.errors) throw new Error(`AniList: ${JSON.stringify(payload.errors)}`);

  const live = { updatedAt: Date.now(), source: 'AniList' };
  Object.keys(COUNTS).forEach(key => {
    const media = (payload.data && payload.data[key] && payload.data[key].media) || [];
    live[key] = media.filter(item => item.coverImage && item.coverImage.extraLarge).map(normalize);
  });

  const code = `/* انیمه ۵۰۰ — عکس فوری دادهٔ زنده (${new Date(live.updatedAt).toISOString()})
   اجرا: node tools/fetch-live.mjs — نسخهٔ زنده در مرورگر مستقیم از AniList خوانده می‌شود. */
window.ANIME_LIVE = ${JSON.stringify(live)};
`;
  await writeFile(OUT, code);
  console.log(`✓ live-data.js — ${(Buffer.byteLength(code) / 1024).toFixed(0)}KB · در راه ${live.upcoming.length} · در حال پخش ${live.airing.length} · ترند ${live.trending.length}`);
} catch (error) {
  console.error('✗', error.message);
  process.exit(1);
}
