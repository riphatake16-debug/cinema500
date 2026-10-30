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
  for (const file of ['app.js', 'mobile.css', 'style.css']) {
    assert.ok(html.includes('./' + file + '?v=mobile-focus-20261031-1'), file + ' cache key');
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
