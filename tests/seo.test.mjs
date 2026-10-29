import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const base='https://riphatake16-debug.github.io/cinema500/';
test('Search metadata consistently identifies the public Cinema500 home page',async()=>{
 const html=await readFile('index.html','utf8');
 const canonical=html.match(/<link rel="canonical" href="([^"]+)"/)[1];assert.equal(canonical,base);
 const title=html.match(/<title>(.*?)<\/title>/)[1];assert.ok(title.startsWith('سینما ۵۰۰'));
 assert.ok(!/<meta[^>]+(?:name=["']robots["'][^>]+content=["'][^"']*noindex|content=["'][^"']*noindex[^>]+name=["']robots)/i.test(html));
 const schema=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);assert.equal(schema.url,canonical);assert.equal(schema.name,'سینما ۵۰۰');assert.equal(schema['@type'],'WebApplication');
 assert.ok(html.includes('<strong>سینما ۵۰۰ (Cinema500)</strong>'));
 const headings=[...html.matchAll(/<h1\b[^>]*>(.*?)<\/h1>/gs)];assert.equal(headings.length,1);assert.equal(headings[0][1].replace(/<[^>]+>/g,''),'سینما۵۰۰');
 assert.match(html,/<h2 id="featured-title"/);assert.ok(schema.alternateName.includes('سینما۵۰۰'));assert.ok(schema.alternateName.includes('سینما500'));assert.ok(schema.sameAs.includes('https://github.com/riphatake16-debug/cinema500'));
 await access(new URL(schema.image).pathname.replace('/cinema500/',''));
});
test('The sitemap lists only the public canonical page, excluding private journal and mobile QA',async()=>{
 const sitemap=await readFile('sitemap.xml','utf8');const urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(x=>x[1]);assert.deepEqual(urls,[base]);assert.ok(!/mobile-preview|account|journal/.test(sitemap));assert.match(sitemap,/xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
});

