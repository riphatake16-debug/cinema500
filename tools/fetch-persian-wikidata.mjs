/**
 * انیمه ۵۰۰ — نام و خلاصهٔ فارسی از ویکی‌داده و ویکی‌پدیای فارسی
 *
 * ویکی‌داده هر انیمه را با شناسهٔ AniList (P8729) به آیتم خودش وصل می‌کند؛
 * برچسب فارسی و توضیح کوتاه فارسی و نشانی مقالهٔ ویکی‌پدیای فارسی را از آن
 * می‌گیریم و مقدمهٔ مقاله را به‌عنوان خلاصه ذخیره می‌کنیم.
 *
 * اجرا: node tools/fetch-persian-wikidata.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const OUT = new URL('./anime-fa-wikidata.json', import.meta.url);
const USER_AGENT = 'Anime500/1.0 (https://github.com/riphatake16-debug/cinema500; Persian anime enrichment)';
const MAX_SUMMARY = 460;

const SPARQL = `SELECT ?anilist ?label ?desc ?article WHERE {
  ?item wdt:P8729 ?anilist .
  OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label)="fa") }
  OPTIONAL { ?item schema:description ?desc FILTER(LANG(?desc)="fa") }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://fa.wikipedia.org/> . }
}`;

const persianLetters = text => [...String(text || '')].filter(ch => /[\u0620-\u06ff]/.test(ch)).length;

function clean(text, maximum = MAX_SUMMARY) {
  let value = String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[\s*[\d۰-۹]+\s*\]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200e\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!value || persianLetters(value) < 12) return '';
  if (value.length > maximum) {
    const cut = value.slice(0, maximum);
    const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('؟ '), cut.lastIndexOf('! '));
    value = (stop > maximum * 0.5 ? cut.slice(0, stop + 1) : cut.slice(0, cut.lastIndexOf(' ')) + '…').trim();
  }
  return value;
}

/* «ناروتو (مجموعه تلویزیونی)» → «ناروتو» */
function cleanName(text) {
  let value = String(text || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (persianLetters(value) < 2) return '';
  value = value.replace(/\s*\((?:مجموعه[^)]*|فیلم[^)]*|انیمه[^)]*|انیمیشن[^)]*)\)\s*$/u, '').trim();
  return value;
}

async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } });
  if (response.status === 429 || response.status >= 500) {
    if (attempt > 4) throw new Error(`HTTP ${response.status}`);
    await new Promise(resolve => setTimeout(resolve, 2500 * attempt));
    return fetchJson(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function wikipediaIntros(articles) {
  const intros = new Map();
  const list = Array.from(articles);
  for (let index = 0; index < list.length; index += 18) {
    const batch = list.slice(index, index + 18);
    const url = 'https://fa.wikipedia.org/w/api.php?' + new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'extracts',
      inprop: 'url',
      exintro: '1',
      explaintext: '1',
      exchars: '800',
      redirects: '1',
      titles: batch.join('|')
    });
    try {
      const payload = await fetchJson(url);
      const pages = (payload.query && payload.query.pages) || [];
      for (const page of pages) {
        if (page.missing || page.ns !== 0) continue;
        const text = clean((page.extract || '').split('\n', 1)[0]);
        if (!text) continue;
        intros.set(page.title, {
          summary: text,
          url: `https://fa.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
        });
      }
    } catch (error) {
      console.warn(`  ! ویکی‌پدیا: ${error.message}`);
    }
    console.log(`  · مقدمه‌ها: ${Math.min(index + 18, list.length)}/${list.length}`);
    await new Promise(resolve => setTimeout(resolve, 700));
  }
  return intros;
}

async function main() {
  const catalogue = {};
  new Function('window', readFileSync(new URL('../anime-site/anime-data.js', import.meta.url), 'utf8'))(catalogue);
  const wanted = new Set(catalogue.ANIME_CATALOGUE.titles.map(title => title.anilistId).filter(Boolean));
  console.log(`  · ${wanted.size} شناسهٔ AniList در کاتالوگ`);

  const payload = await fetchJson('https://query.wikidata.org/sparql?' + new URLSearchParams({ format: 'json', query: SPARQL }));
  const rows = (payload.results && payload.results.bindings) || [];
  const items = new Map();
  for (const row of rows) {
    const anilistId = Number(row.anilist.value);
    if (!wanted.has(anilistId)) continue;
    const entry = items.get(anilistId) || {};
    if (!entry.fa && row.label) entry.fa = cleanName(row.label.value);
    if (!entry.summary && row.desc) entry.summary = clean(row.desc.value, 220);
    if (!entry.article && row.article) {
      const raw = decodeURIComponent((row.article.value.split('/wiki/')[1] || '')).replace(/_/g, ' ');
      if (raw) entry.article = raw;
    }
    items.set(anilistId, entry);
  }
  console.log(`  · ویکی‌داده: ${items.size} مورد مرتبط`);

  const articles = new Set(Array.from(items.values()).map(entry => entry.article).filter(Boolean));
  const intros = await wikipediaIntros(articles);
  console.log(`  · مقدمهٔ فارسی: ${intros.size} مقاله`);

  const result = {};
  let faNames = 0;
  let summaries = 0;
  items.forEach((entry, anilistId) => {
    const intro = entry.article ? intros.get(entry.article) : null;
    const fa = entry.fa || cleanName(entry.article);
    const summary = (intro && intro.summary) || entry.summary || '';
    if (!fa && !summary) return;
    result[anilistId] = { fa, summary };
    if (fa) faNames += 1;
    if (summary) summaries += 1;
  });

  writeFileSync(OUT, JSON.stringify(result, null, 0) + '\n');
  console.log(`✓ anime-fa-wikidata.json — ${Object.keys(result).length} عنوان · ${faNames} نام فارسی · ${summaries} خلاصهٔ فارسی`);
}

main().catch(error => {
  console.error('✗', error.message);
  process.exit(1);
});
