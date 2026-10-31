import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = (name) => readFile(name, 'utf8');

test('mobile catalogue stays two-column and appears before secondary sections', async () => {
  const [css, html] = await Promise.all([read('mobile.css'), read('index.html')]);
  assert.match(css, /#grid\.grid\s*\{\s*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css, /#grid\.grid\s*\{\s*grid-template-columns:\s*minmax\(0,1fr\)/);
  for (const part of [
    'main.wrap > #collection {order:1',
    'main.wrap > .dashboard {order:2',
    'main.wrap > #journeys {order:4'
  ]) assert.ok(css.includes(part), part);
  for (const id of ['collection', 'journeys', 'rank-summary', 'grid', 'filter-drawer']) {
    assert.ok(html.includes('id="' + id + '"'), id + ' must remain available');
  }
});

test('mobile catalogue and hero avoid unnecessary image and animation work', async () => {
  const [js, html] = await Promise.all([read('app.js'), read('index.html')]);
  assert.match(js, /CARD_BATCH_SIZE=.*\?18:30/);
  assert.match(js, /start\+CARD_BATCH_SIZE/);
  assert.match(js, /loading="lazy" decoding="async" width="320" height="480"/);
  assert.match(js, /matchMedia\('\(max-width:700px\), \(prefers-reduced-motion: reduce\)'\)\.matches/);
  const versions = {
    'app.js': 'final-polish-20261031-1',
    'mobile.css': 'final-polish-20261031-1',
    'style.css': 'mobile-focus-20261031-1'
  };
  for (const [file, version] of Object.entries(versions)) {
    assert.ok(html.includes('./' + file + '?v=' + version), file + ' cache key');
  }
});

test('CSS media blocks stay balanced after old rules were removed', async () => {
  const css = await read('mobile.css');
  let depth = 0;
  for (const ch of css) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    assert.ok(depth >= 0, 'closed more braces than opened');
  }
  assert.equal(depth, 0);
});

test('catalogue search is always visible and compatible with advanced filters', async () => {
  const [html, js, css] = await Promise.all([read('index.html'), read('app.js'), read('mobile.css')]);
  for(const id of ['catalog-search', 'catalog-search-clear', 'filters-toggle', 'search']){
    assert.ok(html.includes('id="' + id + '"'), 'missing ' + id);
  }
  assert.ok(html.includes('role="search"'), 'visible search landmark');
  assert.match(css, /\.catalog-search\s*\{/);
  assert.match(css, /\.catalog-search:focus-within\s*\{/);
  assert.ok(js.includes('function syncCatalogSearch()'));
  assert.ok(js.includes("'#catalog-search').oninput"));
  assert.ok(js.includes("'#catalog-search-clear').onclick"));
});

test('film detail animations are light, accessible and optional controls stay collapsed',async()=>{
  const [html,js,css]=await Promise.all([read('index.html'),read('app.js'),read('mobile.css')]);
  assert.ok(html.includes('mobile.css?v=hero-wheel-removed-20261031-2'));
  assert.ok(js.includes('detail-disclosure detail-personal'));
  assert.ok(js.includes('detail-disclosure detail-similar'));
  assert.ok(js.includes('data-expand-detail-summary'));
  assert.match(css,/\.detail-view\s*\{[^}]*animation:detailAppear/);
  assert.match(css,/\.detail-view \.detail-disclosure > summary:focus-visible/);
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
  assert.ok(css.includes('#details:has(.detail-view) .dialog-backdrop-image {display:none}'));
});

test('roulette replaces assistant and tonight without losing the personal library',async()=>{
 const [html,app,css]=await Promise.all([read('index.html'),read('app.js'),read('mobile.css')]);
 assert.ok(html.includes('data-dock="roulette"'));
 assert.ok(!html.includes('data-dock="assistant"'));
 assert.ok(!html.includes('assistant.js'));
 assert.ok(html.includes('roulette.js?v=roulette-20261031-1'));
 assert.ok(html.includes('id="roulette-launch"'));
 assert.ok(html.includes('id="account-slot"'));
 assert.ok(app.includes('function openRoulette()'));
 assert.ok(app.includes('function spinRoulette()'));
 assert.ok(app.includes('data-command="roulette"'));
 assert.ok(!app.includes('function openTonight()'));
 assert.ok(!app.includes('function openAssistant()'));
 assert.ok(!app.includes('امشب چی ببینم؟'));
 assert.ok(css.includes('.roulette-wheel'));
 assert.ok(css.includes('.library-switch'));
 assert.ok(css.includes('.simple-stats-grid'));
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
});

test('roulette icon stays in the dock and dedicated section, not in the hero',async()=>{
 const [html,app]=await Promise.all([read('index.html'),read('app.js')]);
 assert.ok(html.includes('id="icon-roulette-wheel"'));
 for(const selector of ['data-dock="roulette"','id="roulette-launch"']){
   const i=html.indexOf(selector);
   assert.ok(i>=0,selector);
   assert.ok(html.slice(i,html.indexOf('</button>',i)).includes('href="#icon-roulette-wheel"'),selector+' wheel icon');
 }
 assert.ok(!html.includes('id="hero-random"'), 'the duplicate hero wheel is removed');
 assert.ok(!app.includes("$('#hero-random')"), 'the removed button has no handler');
 assert.ok(app.includes("icon('roulette-wheel')"));
 assert.ok(!app.includes("icon('shuffle')"));
 assert.ok(html.includes('app.js?v=hero-wheel-cleanup-20261031-1'));
});

test('film details omit watch-date controls and the external IMDb detail link',async()=>{
  const [html,app,workflow]=await Promise.all([read('index.html'),read('app.js'),read('.github/workflows/pages.yml').catch(()=>null)]);
  assert.ok(!html.includes('dates.js'), 'the unused calendar is no longer downloaded');
  assert.ok(!app.includes('CinemaDates'), 'date calendar is disconnected');
  assert.ok(!app.includes('id="watched-on"'));
  assert.ok(!app.includes('watch-date-trigger'));
  assert.ok(!app.includes('class="imdb-link"'));
  assert.ok(!app.includes('id="journal-month"'));
  assert.ok(app.includes('امتیاز و یادداشت من'));
  assert.ok(app.includes('function journalEntries()'));
  assert.ok(html.includes('app.js?v=final-polish-20261031-1'));
});

test('final polish keeps mobile scrolling cheap and makes backup confirmation accessible',async()=>{
 const [html,app,css]=await Promise.all([read('index.html'),read('app.js'),read('mobile.css')]);
 assert.ok(html.includes('app.js?v=final-polish-20261031-1'));
 assert.ok(html.includes('mobile.css?v=hero-wheel-removed-20261031-2'));
 assert.ok(app.includes('lastRenderedList=list'));
 assert.ok(app.includes('const list=lastRenderedList,start='));
 assert.ok(app.includes('function writeJournalAtomically('));
 assert.ok(app.includes('function previewJournal('));
 assert.ok(app.includes('id="backup-preview"'));
 assert.ok(app.includes('id="backup-confirm"'));
 assert.match(css,/content-visibility:auto/);
 assert.match(css,/\.backup-preview\[hidden\]\{display:none\}/);
 assert.match(css,/\.backup-preview-actions button:focus-visible/);
});
