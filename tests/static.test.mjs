import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,access} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
const elements=new Map(),stored=new Map(),observers=[],timers=new Map();let timerId=0,domCards=[];
function element(){return {value:'',dataset:{},textContent:'',innerHTML:'',hidden:false,open:false,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},setAttribute(){},insertAdjacentHTML(p,h){this.innerHTML+=h},getBoundingClientRect(){return {top:10000}},events:{},addEventListener(name,handler){this.events[name]=handler},showModal(){this.open=true},close(value=''){this.open=false;this.returnValue=value},appendChild(node){node.parentElement=this;return node}}}
function get(s){if(!elements.has(s))elements.set(s,element());return elements.get(s)}
let failKey='';
const ctx=vm.createContext({IntersectionObserver:class{constructor(cb){this.callback=cb;observers.push(this)}observe(){}unobserve(){}},document:{body:element(),querySelector:get,querySelectorAll:selector=>selector==='#grid > .card'?domCards:[],documentElement:{dataset:{theme:'dark'}},addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem:k=>stored.get(k)??null,setItem(k,v){if(k===failKey){failKey='';throw Error('quota')}stored.set(k,v)},removeItem:k=>stored.delete(k)},setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>fn(),crypto:webcrypto});
vm.runInContext(await readFile('catalogue.js','utf8'),ctx);
vm.runInContext(await readFile('ranks.js','utf8'),ctx);
vm.runInContext(await readFile('discovery.js','utf8'),ctx);
vm.runInContext(await readFile('roulette.js','utf8'),ctx);
vm.runInContext(await readFile('live.js','utf8'),ctx);
let source=await readFile('app.js','utf8');
source=source.replace(/\}\)\(\);\s*$/,`window.test={watcherRank,saveDiary,journalEntries,openJournal,openRoulette,spinRoulette,roulettePool,rouletteWinner:()=>rouletteWinner,resetJournal:()=>{seen=new Set();wanted=new Set();preferences=new Map();discoverySettings=discovery.settings({});stateVersion++;localStorage.removeItem('cinema-discovery');for(const key of ['cinema-seen','cinema-wanted','cinema-preferences'])localStorage.removeItem(key);},openDetail,openWatchlist,openJourney,openCollection,appendCollectionRows,setExplore:(kind,view)=>{journeyKind=kind;journeyView=view;renderJourneys(true)},quickMatches,setAmbient,filtered,changeState,changePreference,importJournal,openAccount,openAccountHelp,openStats,setFilters:(t,s)=>{type=t;status=s},snapshot:()=>({seen:[...seen],wanted:[...wanted],preferences:[...preferences.values()],discovery:discoverySettings,accountReady})};})();`);
vm.runInContext(source,ctx);const api=ctx.window.test;get('#sort').value='rank';
test('500 unique titles, relative local artwork and no API/login dependency',async()=>{const titles=ctx.window.CINEMA_CATALOGUE.titles;assert.equal(titles.length,500);assert.equal(new Set(titles.map(x=>x.id)).size,500);for(const a of titles){assert.ok(a.poster.startsWith('./posters/'));await access(''+a.poster)}assert.equal(titles.filter(a=>a.type==='movie').length,250);assert.ok(!source.includes('/api/'));assert.ok(!source.includes('signin-with-chatgpt'));assert.ok(api.snapshot().accountReady)});
test('rank/name/year search and local watched/rating preferences work without fetch',()=>{get('#search').value='۱۲';assert.equal(api.filtered()[0].rank,12);get('#search').value='Shawshank';assert.equal(api.filtered()[0].id,'tt0111161');get('#search').value='۱۹۹۴';assert.ok(api.filtered().every(a=>a.year===1994));get('#search').value='';api.changeState('tt0111161','watchlist');api.changeState('tt0111161','seen');assert.ok(api.snapshot().seen.includes('tt0111161'));assert.ok(!api.snapshot().wanted.includes('tt0111161'));api.changePreference('tt0111161',{rating:9,favorite:true});assert.ok(stored.get('cinema-preferences').includes('tt0111161'))});
test('backup imports merge, preserve local entries and reject malformed files atomically',()=>{const payload={format:'cinema500-journal-v1',titles:[{id:'tt0111161',status:'watchlist',rating:1,favorite:false},{id:'tt0068646',status:'watchlist',rating:10,favorite:true}]};assert.equal(api.importJournal(payload),1);assert.ok(api.snapshot().seen.includes('tt0111161'));assert.equal(api.snapshot().preferences.find(p=>p.id==='tt0111161').rating,9);assert.ok(api.snapshot().wanted.includes('tt0068646'));const before=JSON.stringify([...stored]);assert.throws(()=>api.importJournal({format:'cinema500-journal-v1',titles:[{id:'tt0468569',status:'seen',rating:11}]}));assert.equal(JSON.stringify([...stored]),before);failKey='cinema-wanted';assert.throws(()=>api.importJournal({format:'cinema500-journal-v1',titles:[{id:'tt0468569',status:'seen'}]}));assert.equal(JSON.stringify([...stored]),before);assert.equal(api.importJournal(payload),0)});
test('infinite scrolling appends, local backup UI and theme work',()=>{api.setFilters('movie','all');get('#search').oninput();const count=()=>[...get('#grid').innerHTML.matchAll(/<article class=/g)].length;assert.equal(count(),30);observers[0].callback([{isIntersecting:true}]);assert.equal(count(),60);api.openAccount();assert.ok(get('#dialog-content').innerHTML.includes('backup-file'));get('#theme').onclick();assert.equal(stored.get('cinema-theme'),'light')});

test('Hero rotates every six seconds, wraps, pauses during interaction and respects manual selection',()=>{
 get('#details').open=false;
 const tick=()=>{const entry=[...timers].find(([,t])=>t.ms===6000);assert.ok(entry,'rotation scheduled');timers.delete(entry[0]);entry[1].fn()};
 const titles=ctx.window.CINEMA_CATALOGUE.titles;
 api.setAmbient(titles.find(a=>a.id==='tt0816692'));tick();assert.equal(get('#featured-title').textContent,'The Shawshank Redemption');
 get('.cinema-hero').events.pointerenter({pointerType:'mouse'});tick();assert.equal(get('#featured-title').textContent,'The Shawshank Redemption');get('.cinema-hero').events.pointerleave({pointerType:'mouse'});
 api.setAmbient(titles.find(a=>a.id==='tt0245429'));tick();assert.equal(get('#featured-title').textContent,'Interstellar');
 get('#details').open=true;tick();assert.equal(get('#featured-title').textContent,'Interstellar');get('#details').open=false;
 get('#featured-frames').onclick({target:{closest:selector=>selector==='[data-carousel-toggle]'?{}:null}});assert.ok(get('#featured-frames').innerHTML.includes('شروع تعویض خودکار'));assert.ok(![...timers.values()].some(t=>t.ms===6000));
 get('#featured-frames').onclick({target:{closest:selector=>selector==='[data-carousel-toggle]'?{}:null}});tick();assert.equal(get('#featured-title').textContent,'The Shawshank Redemption');
});

test('Changing a rating preserves unrelated poster nodes and the current grid',()=>{
 get('#search').value='';get('#genre').value='';get('#min-rating').value='0';get('#max-time').value='0';get('#decade').value='0';get('#sort').value='rank';api.setFilters('movie','all');
 get('#search').oninput();const list=api.filtered().slice(0,30);domCards=list.map(a=>({dataset:{id:a.id},outerHTML:'original-card'}));const untouched=domCards[29],gridBefore=get('#grid').innerHTML;
 api.changePreference(list[0].id,{rating:8});assert.ok(domCards[0].outerHTML.includes('نمرهٔ تو'));assert.equal(domCards[29],untouched);assert.equal(domCards[29].outerHTML,'original-card');assert.equal(get('#grid').innerHTML,gridBefore);domCards=[];
});
test('Offscreen hero stops rotating and thumbnail markup stays stable between slides',()=>{
 get('#details').open=false;const tick=()=>{const entry=[...timers].find(([,t])=>t.ms===6000);assert.ok(entry);timers.delete(entry[0]);entry[1].fn()};
 const before=get('#featured-title').textContent,markup=get('#featured-frames').innerHTML;observers[1].callback([{isIntersecting:false}]);assert.ok(![...timers.values()].some(t=>t.ms===6000));assert.equal(get('#featured-title').textContent,before);observers[1].callback([{isIntersecting:true}]);tick();assert.notEqual(get('#featured-title').textContent,before);assert.equal(get('#featured-frames').innerHTML,markup);
});

test('Touch selection keeps autoplay running, while keyboard focus still pauses it',()=>{
 const region=get('.cinema-hero');const tick=()=>{const entry=[...timers].find(([,t])=>t.ms===6000);assert.ok(entry);timers.delete(entry[0]);entry[1].fn()};
 region.events.pointerenter({pointerType:'touch'});region.events.focusin({target:{matches:()=>false}});let title=get('#featured-title').textContent;tick();assert.notEqual(get('#featured-title').textContent,title);
 region.events.focusin({target:{matches:()=>true}});title=get('#featured-title').textContent;tick();assert.equal(get('#featured-title').textContent,title);region.events.focusout({relatedTarget:null});tick();assert.notEqual(get('#featured-title').textContent,title);
});

test('All 500 titles have Persian summaries rendered with RTL layout',()=>{
 const titles=ctx.window.CINEMA_CATALOGUE.titles,described=titles.filter(a=>a.summary);
 assert.equal(described.length,500);assert.equal(titles.filter(a=>!a.summary).length,0);
 for(const a of described){assert.equal(a.summaryLanguage,'fa');assert.match(a.summary,/[آ-ی]/);assert.ok(!a.summary.includes('See full summary'));}
 api.openDetail('tt0903747');assert.ok(get('#dialog-content').innerHTML.includes('lang="fa" dir="rtl"'));assert.ok(get('#dialog-content').innerHTML.includes('معلم شیمی'));
});
test('Diary keeps notes and watched status without collecting dates; legacy backups remain valid',()=>{
 api.resetJournal();
 api.saveDiary('tt0111161','A memorable story <script>test</script>');
 let entry=api.snapshot().preferences.find(p=>p.id==='tt0111161');
 assert.equal(entry.note.includes('memorable'),true);
 assert.equal(entry.watchedOn,null);
 assert.ok(!api.snapshot().seen.includes('tt0111161'),'writing a note should not mark watched');
 api.changeState('tt0111161','seen');
 assert.ok(api.snapshot().seen.includes('tt0111161'));
 assert.equal(api.snapshot().preferences.find(p=>p.id==='tt0111161').watchedOn,null,'watching should not create a date');
 api.changePreference('tt0111161',{rating:9});
 assert.equal(api.snapshot().preferences.find(p=>p.id==='tt0111161').rating,9);
 assert.ok(api.journalEntries().some(a=>a.id==='tt0111161'));
 api.openDetail('tt0111161');
 const detail=get('#dialog-content').innerHTML;
 assert.ok(detail.includes('&lt;script&gt;test&lt;/script&gt;'));
 assert.ok(!detail.includes('<script>test</script>'));
 assert.ok(!detail.includes('تاریخ تماشا'));
 assert.ok(!detail.includes('watch-date-trigger'));
 assert.ok(!detail.includes('imdb-link'));
 assert.ok(!detail.includes('https://www.imdb.com/title/'));
 assert.throws(()=>api.saveDiary('tt0111161','x'.repeat(2001)));
 api.openJournal();
 assert.ok(get('#journal-list').innerHTML.includes('دیده‌ام'));
 assert.ok(!get('#dialog-content').innerHTML.includes('journal-month'));
 assert.ok(!get('#journal-list').innerHTML.includes('تاریخ تماشا'));
 const before=JSON.stringify(api.snapshot());
 assert.throws(()=>api.importJournal({format:'cinema500-journal-v1',titles:[{id:'tt0068646',status:'seen',watchedOn:'2026-02-30'}]}));
 assert.equal(JSON.stringify(api.snapshot()),before);
 api.importJournal({format:'cinema500-journal-v1',titles:[{id:'tt0068646',status:'seen',note:'Imported note',watchedOn:'2026-09-10'}]});
 assert.equal(api.snapshot().preferences.find(p=>p.id==='tt0068646').watchedOn,'2026-09-10','keep existing historical dates for backup compatibility');
 api.saveDiary('tt0068646','Updated note');
 assert.equal(api.snapshot().preferences.find(p=>p.id==='tt0068646').watchedOn,'2026-09-10');
 api.resetJournal();
});
test('Roulette draws from the current catalogue without changing private records',()=>{
 const before=JSON.stringify(api.snapshot());
 api.openRoulette();
 get('#roulette-kind').value='tv';
 get('#roulette-source').value='all';
 const pool=api.roulettePool();
 assert.equal(pool.length,250);
 assert.ok(pool.every(a=>a.type==='tv'));
 api.spinRoulette();
 assert.ok(pool.some(a=>a.id===api.rouletteWinner()));
 assert.ok(get('#roulette-choices').innerHTML.includes('<span>'));
 assert.equal(get('#roulette-spin').disabled,true);
 assert.equal(JSON.stringify(api.snapshot()),before);
 get('#details').open=false;
});

test('Browser-only profile exposes backup without any sign-in or cloud dependency',async()=>{
 const html=await readFile('index.html','utf8');assert.ok(!/auth-config|auth\.js|cloud-sync|supabase/i.test(html));assert.ok(!/CinemaAuth|cloudSync|queueCloud|authStatus/.test(source));
 api.openAccount();const profile=get('#dialog-content').innerHTML;assert.ok(profile.includes('account-help'));assert.ok(!profile.includes('اطلاعات هر مرورگر'));get('#account-help').onclick();assert.ok(get('#dialog-content').innerHTML.includes('اطلاعات هر مرورگر'));get('#account-guide-back').onclick();assert.ok(profile.includes('journal-export'));assert.ok(profile.includes('journal-import'));assert.ok(!profile.includes('ورود با گوگل'));
});

test('Existing browser records survive a fresh initialization with the same storage keys',()=>{
 const keys=['cinema-seen','cinema-wanted','cinema-preferences'];const before=keys.map(key=>stored.get(key));const snapshot=JSON.stringify(api.snapshot());ctx.window.__cinema500=false;vm.runInContext(source,ctx);assert.equal(JSON.stringify(ctx.window.test.snapshot()),snapshot);assert.deepEqual(keys.map(key=>stored.get(key)),before);
});

test('Ranks advance at every exact threshold, clamp counts, and expose a complete final tier',()=>{
 const ranks=ctx.window.CinemaRanks;for(let i=0;i<ranks.tiers.length;i++){const threshold=ranks.tiers[i].at;assert.equal(ranks.forCount(threshold).index,i);if(threshold)assert.equal(ranks.forCount(threshold-1).index,i-1);assert.ok(ranks.avatar(i).includes('<svg'));}
 assert.equal(ranks.forCount(-1).xp,0);assert.equal(ranks.forCount(500).xp,5000);assert.equal(ranks.forCount(9999).count,500);assert.equal(ranks.forCount(500).progress,1);assert.equal(ranks.forCount(500).next,null);
});
test('Only unique watched titles grant XP; toggling and watchlists cannot multiply points',()=>{
 api.resetJournal();const ids=ctx.window.CINEMA_CATALOGUE.titles.slice(0,5).map(a=>a.id);for(const id of ids)api.changeState(id,'seen');assert.equal(api.watcherRank().xp,50);assert.equal(api.watcherRank().level,2);assert.ok(get('#rank-upgrade').innerHTML.includes('فیلم‌دوست'));
 api.changeState(ids[0],'seen');assert.equal(api.watcherRank().xp,50);api.changeState(ids[0],'none');assert.equal(api.watcherRank().xp,40);assert.equal(api.watcherRank().level,1);api.changeState(ids[0],'watchlist');assert.equal(api.watcherRank().xp,40);api.changeState(ids[0],'seen');assert.equal(api.watcherRank().xp,50);
 const xp=api.watcherRank().xp;ctx.window.__cinema500=false;vm.runInContext(source,ctx);assert.equal(ctx.window.test.watcherRank().xp,xp);assert.ok(!get('#account-slot').innerHTML.includes('ورود'));
});


test('Hero swipes wrap both ways, ignore vertical scrolls and controls, and restart autoplay',()=>{
 const region=get('.cinema-hero'),title=()=>get('#featured-title').textContent;
 const target={closest:()=>null};let stamp=1000;
 const start=(x=240,y=100,extra={})=>region.events.pointerdown({pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:y,timeStamp:stamp,target,...extra});
 const end=(x,y=100)=>{stamp+=200;region.events.pointerup({pointerId:1,clientX:x,clientY:y,timeStamp:stamp});};
 ctx.window.test.setAmbient(ctx.window.CINEMA_CATALOGUE.titles.find(a=>a.id==='tt0816692'));
 start();stamp+=1800;end(80);assert.equal(title(),'The Shawshank Redemption');assert.ok([...timers.values()].some(t=>t.ms===6000));
 start(80);end(240);assert.equal(title(),'Interstellar');
 start(80);end(240);assert.equal(title(),'Spirited Away');
 const before=title();start();region.events.pointermove({pointerId:1,clientX:235,clientY:160});end(70,165);assert.equal(title(),before);
 start();end(225);assert.equal(title(),before);
 start(240,100,{target:{closest:()=>({})}});end(80);assert.equal(title(),before);
 start();region.events.pointercancel();end(80);assert.equal(title(),before);
 start();start(150,100,{pointerId:2,isPrimary:false});end(80);assert.equal(title(),before);
 region.events.keydown({target:region,key:'ArrowLeft',preventDefault(){}});assert.equal(title(),'Interstellar');
});



test('Taste and active journey restore with journal backups while old backups preserve them',()=>{
 api.resetJournal();
 api.importJournal({format:'cinema500-journal-v1',titles:[],discovery:{genres:['Drama','Sci-Fi'],activeJourney:'mind'}});
 assert.equal(api.snapshot().discovery.activeJourney,'mind');assert.equal(api.snapshot().discovery.genres.length,2);
 api.importJournal({format:'cinema500-journal-v1',titles:[]});assert.equal(api.snapshot().discovery.activeJourney,'mind');
 const before=JSON.stringify([...stored]);assert.throws(()=>api.importJournal({format:'cinema500-journal-v1',titles:[{id:'tt0111161',status:'seen'}],discovery:{genres:['unknown'],activeJourney:'mind'}}));assert.equal(JSON.stringify([...stored]),before);
 ctx.window.__cinema500=false;vm.runInContext(source,ctx);assert.equal(ctx.window.test.snapshot().discovery.activeJourney,'mind');
 api.resetJournal();
});

test('The saved destination includes both films and series and updates after marking watched',()=>{
 api.resetJournal();api.changeState('tt0111161','watchlist');api.changeState('tt0903747','watchlist');api.openWatchlist();
 const html=get('#watchlist-items').innerHTML;assert.ok(html.includes('The Shawshank Redemption'));assert.ok(html.includes('Breaking Bad'));
 api.changeState('tt0903747','seen');assert.ok(!get('#watchlist-items').innerHTML.includes('Breaking Bad'));assert.ok(get('#watchlist-items').innerHTML.includes('The Shawshank Redemption'));
 api.resetJournal();
});


test('Alternative Persian names remain searchable after cleaning display titles',()=>{
 api.resetJournal();api.setFilters('movie','all');get('#search').value='اینسپشن';assert.equal(api.filtered()[0].id,'tt1375666');assert.equal(api.quickMatches('اینسپشن')[0].id,'tt1375666');
 api.setFilters('tv','all');get('#search').value='افسارگسیخته';assert.equal(api.filtered()[0].id,'tt0903747');get('#search').value='';api.setFilters('movie','all');
});

test('Marking a title inside a journey updates progress without reopening or scrolling the dialog',()=>{
 api.resetJournal();api.openJourney('middle-earth');get('#details').scrollTop=120;assert.ok(get('#journey-detail-count').textContent.includes('۰ از ۳'));
 api.changeState('tt0120737','seen');assert.ok(get('#journey-detail-count').textContent.includes('۱ از ۳'));assert.equal(get('#details').scrollTop,120);
 api.changeState('tt0120737','none');assert.ok(get('#journey-detail-count').textContent.includes('۰ از ۳'));assert.equal(get('#details').scrollTop,120);api.resetJournal();
});


test('Discovery tabs render only the chosen type and category lists append without losing watched state',()=>{
 api.resetJournal();api.setExplore('tv','collections');
 assert.ok(get('#journey-grid').innerHTML.includes('data-collection="tv-documentary"'));
 assert.ok(!get('#journey-grid').innerHTML.includes('data-collection="movie-'));
 assert.ok(get('#explore-coverage').textContent.includes('۲۵۰ سریال'));
 api.setExplore('movie','paths');assert.ok(get('#journey-grid').innerHTML.includes('data-journey="middle-earth"'));assert.ok(!get('#journey-grid').innerHTML.includes('data-journey="series-crime"'));
 api.openCollection('movie-drama');const count=()=>[...get('#collection-items').innerHTML.matchAll(/data-detail=/g)].length;
 assert.equal(count(),24);const first=get('#collection-items').innerHTML;api.appendCollectionRows();assert.equal(count(),48);assert.ok(get('#collection-items').innerHTML.startsWith(first));
 const before=get('#collection-items').innerHTML;get('#details').scrollTop=120;api.changeState('tt0111161','seen');assert.equal(get('#collection-items').innerHTML,before);assert.ok(get('#collection-watched').textContent.includes('۱ دیدی'));assert.equal(get('#details').scrollTop,120);
 api.openDetail('tt0111161');assert.ok(get('#dialog-content').innerHTML.includes('data-back-collection="movie-drama"'));
 api.openCollection('movie-drama',true);assert.equal(count(),48);assert.equal(get('#details').scrollTop,120);
 api.openCollection('movie-imagination');get('#collection-search').value='اینسپشن';get('#collection-search').oninput();assert.equal(count(),1);assert.ok(get('#collection-items').innerHTML.includes('tt1375666'));
 api.resetJournal();api.setExplore('movie','collections');
});


test('Combined drawer filters preview the result and reset without changing the private journal',()=>{
 const flow=ctx.window.test;flow.resetJournal();flow.changeState('tt0111161','seen');flow.changePreference('tt0111161',{rating:9,note:'Keep this note'});flow.changeState('tt0068646','watchlist');
 const journal=JSON.stringify(flow.snapshot()),records=JSON.stringify([...stored]);get('#details').open=false;flow.setFilters('movie','seen');
 get('#search').value='۱۹۹۴';get('#genre').value='Drama';get('#min-rating').value='9';get('#max-time').value='180';get('#decade').value='1990';get('#sort').value='year';
 get('#filters-toggle').onclick();assert.equal(get('#filter-drawer').open,true);assert.equal(flow.filtered().length,1);assert.equal(flow.filtered()[0].id,'tt0111161');assert.equal(get('#filter-count').textContent,'۷');assert.equal(get('#filter-results').textContent,'نمایش ۱ فیلم');
 get('#clear-filters').onclick();assert.equal(get('#filter-drawer').open,true);assert.equal(flow.filtered().length,250);assert.equal(get('#search').value,'');assert.equal(get('#sort').value,'rank');assert.equal(get('#filter-count').hidden,true);
 assert.equal(JSON.stringify(flow.snapshot()),journal);assert.equal(JSON.stringify([...stored]),records);get('#filter-apply').onclick();assert.equal(get('#filter-drawer').open,false);assert.equal(get('#filter-drawer').returnValue,'results');
});

test('The same navigation survives profile, guide and stats transitions and leaves drill-down dialogs',()=>{
 const flow=ctx.window.test,dock=get('.mobile-dock'),journal=JSON.stringify(flow.snapshot());
 flow.openAccount();assert.equal(dock.parentElement,get('#details'));
 get('#account-help').onclick();assert.equal(dock.parentElement,get('#details'));
 get('#account-guide-back').onclick();assert.equal(dock.parentElement,get('#details'));
 flow.openStats();assert.equal(dock.parentElement,get('#details'));
 flow.openDetail('tt0111161');assert.equal(dock.parentElement,ctx.document.body);
 assert.equal(get('.mobile-dock'),dock);assert.equal(JSON.stringify(flow.snapshot()),journal);
});

test('Catalogue search works directly without opening filters and stays in sync',()=>{
  get('#clear-filters').onclick();
  const journal=JSON.stringify(api.snapshot());
  get('#catalog-search').value='Shawshank';
  get('#catalog-search').oninput();
  assert.equal(get('#search').value,'Shawshank');
  assert.equal(api.filtered()[0].id,'tt0111161');
  assert.equal(get('#catalog-search-clear').hidden,false);
  assert.equal(get('#filter-drawer').open,false);
  get('#search').value='۱۹۹۴';
  get('#search').oninput();
  assert.equal(get('#catalog-search').value,'۱۹۹۴');
  assert.ok(api.filtered().every(a=>a.year===1994));
  get('#catalog-search-clear').onclick();
  assert.equal(get('#search').value,'');
  assert.equal(get('#catalog-search').value,'');
  assert.equal(get('#catalog-search-clear').hidden,true);
  assert.equal(api.filtered().length,250);
  assert.equal(JSON.stringify(api.snapshot()),journal);
});

test('Film detail shows key facts first and retains optional journal/related tools in collapsed panels',()=>{
  api.setFilters('movie','all');
  const movie=api.filtered().find(a=>a.summary&&a.summary.length>225)||api.filtered()[0];
  api.openDetail(movie.id);
  const html=get('#dialog-content').innerHTML;
  assert.ok(html.includes('class="detail-view"'));
  assert.ok(html.includes('id="detail-actions"'));
  assert.ok(html.includes('detail-disclosure detail-personal'));
  assert.ok(html.includes('detail-disclosure detail-similar'));
  assert.ok(html.includes('id="personal-controls"'));
  assert.ok(html.includes('id="diary-form"'));
  assert.ok(html.includes('id="detail-journal"'));
  assert.ok(html.includes('https://www.imdb.com/title/'+movie.id+'/'));
  assert.ok(html.indexOf('id="detail-actions"')<html.indexOf('detail-disclosure detail-personal'));
  assert.ok(!html.includes('<details class="detail-disclosure detail-personal" open'));
  if(movie.summary?.length>225){
    assert.ok(html.includes('detail-summary is-clamped'));
    assert.ok(html.includes('data-expand-detail-summary'));
  }
  get('#details').open=false;
});
