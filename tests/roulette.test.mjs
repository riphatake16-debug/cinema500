import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const ctx=vm.createContext({window:{}});
vm.runInContext(await readFile('roulette.js','utf8'),ctx);
vm.runInContext(await readFile('catalogue.js','utf8'),ctx);
const wheel=ctx.window.CinemaRoulette,all=ctx.window.CINEMA_CATALOGUE.titles;
test('roulette picks only real catalogue titles and filters seen works',()=>{
 assert.equal(all.length,500);
 const seen=[all.find(a=>a.type==='movie').id];
 const pool=wheel.eligible(all,'movie','unseen',seen,[]);
 assert.equal(pool.length,249);
 assert.ok(pool.every(a=>a.type==='movie'&&!seen.includes(a.id)));
 const tv=all.find(a=>a.type==='tv');
 assert.deepEqual(wheel.eligible(all,'tv','watchlist',seen,[tv.id]).map(a=>a.id),[tv.id]);
 assert.equal(wheel.eligible(all,'movie','watchlist',seen,[tv.id]).length,0);
});
test('roulette samples unique titles without replacing entries',()=>{
 const pool=wheel.eligible(all,'all','all',[],[]);
 const slots=wheel.sample(pool,8,max=>max-1);
 assert.equal(slots.length,8);
 assert.equal(new Set(slots.map(a=>a.id)).size,8);
 assert.ok(slots.every(a=>pool.some(t=>t.id===a.id)));
 assert.equal(wheel.sample(pool,0).length,0);
});
test('roulette avoids repeating a selected title until a pool is exhausted',()=>{
 const pool=wheel.eligible(all,'movie','all',[],[]).slice(0,4);
 assert.equal(wheel.remaining(pool,[pool[0].id]).length,3);
 assert.equal(wheel.remaining(pool,pool.map(a=>a.id)).length,4);
 assert.ok(pool.every(a=>wheel.remaining(pool,[pool[0].id]).every(b=>b.id!==pool[0].id)));
});
test('wheel random index always falls inside its available slots',()=>{
 for(let n=1;n<=8;n++)for(let i=0;i<30;i++){
  const index=wheel.randomIndex(n);assert.ok(index>=0&&index<n&&Number.isInteger(index));
 }
});
