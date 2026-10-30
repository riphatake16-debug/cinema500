import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const ctx=vm.createContext({window:{}});
vm.runInContext(await readFile('catalogue.js','utf8'),ctx);
vm.runInContext(await readFile('assistant.js','utf8'),ctx);
const assistant=ctx.window.CinemaAssistant;
const titles=ctx.window.CINEMA_CATALOGUE.titles;
test('assistant returns only actual cinema500 titles and needs no remote API',async()=>{
 const source=await readFile('assistant.js','utf8');
 assert.ok(!/fetch\(|OPENAI_API_KEY|api\.openai\.com/.test(source));
 const found=assistant.recommend('یه فیلم معمایی زیر دو ساعت',titles);
 assert.ok(found.results.length>0);
 assert.ok(found.results.every(x=>titles.some(t=>t.id===x.title.id)));
 assert.ok(found.results.every(x=>x.title.type==='movie'&&x.title.runtime<=120));
});
test('Persian intents detect time, film type, watched and saved constraints',()=>{
 const q=assistant.parse('یه سریال جنایی از لیست تماشا');
 assert.equal(q.kind,'tv');
 assert.equal(q.saved,true);
 assert.ok(q.genres.includes('Crime'));
 assert.ok(!q.genres.includes('Horror'));
 const watched=[titles.find(a=>a.type==='movie')?.id].filter(Boolean);
 const results=assistant.recommend('یه فیلم ندیده',titles,watched);
 assert.ok(results.results.every(x=>!watched.includes(x.title.id)));
 const tv=titles.find(a=>a.type==='tv');
 const saved=assistant.recommend('سریال از لیست تماشا',titles,[],[tv.id]);
 assert.ok(saved.results.length);
 assert.ok(saved.results.every(x=>x.title.id===tv.id));
});
test('assistant respects negative genres and year preferences',()=>{
 const a=assistant.parse('یه فیلم کمدی ترسناک نباشه');
 assert.ok(a.genres.includes('Comedy'));
 assert.ok(a.exclude.includes('Horror'));
 const results=assistant.recommend('یه فیلم بدون ترسناک',titles);
 assert.ok(results.results.every(x=>!x.title.genres.includes('Horror')));
 assert.equal(assistant.parse('فیلم بعد از ۲۰۱۰').afterYear,2010);
});
