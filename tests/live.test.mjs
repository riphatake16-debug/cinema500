import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
const scripts={};for(const name of ['catalogue.js','live.js','discovery.js','ranks.js','app.js'])scripts[name]=await readFile(name,'utf8');
const context=vm.createContext({window:{}});vm.runInContext(scripts['catalogue.js'],context);vm.runInContext(scripts['live.js'],context);
const seed=JSON.parse(JSON.stringify(context.window.CINEMA_CATALOGUE)),live=context.window.CinemaLive;
const clone=x=>JSON.parse(JSON.stringify(x));
function feed(){return {...clone(seed),version:'a'.repeat(64),status:'ok',retrievedAt:new Date().toISOString(),archive:[]};}

test('Only a complete, unique pair of 250-rank charts can be applied',()=>{
 assert.equal(live.validate(feed()).titles.length,500);
 for(const change of [f=>f.titles.pop(),f=>f.titles[1].id=f.titles[0].id,f=>f.titles[1].rank=1,f=>f.titles[0].type='tv',f=>f.titles[0].poster='javascript:bad',f=>f.retrievedAt=new Date(Date.now()+86400000).toISOString()]){
  const broken=feed();change(broken);assert.throws(()=>live.validate(broken));
 }
});
test('Freshness reflects successful data time, with truthful snapshot and failure states',()=>{
 const f=live.validate(feed());assert.equal(live.freshness(f),'current');
 assert.equal(live.freshness({...f,status:'stale'}),'stale');
 assert.equal(live.freshness(f,Date.parse(f.retrievedAt)+4*3600000),'stale');
 assert.equal(live.freshness(live.validate(seed)),'snapshot');
 assert.equal(live.fresher(live.validate(seed),f),false);
});
test('Automatic Persian provenance is preserved, while unsafe provider links are discarded',()=>{
 const f=feed();f.titles[0].localization={summarySource:'wikipedia-fa',summaryUrl:'https://fa.wikipedia.org/w/index.php?title=Example&oldid=123',faSource:'wikidata',faUrl:'https://www.wikidata.org/entity/Q123'};
 const valid=live.validate(f).titles[0];assert.equal(valid.localization.summarySource,'wikipedia-fa');assert.ok(valid.localization.summaryUrl.includes('oldid=123'));
 f.titles[0].localization={summarySource:'wikipedia-fa',summaryUrl:'https://fa.wikipedia.org.evil.example/wiki/Test',faSource:'mymemory',faUrl:'javascript:alert(1)'};
 assert.equal(Object.keys(live.validate(f).titles[0].localization).length,0);
});
function app(){
 const elements=new Map(),stored=new Map();let failKey='';
 const get=s=>{if(!elements.has(s))elements.set(s,{value:'',dataset:{},innerHTML:'',textContent:'',hidden:false,open:false,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},getBoundingClientRect(){return{top:10000}},insertAdjacentHTML(_,h){this.innerHTML+=h},showModal(){this.open=true},close(){this.open=false}});return elements.get(s)};
 const ctx=vm.createContext({window:{addEventListener(){}},document:{querySelector:get,querySelectorAll:()=>[],addEventListener(){},documentElement:{dataset:{theme:'dark'}}},localStorage:{getItem:k=>stored.get(k)??null,setItem(k,v){if(k===failKey){failKey='';throw Error('quota')}stored.set(k,v)},removeItem:k=>stored.delete(k)},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn(),crypto:webcrypto});
 for(const name of ['catalogue.js','live.js','discovery.js','ranks.js'])vm.runInContext(scripts[name],ctx);
 const source=scripts['app.js'].replace(/\}\)\(\);\s*$/,`window.test={applyLiveCatalogue,refreshLiveCatalogue,applyPendingCatalogue,changeState,changePreference,saveDiary,watcherRank,openDetail,openWatchlist,journalStats,importJournal,filtered,setFilters:(t,s)=>{type=t;status=s},snapshot:()=>({seen:[...seen],wanted:[...wanted],preferences:[...preferences.values()],ids:data.map(t=>t.id),rank:data.find(t=>t.id==='tt0111161')?.rank,all:allTitles()})};})();`);
 vm.runInContext(source,ctx);get('#sort').value='rank';return{api:ctx.window.test,get,stored,ctx,fail:key=>failKey=key};
}
test('Rank changes and membership changes retain diary, watched flags, watchlists and XP',()=>{
 const {api,get,stored}=app();api.changeState('tt0111161','seen');api.changePreference('tt0111161',{rating:9,favorite:true});api.saveDiary('tt0111161','یادداشت من');api.changeState('tt0068646','watchlist');
 const f=feed();[f.titles[0].rank,f.titles[1].rank]=[2,1];assert.equal(api.applyLiveCatalogue(f),true);assert.equal(api.snapshot().rank,2);assert.deepEqual(Array.from(api.filtered().slice(0,2),a=>a.id),['tt0068646','tt0111161'],'re-ordered IMDb chart updates the actual visible list');assert.equal(api.watcherRank().xp,10);assert.equal(api.snapshot().preferences.find(p=>p.id==='tt0111161').watchedOn,null);
 const changed=clone(f);changed.version='b'.repeat(64);const departed=changed.titles.find(t=>t.id==='tt0111161');changed.archive=[{...departed,rank:null}];changed.titles=changed.titles.map(t=>t.id===departed.id?{...t,id:'tt9999999',title:'New fixture',fa:'اثر تازه'}:t);
 api.applyLiveCatalogue(changed);assert.ok(!api.snapshot().ids.includes(departed.id));assert.ok(api.snapshot().seen.includes(departed.id));assert.equal(api.watcherRank().xp,10);assert.equal(api.journalStats().movies,1);
 api.openDetail(departed.id);assert.ok(get('#dialog-content').innerHTML.includes('یادداشت من'));assert.ok(get('#dialog-content').innerHTML.includes('خارج از فهرست فعلی'));
 api.openWatchlist();assert.ok(get('#watchlist-items').innerHTML.includes('The Godfather'));assert.ok(stored.get('cinema-title-archive').includes(departed.id));
 const before=JSON.stringify(api.snapshot());assert.throws(()=>api.applyLiveCatalogue({...changed,titles:changed.titles.slice(1)}));assert.equal(JSON.stringify(api.snapshot()),before);
});
test('New title metadata travels with backups, including after it leaves the chart',()=>{
 const {api,fail,stored}=app(),extra={...seed.titles[0],id:'tt9999998',title:'Saved fixture',rank:null};
 const payload={format:'cinema500-journal-v1',titles:[{id:extra.id,status:'seen',note:'از دستگاه دیگر',rating:8,titleData:extra}]};
 const before=JSON.stringify([...stored]);fail('cinema-title-archive');assert.throws(()=>api.importJournal(payload));assert.equal(JSON.stringify([...stored]),before);
 assert.equal(api.importJournal(payload),1);assert.ok(api.snapshot().seen.includes(extra.id));assert.equal(api.journalStats().movies,1);
 assert.ok(api.snapshot().all.some(t=>t.id===extra.id&&t.title===extra.title));
});
test('New automatic text shows its source in details and survives a metadata backup',()=>{
 const {api,get}=app(),extra={...seed.titles[0],id:'tt9999997',title:'Newly localized film',rank:null,localization:{summarySource:'wikipedia-fa',summaryUrl:'https://fa.wikipedia.org/wiki/Example'}};
 api.importJournal({format:'cinema500-journal-v1',titles:[{id:extra.id,status:'seen',titleData:extra}]});api.openDetail(extra.id);
 assert.ok(get('#dialog-content').innerHTML.includes('ویکی‌پدیای فارسی'));assert.ok(get('#dialog-content').innerHTML.includes('CC BY-SA 4.0'));
 const machine={...extra,id:'tt9999996',localization:{summarySource:'mymemory',summaryUrl:'https://www.imdb.com/title/tt9999996/'}};
 api.importJournal({format:'cinema500-journal-v1',titles:[{id:machine.id,status:'seen',titleData:machine}]});api.openDetail(machine.id);
 assert.ok(get('#dialog-content').innerHTML.includes('ترجمهٔ خودکار MyMemory'));
 api.openDetail('tt0068646');assert.ok(!get('#dialog-content').innerHTML.includes('detail-provenance'));
});


test('Automatic downloads defer a changed chart while a detail dialog is open',async()=>{
 const {api,get,ctx}=app();api.openDetail('tt0111161');const before=get('#dialog-content').innerHTML;
 const next=feed();[next.titles[0].rank,next.titles[1].rank]=[2,1];ctx.window.fetch=async()=>({ok:true,json:async()=>next});
 await api.refreshLiveCatalogue(true);assert.equal(api.snapshot().rank,1);assert.equal(get('#dialog-content').innerHTML,before);assert.ok(get('#catalog-date').textContent.includes('نسخهٔ تازه آماده است'));
 get('#details').open=false;api.applyPendingCatalogue();assert.equal(api.snapshot().rank,2);
});
test('A failed network check keeps the catalogue and successful timestamp intact',async()=>{
 const {api,get,ctx}=app();const before=JSON.stringify(api.snapshot());ctx.window.fetch=async()=>{throw Error('offline')};
 await api.refreshLiveCatalogue(true);assert.equal(JSON.stringify(api.snapshot()),before);assert.ok(get('#catalog-date').textContent.includes('آخرین نسخهٔ ذخیره‌شده'));
 assert.equal(get('#refresh-catalog').disabled,false);
});
