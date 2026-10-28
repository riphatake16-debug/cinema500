import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const ctx=vm.createContext({window:{}});
vm.runInContext(await readFile('discovery.js','utf8'),ctx);
vm.runInContext(await readFile('catalogue.js','utf8'),ctx);
const engine=ctx.window.CinemaDiscovery, titles=ctx.window.CINEMA_CATALOGUE.titles;
const ids=results=>Array.from(results,item=>item.title.id);
const base={day:'2026-10-28',kind:'movie'};

test('Personal discovery excludes watched and disliked works and obeys film/episode time limits',()=>{
 const seen=new Set(titles.slice(0,20).map(t=>t.id));
 const disliked=titles[20].id;
 const preferences=new Map([[disliked,{id:disliked,rating:2}]]);
 for(const kind of ['movie','tv']){
  const picks=engine.recommendations(titles,{...base,kind,seen,preferences,mode:'short',limit:12});
  assert.ok(picks.length);
  for(const {title} of picks){assert.equal(title.type,kind);assert.ok(!seen.has(title.id));assert.notEqual(title.id,disliked);assert.ok(title.runtime>0&&title.runtime<=(kind==='movie'?100:35));}
 }
});
test('Explicit taste affects selection; day and refresh variants are deterministic and diverse',()=>{
 const sample=[{id:'a',type:'movie',title:'Drama',year:2020,rating:8,rank:1,genres:['Drama']},{id:'b',type:'movie',title:'Comedy',year:2020,rating:8,rank:2,genres:['Comedy']}];
 const pick=engine.recommendations(sample,{...base,selectedGenres:['Comedy'],limit:1})[0];
 assert.equal(pick.title.id,'b');assert.equal(pick.reason.type,'genre');assert.equal(pick.reason.genre,'Comedy');
 const first=ids(engine.recommendations(titles,base));
 assert.deepEqual(first,ids(engine.recommendations(titles,base)));
 assert.notDeepEqual(first,ids(engine.recommendations(titles,{...base,round:1})));
 assert.notDeepEqual(first,ids(engine.recommendations(titles,{...base,day:'2026-10-29'})));
 assert.equal(new Set(first).size,first.length);
});
test('Similar works exclude the current title, preserve content type, and prefer matching genres',()=>{
 const source=titles.find(t=>t.id==='tt1375666');
 const list=engine.similar(titles,source,[],4);
 assert.equal(list.length,4);
 for(const item of list){assert.notEqual(item.id,source.id);assert.equal(item.type,source.type);assert.ok(item.genres.some(g=>source.genres.includes(g)));}
});
test('Every journey resolves real catalogue entries and advances past watched titles',()=>{
 for(const journey of engine.journeys){
  const first=engine.journeyProgress(journey,titles,[]);assert.equal(first.total,5);assert.equal(first.done,0);assert.equal(first.next.id,journey.ids[0]);
  const partial=engine.journeyProgress(journey,titles,new Set(journey.ids.slice(0,2)));assert.equal(partial.done,2);assert.equal(partial.next.id,journey.ids[2]);
  const complete=engine.journeyProgress(journey,titles,new Set(journey.ids));assert.equal(complete.done,5);assert.equal(complete.next,null);
 }
});
test('Taste backup rejects malformed choices and retains current selections on merge',()=>{
 assert.throws(()=>engine.settings({genres:['invented']},true));
 assert.throws(()=>engine.settings({genres:['Drama','Drama']},true));
 assert.throws(()=>engine.settings({genres:[],activeJourney:'unknown'},true));
 const merged=engine.mergeSettings({genres:['Comedy'],activeJourney:'mind'},{genres:['Drama'],activeJourney:'animation'});
 assert.equal(merged.genres[0],'Comedy');assert.equal(merged.activeJourney,'mind');
 const restored=engine.mergeSettings({}, {genres:['Drama'],activeJourney:'classics'});assert.equal(restored.genres[0],'Drama');assert.equal(restored.activeJourney,'classics');
});
