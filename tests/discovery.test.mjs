import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const ctx=vm.createContext({window:{}});
vm.runInContext(await readFile('discovery.js','utf8'),ctx);
vm.runInContext(await readFile('catalogue.js','utf8'),ctx);
const engine=ctx.window.CinemaDiscovery, titles=ctx.window.CINEMA_CATALOGUE.titles;
test('Similar works exclude the current title, preserve content type, and prefer matching genres',()=>{
 const source=titles.find(t=>t.id==='tt1375666');
 const list=engine.similar(titles,source,[],4);
 assert.equal(list.length,4);
 for(const item of list){assert.notEqual(item.id,source.id);assert.equal(item.type,source.type);assert.ok(item.genres.some(g=>source.genres.includes(g)));}
});
test('Every journey resolves real catalogue entries and advances past watched titles',()=>{
 for(const journey of engine.journeys){
  const first=engine.journeyProgress(journey,titles,[]);assert.equal(first.total,journey.ids.length);assert.ok(first.total>=3&&first.total<=5);assert.equal(new Set(journey.ids).size,journey.ids.length);assert.ok(first.entries.every(t=>t.type===first.kind));assert.equal(first.done,0);assert.equal(first.next.id,journey.ids[0]);
  const partial=engine.journeyProgress(journey,titles,new Set(journey.ids.slice(0,2)));assert.equal(partial.done,2);assert.equal(partial.next.id,journey.ids[2]);
  const complete=engine.journeyProgress(journey,titles,new Set(journey.ids));assert.equal(complete.done,journey.ids.length);assert.equal(complete.next,null);
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


test('Journey categories and search include alternate names and support hiding completed paths',()=>{
 assert.equal(engine.journeys.length,15);assert.equal(engine.filterJourneys(titles).length,3);
 const categories=new Set(engine.categories.map(c=>c.id));for(const j of engine.journeys)for(const c of j.categories)assert.ok(categories.has(c));
 assert.ok(engine.filterJourneys(titles,{category:'series'}).every(j=>engine.journeyProgress(j,titles).kind==='tv'));
 assert.ok(engine.filterJourneys(titles,{category:'all',query:'amelie'}).some(j=>j.id==='world-cinema'));
 assert.ok(engine.filterJourneys(titles,{category:'all',query:'افسارگسیخته'}).some(j=>j.id==='series-crime'));
 const complete=engine.journeys.find(j=>j.id==='middle-earth'),seen=new Set(complete.ids);
 assert.ok(!engine.filterJourneys(titles,{category:'all',unfinishedOnly:true,seen}).some(j=>j.id===complete.id));
 assert.ok(engine.filterJourneys(titles,{category:'all',unfinishedOnly:false,seen}).some(j=>j.id===complete.id));
});

test('Movie journey estimates use remaining films; series episode lengths are never summed',()=>{
 for(const j of engine.journeys){
  const p=engine.journeyProgress(j,titles,j.ids.slice(0,2));
  if(p.kind==='tv'){assert.equal(p.minutes,null);assert.equal(p.remainingMinutes,null);}
  else{assert.equal(p.minutes,p.entries.reduce((n,t)=>n+t.runtime,0));assert.equal(p.remainingMinutes,p.entries.slice(2).reduce((n,t)=>n+t.runtime,0));}
 }
});
