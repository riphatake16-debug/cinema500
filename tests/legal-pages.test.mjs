import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = name => readFile(name, 'utf8');

test('privacy disclosures are publicly accessible and reachable from site footer', async () => {
  const [home, privacy, terms, workflow] = await Promise.all([
    read('index.html'), read('privacy.html'), read('terms.html'), read('../.github/workflows/pages.yml').catch(() => read('.github/workflows/pages.yml'))
  ]);
  assert.match(home, /href="\.\/privacy\.html"/);
  assert.match(home, /href="\.\/terms\.html"/);
  assert.match(privacy, /<html lang="fa" dir="rtl">/);
  assert.match(privacy, /https:\/\/riphatake16-debug\.github\.io\/cinema500\/privacy\.html/);
  for(const disclosure of ['localStorage','GitHub Pages','Google Fonts','images.metahub.space','پشتیبان','حذف داده','اندروید']) {
    assert.ok(privacy.includes(disclosure), 'Missing data disclosure: '+disclosure);
  }
  assert.match(terms, /حقوق محتوا/);
  assert.match(terms, /وابستگی رسمی/);
  assert.match(workflow, /cp index\.html privacy\.html terms\.html /);
  assert.doesNotMatch(privacy, /<script\b/);
  assert.doesNotMatch(terms, /<script\b/);
});

test('Android permissions match privacy disclosure', async () => {
  const manifest = await read('android/app/src/main/AndroidManifest.xml').catch(() => read('../android/app/src/main/AndroidManifest.xml'));
  const permissions = [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map(x => x[1]);
  assert.deepEqual(permissions, ['android.permission.INTERNET']);
});

test('release audit highlights unresolved image and dataset licensing', async () => {
  const report = await read('docs/legal-readiness-fa.md').catch(() => read('../docs/legal-readiness-fa.md'));
  assert.ok(report.includes('مجوزهای حقوق محتوا هنوز تأیید نشده‌اند'));
  assert.ok(report.includes('caching.graphql.imdb.com'));
  assert.ok(report.includes('پوستر'));
});
