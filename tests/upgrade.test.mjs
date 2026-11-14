import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';

test('Vazirmatn is bundled locally with its license and no third-party font request', async () => {
  const [html, css] = await Promise.all([readFile('index.html', 'utf8'), readFile('style.css', 'utf8')]);
  assert.ok(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html), 'no Google Fonts request');
  assert.match(html, /rel="preload" href="\.\/fonts\/Vazirmatn-Variable\.woff2" as="font" type="font\/woff2" crossorigin/);
  assert.match(css, /@font-face\{font-family:Vazirmatn;src:url\('\.\/fonts\/Vazirmatn-Variable\.woff2'\) format\('woff2'\);font-weight:100 900/);
  const font = await stat('fonts/Vazirmatn-Variable.woff2');
  assert.ok(font.size > 50000, 'font payload present');
  assert.match(await readFile('fonts/OFL.txt', 'utf8'), /SIL Open Font License/);
});

test('offline shell precaches the app and keeps the live catalogue network-first', async () => {
  const [sw, register, html] = await Promise.all([readFile('sw.js', 'utf8'), readFile('sw-register.js', 'utf8'), readFile('index.html', 'utf8')]);
  for (const asset of ["'./index.html'", "'./app.js'", "'./style.css'", "'./mobile.css'", "'./fonts/Vazirmatn-Variable.woff2'"]) {
    assert.ok(sw.includes(asset), asset + ' must be precached');
  }
  assert.match(sw, /networkFirst\(request, SHELL_CACHE, 4000\)/, 'live catalogue stays network-first');
  assert.match(sw, /caches\.delete\(key\)/, 'old versions are removed');
  assert.match(sw, /const cached = await cache\.match\(request\);/, 'versioned assets are matched exactly, not through stale query strings');
  assert.match(sw, /Promise\.allSettled/, 'one missing optional file cannot break install');
  assert.match(register, /updateViaCache: 'none'/);
  assert.match(html, /src="\.\/sw-register\.js\?v=/);
});

test('permalinks work without any share control, and the manifest links stay inside the app', async () => {
  const app = await readFile('app.js', 'utf8');
  assert.match(app, /function deepLinkId\(\)/);
  assert.match(app, /url\.searchParams\.set\('t',id\)/);
  assert.ok(!/navigator\.share|data-share|shareTitle/.test(app), 'sharing controls are removed');
  const manifest = JSON.parse(await readFile('manifest.webmanifest', 'utf8'));
  const base = new URL('https://example.github.io/cinema500/manifest.webmanifest');
  assert.equal(manifest.shortcuts.length, 3);
  for (const shortcut of manifest.shortcuts) {
    const url = new URL(shortcut.url, base);
    assert.equal(url.pathname, '/cinema500/');
    assert.ok(['watchlist', 'roulette', 'stats'].includes(url.searchParams.get('view')), shortcut.url);
  }
});

test('search engines get crawlable content, brand schema and a fresh sitemap', async () => {
  const [html, robots, sitemap] = await Promise.all([
    readFile('index.html', 'utf8'),
    readFile('robots.txt', 'utf8'),
    readFile('sitemap.xml', 'utf8')
  ]);
  assert.match(robots, /Sitemap: https:\/\/riphatake16-debug\.github\.io\/cinema500\/sitemap\.xml/);
  assert.match(html, /<noscript><section class="noscript-index"/);
  const links = [...html.matchAll(/<noscript>[\s\S]*?<\/noscript>/g)][0][0].match(/<a href="\.\/\?t=tt\d{7,12}"/g);
  assert.equal(links.length, 40, 'crawlable title links');
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));
  const site = schemas.find((s) => s['@type'] === 'WebSite');
  assert.equal(site.name, 'سینما ۵۰۰');
  assert.match(site.potentialAction.target.urlTemplate, /\?q=\{search_term_string\}$/);
  assert.match(sitemap, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  assert.match(await readFile('app.js', 'utf8'), /function deepLinkQuery\(\)/, 'search URL is handled by the app');
});


test('the motion engine ships spring reveals, parallax, progress and a theme view transition', async () => {
  const [motion, css, app] = await Promise.all([readFile('motion.js', 'utf8'), readFile('mobile.css', 'utf8'), readFile('app.js', 'utf8')]);
  assert.match(motion, /cubic-bezier\(\.16,1,\.3,1\)/);
  assert.match(motion, /IntersectionObserver/);
  assert.match(motion, /scroll-progress/);
  assert.match(motion, /startViewTransition/);
  assert.match(motion, /translate3d\(0,' \+ shift/);
  assert.match(motion, /prefers-reduced-motion/);
  assert.match(css, /@keyframes auroraDrift/);
  assert.match(css, /@keyframes heroSheen/);
  assert.match(css, /@keyframes dialogSpringIn/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(app, /CinemaMotion\.transition\(apply,event\)/);
  assert.ok(!/icon-share|data-share/.test(await readFile('index.html', 'utf8')));
});


test('first screen stays light: card thumbnails and no per-card backdrop blur', async () => {
  const [app, css, script] = await Promise.all([readFile('app.js', 'utf8'), readFile('mobile.css', 'utf8'), readFile('scripts/build_thumbs.py', 'utf8').catch(() => readFile('../scripts/build_thumbs.py', 'utf8'))]);
  assert.match(app, /function thumbSrc\(a\)/);
  assert.match(app, /\/posters\/thumbs\//);
  assert.match(app, /<div class="poster">\$\{poster\(a,true\)\}/);
  assert.match(script, /Image\.LANCZOS/);
  const gridRule = css.match(/#grid > \.card,\.grid > \.card\{[^}]*\}/);
  assert.ok(gridRule, 'grid card rule exists');
  assert.ok(!/backdrop-filter/.test(gridRule[0]), 'cards must not composite a blur');
  assert.ok(!/auroraDrift 24s/.test(css), 'ambient gradient is static');
});
