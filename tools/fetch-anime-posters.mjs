/* Fetches real anime cover art from AniList into anime-site/posters/ and writes
   anime-site/poster-map.js  ({ id: 'posters/<id>.jpg' }). Run: node tools/fetch-anime-posters.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let sharp = null;
try {
  const sharpPath = process.env.SHARP_PATH || '/tmp/sharp-tools/node_modules/sharp';
  sharp = require(sharpPath);
} catch (error) {
  sharp = null;
}

const ROOT = path.resolve('.');
const OUT_DIR = path.join(ROOT, 'anime-site', 'posters');
const CACHE_DIR = path.join(ROOT, '.cache-posters');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

const win = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'anime', 'anime-data.js'), 'utf8'))(win);
const TITLES = win.ANIME_CATALOGUE.titles;

/* AniList ids for titles the fuzzy matcher gets wrong */
const OVERRIDES = {
  inthiscorner: 15227,
  boyheron: 109979,
  slamdunk: 128207
};

const API = 'https://graphql.anilist.co';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function gql(query, variables, attempt = 0) {
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 5) throw new Error(`AniList ${response.status}`);
    await sleep(2500 * (attempt + 1));
    return gql(query, variables, attempt + 1);
  }
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`AniList HTTP ${response.status} ${json ? JSON.stringify(json.errors ?? json) : ''}`.trim());
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const norm = value => String(value ?? '')
  .toLowerCase()
  .replace(/['’`]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\b(the|a|an|movie|film|part|season)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokens = value => new Set(norm(value).split(' ').filter(token => token.length > 1));

function similarity(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.72;
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  ta.forEach(token => { if (tb.has(token)) shared += 1; });
  return (2 * shared) / (ta.size + tb.size);
}

function candidateScore(entry, media) {
  const names = [media.title.english, media.title.romaji, media.title.native].filter(Boolean);
  const best = Math.max(...names.map(name => similarity(entry.title, name)));
  let score = best * 100;
  const year = media.startDate && media.startDate.year;
  if (year && entry.year) {
    const diff = Math.abs(year - entry.year);
    if (diff === 0) score += 26;
    else if (diff === 1) score += 12;
    else if (diff <= 3) score += 4;
    else score -= 14;
  }
  const format = media.format || '';
  if (entry.type === 'movie' && /MOVIE|SPECIAL/.test(format)) score += 12;
  if (entry.type === 'tv' && /TV|ONA|OVA/.test(format)) score += 12;
  if (entry.type === 'tv' && /MOVIE/.test(format)) score -= 22;
  if (entry.type === 'movie' && /^TV/.test(format)) score -= 18;
  return score;
}

const LIST_QUERY = `query($page:Int){Page(page:$page,perPage:50){media(type:ANIME,sort:POPULARITY_DESC){id format title{romaji english native} coverImage{medium large} startDate{year}}}}`;
const BY_ID_QUERY = `query($id:Int){Media(id:$id,type:ANIME){id format title{romaji english native} coverImage{medium large} startDate{year}}}`;
const SEARCH_QUERY = `query($q:String){Page(perPage:10){media(search:$q,type:ANIME,sort:SEARCH_MATCH){id format title{romaji english native} coverImage{medium large} startDate{year}}}}`;

const pool = [];
for (let page = 1; page <= 22; page += 1) {
  const data = await gql(LIST_QUERY, { page });
  pool.push(...data.Page.media);
  await sleep(1100);
}
console.log(`pool: ${pool.length} AniList entries`);

function pick(entry, candidates) {
  let best = null;
  for (const media of candidates) {
    const score = candidateScore(entry, media);
    if (!best || score > best.score) best = { media, score };
  }
  return best && best.score >= 62 ? best : null;
}

const results = [];
for (const entry of TITLES) {
  let match = null;
  if (OVERRIDES[entry.id]) {
    const data = await gql(BY_ID_QUERY, { id: OVERRIDES[entry.id] });
    match = { media: data.Media, score: 999 };
    await sleep(1100);
  }
  if (!match) match = pick(entry, pool);
  if (!match) {
    const data = await gql(SEARCH_QUERY, { q: entry.title });
    match = pick(entry, data.Page.media);
    await sleep(1200);
  }
  results.push({ entry, match });
  console.log(`${match ? 'ok  ' : 'MISS'} ${entry.id} <- ${match ? (match.media.title.english || match.media.title.romaji) : entry.title}`);
}

const map = {};
let downloaded = 0;
for (const { entry, match } of results) {
  if (!match) continue;
  const source = sharp ? match.media.coverImage.large : match.media.coverImage.medium;
  const cacheFile = path.join(CACHE_DIR, `${entry.id}.img`);
  const target = path.join(OUT_DIR, `${entry.id}.jpg`);
  try {
    if (fs.existsSync(target) && !process.env.FORCE) {
      map[entry.id] = `posters/${entry.id}.jpg`;
      downloaded += 1;
      continue;
    }
    if (!fs.existsSync(cacheFile)) {
      const response = await fetch(source, { headers: { 'User-Agent': 'Mozilla/5.0 anime500-poster-fetch' } });
      if (!response.ok) throw new Error(`cover HTTP ${response.status}`);
      fs.writeFileSync(cacheFile, Buffer.from(await response.arrayBuffer()));
      await sleep(350);
    }
    if (sharp) {
      await sharp(cacheFile).resize({ width: 380, withoutEnlargement: true }).jpeg({ quality: 76, mozjpeg: true }).toFile(target);
    } else {
      fs.copyFileSync(cacheFile, target);
    }
    map[entry.id] = `posters/${entry.id}.jpg`;
    downloaded += 1;
  } catch (error) {
    console.log(`FAIL ${entry.id}: ${error.message}`);
  }
}

const payload = `/* پوسترهای انیمه ۵۰۰ — منبع تصاویر: AniList (anilist.co) */\nwindow.ANIME_POSTERS = ${JSON.stringify(map, null, 2)};\n`;
fs.writeFileSync(path.join(ROOT, 'anime-site', 'poster-map.js'), payload);
fs.writeFileSync(path.join(CACHE_DIR, 'report.json'), JSON.stringify(results.map(({ entry, match }) => ({
  id: entry.id,
  title: entry.title,
  year: entry.year,
  type: entry.type,
  score: match ? Math.round(match.score) : 0,
  anilistId: match ? match.media.id : null,
  matched: match ? [match.media.title.english, match.media.title.romaji, match.media.startDate && match.media.startDate.year] : null
})), null, 2));

const misses = results.filter(item => !item.match).map(item => item.entry.id);
console.log(`\nposters: ${downloaded}/${TITLES.length}  sharp: ${sharp ? 'yes' : 'no'}`);
if (misses.length) console.log('no match:', misses.join(', '));
const bytes = fs.readdirSync(OUT_DIR).filter(file => file.endsWith('.jpg')).reduce((sum, file) => sum + fs.statSync(path.join(OUT_DIR, file)).size, 0);
console.log(`total poster bytes: ${(bytes / 1048576).toFixed(2)} MB`);
