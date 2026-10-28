import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,access} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
const elements=new Map(),stored=new Map(),observers=[],timers=new Map();let timerId=0,domCards=[];
function element(){return {value:'',dataset:{},textContent:'',innerHTML:'',hidden:false,open:false,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},setAttribute(){},insertAdjacentHTML(p,h){this.innerHTML+=h},getBoundingClientRect(){return {top:10000}},events:{},addEventListener(name,handler){this.events[name]=handler},showModal(){this.open=true},close(){this.open=false}}}
function get(s){if(!elements.has(s))elements.set(s,element());return elements.get(s)}
let failKey='';
const ctx=vm.createContext({IntersectionObserver:class{constructor(cb){this.callback=cb;observers.push(this)}observe(){}unobserve(){}},document:{querySelector:get,querySelectorAll:selector=>selector==='#grid > .card'?domCards:[],documentElement:{dataset:{theme:'dark'}},addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem:k=>stored.get(k)??null,setItem(k,v){if(k===failKey){failKey='';throw Error('quota')}stored.set(k,v)},removeItem:k=>stored.delete(k)},setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>fn(),crypto:webcrypto});
vm.runInContext(await readFile('catalogue.js','utf8'),ctx);
vm.runInContext(await readFile('ranks.js','utf8'),ctx);
vm.runInContext(await readFile('discovery.js','utf8'),ctx);
let source=await readFile('app.js','utf8');
source=source.replace(/\}\)\(\);\s*$/,`window.test={watcherRank,saveDiary,journalForMonth,monthOf,tasteGenres,pickForTaste,recommendReasons,resetJournal:()=>{seen=new Set();wanted=new Set();preferences=new Map();discoverySettings=discovery.settings({});stateVersion++;localStorage.removeItem('cinema-discovery');for(const key of ['cinema-seen','cinema-wanted','cinema-preferences'])localStorage.removeItem(key);},openDetail,openWatchlist,openJourney,quickMatches,setAmbient,filtered,changeState,changePreference,importJournal,recommendPool,openAccount,setFilters:(t,s)=>{type=t;status=s},snapshot:()=>({seen:[...seen],wanted:[...wanted],preferences:[...preferences.values()],discovery:discoverySettings,accountReady})};})();`);
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
 api.changePreference(list[0].id,{rating:8});assert.ok(domCards[0].outerHTML.includes('امتیاز تو'));assert.equal(domCards[29],untouched);assert.equal(domCards[29].outerHTML,'original-card');assert.equal(get('#grid').innerHTML,gridBefore);domCards=[];
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
test('Private diary preserves notes across rating changes, dates mark watched, and Persian month grouping works',()=>{
 api.resetJournal();
 api.saveDiary('tt0111161','A memorable story <script>test</script>','2026-10-20');
 let entry=api.snapshot().preferences.find(p=>p.id==='tt0111161');assert.equal(entry.watchedOn,'2026-10-20');assert.ok(api.snapshot().seen.includes('tt0111161'));
 api.changePreference('tt0111161',{rating:9});entry=api.snapshot().preferences.find(p=>p.id==='tt0111161');assert.ok(entry.note.includes('memorable'));assert.equal(entry.watchedOn,'2026-10-20');
 assert.ok(api.journalForMonth(api.monthOf('2026-10-20')).some(a=>a.id==='tt0111161'));
 api.openDetail('tt0111161');assert.ok(get('#dialog-content').innerHTML.includes('&lt;script&gt;test&lt;/script&gt;'));assert.ok(!get('#dialog-content').innerHTML.includes('<script>test</script>'));
 assert.throws(()=>api.saveDiary('tt0111161','x','2026-02-30'));assert.throws(()=>api.saveDiary('tt0111161','x'.repeat(2001),''));
 const before=JSON.stringify(api.snapshot());assert.throws(()=>api.importJournal({format:'cinema500-journal-v1',titles:[{id:'tt0068646',status:'seen',note:'x',watchedOn:'2026-02-30'}]}));assert.equal(JSON.stringify(api.snapshot()),before);
 api.importJournal({format:'cinema500-journal-v1',titles:[{id:'tt0068646',status:'seen',note:'Imported note',watchedOn:'2026-09-10'}]});assert.equal(api.snapshot().preferences.find(p=>p.id==='tt0068646').note,'Imported note');
 api.resetJournal();
});
test('Recommendations respect hard filters and explain taste affinity from actual preferences',()=>{
 api.resetJournal();api.changePreference('tt0111161',{rating:10,favorite:true});assert.ok(api.tasteGenres().get('Drama')>0);
 const pool=api.recommendPool('movie','',120,'unseen','Comedy');assert.ok(pool.length);assert.ok(pool.every(a=>a.type==='movie'&&a.runtime<=120&&a.genres.includes('Comedy')));
 api.changeState(pool[0].id,'seen');assert.ok(!api.recommendPool('movie','',120,'unseen','Comedy').some(a=>a.id===pool[0].id));
 assert.ok(api.recommendPool('movie','light',0,'unseen').every(a=>!a.genres.some(g=>['Horror','Thriller','Crime','War'].includes(g))));
 const candidate=ctx.window.CINEMA_CATALOGUE.titles.find(a=>a.id==='tt0120689');const reasons=api.recommendReasons(candidate,{mood:'thoughtful',max:200,selectedGenre:'Drama'});assert.ok(reasons.some(r=>r.includes('امتیازها و محبوب‌هایت')));
 assert.ok([candidate].includes(api.pickForTaste([candidate],.99)));api.resetJournal();
});

test('Browser-only profile exposes backup without any sign-in or cloud dependency',async()=>{
 const html=await readFile('index.html','utf8');assert.ok(!/auth-config|auth\.js|cloud-sync|supabase/i.test(html));assert.ok(!/CinemaAuth|cloudSync|queueCloud|authStatus/.test(source));
 api.openAccount();const profile=get('#dialog-content').innerHTML;assert.ok(profile.includes('بدون ثبت‌نام و رمز عبور'));assert.ok(profile.includes('journal-export'));assert.ok(profile.includes('journal-import'));assert.ok(!profile.includes('ورود با گوگل'));
});

test('Existing browser records survive a fresh initialization with the same storage keys',()=>{
 const keys=['cinema-seen','cinema-wanted','cinema-preferences'];const before=keys.map(key=>stored.get(key));const snapshot=JSON.stringify(api.snapshot());ctx.window.__cinema500=false;vm.runInContext(source,ctx);assert.equal(JSON.stringify(ctx.window.test.snapshot()),snapshot);assert.deepEqual(keys.map(key=>stored.get(key)),before);
});

test('Ranks advance at every exact threshold, clamp counts, and expose a complete final tier',()=>{
 const ranks=ctx.window.CinemaRanks;for(let i=0;i<ranks.tiers.length;i++){const threshold=ranks.tiers[i].at;assert.equal(ranks.forCount(threshold).index,i);if(threshold)assert.equal(ranks.forCount(threshold-1).index,i-1);assert.ok(ranks.avatar(i).includes('<svg'));}
 assert.equal(ranks.forCount(-1).xp,0);assert.equal(ranks.forCount(500).xp,5000);assert.equal(ranks.forCount(9999).count,500);assert.equal(ranks.forCount(500).progress,1);assert.equal(ranks.forCount(500).next,null);
});
test('Only unique watched titles grant XP; toggling and watchlists cannot multiply points',()=>{
 api.resetJournal();const ids=ctx.window.CINEMA_CATALOGUE.titles.slice(0,5).map(a=>a.id);for(const id of ids)api.changeState(id,'seen');assert.equal(api.watcherRank().xp,50);assert.equal(api.watcherRank().level,2);assert.ok(get('#rank-upgrade').innerHTML.includes('جویندهٔ داستان'));
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
