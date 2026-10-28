import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('manifest.webmanifest','utf8'));
test('Installed app launches inside the GitHub Pages project with fullscreen fallback',async()=>{
 const base=new URL('https://example.github.io/cinema500/manifest.webmanifest');
 for(const key of ['id','scope','start_url'])assert.equal(new URL(manifest[key],base).pathname,'/cinema500/');
 assert.equal(manifest.display,'fullscreen');assert.equal(manifest.dir,'rtl');assert.equal(manifest.lang,'fa-IR');assert.equal(manifest.prefer_related_applications,false);
 const html=await readFile('index.html','utf8');assert.match(html,/rel="manifest" href="\.\/manifest.webmanifest"/);assert.match(html,/apple-mobile-web-app-capable" content="yes"/);assert.match(html,/viewport-fit=cover/);
});
test('Every install icon exists with declared PNG dimensions and Apple icon matches metadata',async()=>{
 for(const icon of [...manifest.icons,{src:'./icons/apple-touch-icon.png',sizes:'180x180'}]){
  const bytes=await readFile(icon.src);assert.equal(bytes.subarray(1,4).toString(),'PNG');const [w,h]=icon.sizes.split('x').map(Number);assert.equal(bytes.readUInt32BE(16),w);assert.equal(bytes.readUInt32BE(20),h);
 }
 assert.ok(manifest.icons.some(i=>i.sizes==='192x192'));assert.ok(manifest.icons.some(i=>i.sizes==='512x512'&&i.purpose.includes('maskable')));
});
