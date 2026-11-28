#!/usr/bin/env node
/**
 * ترجمهٔ خودکار خلاصه‌ها و نام‌های انگلیسی کاتالوگ به فارسی.
 * اجرا: node tools/translate-anime-fa.mjs [--limit N] [--seconds S]
 *
 * نتیجه در tools/anime-fa-auto.json ذخیره می‌شود (قابل ادامه‌دادن) و سپس در
 * anime-site/anime-data.js نوشته می‌شود. اگر وسط کار قطع شد، دوباره اجرا کن؛
 * فقط عنوان‌های ترجمه‌نشده پردازش می‌شوند.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_FILE = path.join(ROOT, 'anime-site/anime-data.js');
const CACHE_FILE = path.join(ROOT, 'tools/anime-fa-auto.json');

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : fallback;
};
const LIMIT = arg('limit', Infinity);
const SECONDS = arg('seconds', 240);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function readCatalogue() {
  const src = fs.readFileSync(DATA_FILE, 'utf8');
  const window = {};
  new Function('window', src)(window);
  if (!window.ANIME_CATALOGUE || !Array.isArray(window.ANIME_CATALOGUE.titles)) {
    throw new Error('anime-data.js قابل خواندن نبود');
  }
  return { meta: window.ANIME_CATALOGUE, titles: window.ANIME_CATALOGUE.titles };
}

function writeCatalogue(meta, titles) {
  const head = `/* انیمه ۵۰۰ — کاتالوگ ${titles.length} عنوان (تولیدشده از AniList)\n   اجرا: node tools/fetch-anime-catalogue.mjs — این فایل را دستی ویرایش نکن. */\nwindow.ANIME_CATALOGUE = {\n  "updatedAt": ${JSON.stringify(meta.updatedAt || new Date().toISOString().slice(0, 10))},\n  "source": ${JSON.stringify(meta.source || 'AniList')},\n  "titles": [\n${titles.map(title => JSON.stringify(title)).join(',\n')}\n  ]\n};\n`;
  fs.writeFileSync(DATA_FILE, head);
}

async function googleTranslate(texts) {
  const url = 'https://translate.googleapis.com/translate_a/t?client=gtx&sl=en&tl=fa&' +
    texts.map(text => 'q=' + encodeURIComponent(text)).join('&');
  let lastError = 'unknown';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let response;
    try {
      response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    } catch (error) {
      lastError = error.message;
      await sleep(1200 * (attempt + 1));
      continue;
    }
    if (response.ok) {
      const data = await response.json().catch(() => null);
      const list = Array.isArray(data) ? data : [];
      if (list.length === texts.length) {
        return list.map(item => (typeof item === 'string' ? item : (Array.isArray(item) ? item[0] : '')));
      }
      lastError = 'unexpected shape';
    } else {
      lastError = `HTTP ${response.status}`;
    }
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(lastError);
}

const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
const saveCache = () => fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));

const { meta, titles } = readCatalogue();

// کارها: اول خلاصه‌ها (اولویت کاربر)، بعد نام‌های انگلیسی.
const jobs = [];
const seenText = new Set();
for (const title of titles) {
  const entry = cache[title.id] || (cache[title.id] = {});
  const summary = String(title.summary || '').trim();
  if (summary && title.summaryLang !== 'fa' && !entry.summary) {
    entry.summary = null;
    entry.summarySource = summary;
    if (!seenText.has(summary)) { seenText.add(summary); jobs.push({ id: title.id, field: 'summary', text: summary }); }
  }
}
for (const title of titles) {
  const entry = cache[title.id] || (cache[title.id] = {});
  const name = String(title.title || '').trim();
  if (!title.fa && name && !entry.title && /[A-Za-z]/.test(name)) {
    entry.title = null;
    entry.nameSource = name;
    if (!seenText.has(name)) { seenText.add(name); jobs.push({ id: title.id, field: 'title', text: name }); }
  }
}

if (!jobs.length) {
  console.log('همه چیز ترجمه شده است.');
  saveCache();
  process.exit(0);
}

console.log(`${jobs.length} متن برای ترجمه در صف است (تا ${LIMIT} در این اجرا).`);
const started = Date.now();
let done = 0;
let failed = 0;

// بسته‌بندی متن‌ها در یک درخواست تا سقف ~۱۸۰۰ نویسه.
function batches() {
  const list = [];
  let current = [];
  let chars = 0;
  for (const job of jobs) {
    if (current.length && (chars + job.text.length > 1800 || current.length >= 8)) {
      list.push(current);
      current = [];
      chars = 0;
    }
    current.push(job);
    chars += job.text.length + 8;
    if (current.length >= 8) { list.push(current); current = []; chars = 0; }
  }
  if (current.length) list.push(current);
  return list;
}

const queue = batches();
for (const batch of queue) {
  if (done >= LIMIT || (Date.now() - started) / 1000 > SECONDS) break;
  const texts = batch.map(job => job.text);
  try {
    const fa = await googleTranslate(texts);
    batch.forEach((job, index) => {
      const value = String(fa[index] || '').trim();
      if (!value) return;
      const entry = cache[job.id] || (cache[job.id] = {});
      entry[job.field] = value;
      done += 1;
    });
    saveCache();
    process.stdout.write(`\rترجمه شد: ${done} — باقی‌ماندهٔ این فهرست: ${jobs.length - done}   `);
  } catch (error) {
    failed += batch.length;
    console.error(`\nخطا در ترجمه (${error.message})؛ ${batch.length} متن رد شد.`);
    await sleep(2500);
  }
  await sleep(260);
}

// اعمال روی کاتالوگ
let appliedSummary = 0;
let appliedName = 0;
for (const title of titles) {
  const entry = cache[title.id];
  if (!entry) continue;
  if (entry.summary && title.summaryLang !== 'fa') {
    title.summary = entry.summary;
    title.summaryLang = 'fa';
    appliedSummary += 1;
  }
  if (entry.title && !title.fa) {
    title.fa = entry.title;
    appliedName += 1;
  }
}
writeCatalogue(meta, titles);
saveCache();

const remaining = titles.filter(title => title.summary && title.summaryLang !== 'fa').length;
console.log(`\nذخیره شد — خلاصهٔ فارسی: ${titles.length - remaining}/${titles.length} · نام فارسی: ${titles.filter(t => t.fa).length}/${titles.length} · خطا: ${failed}`);
if (remaining) process.exitCode = 2;
