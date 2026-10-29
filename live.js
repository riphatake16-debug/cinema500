/* Validate complete chart updates before they can replace a working catalogue. */
(() => {
  const idPattern=/^tt\d{7,12}$/;
  function title(raw,ranked=true){
    if(!raw||typeof raw!=='object'||!idPattern.test(raw.id)||!['movie','tv'].includes(raw.type)||typeof raw.title!=='string'||!raw.title.trim()||raw.title.length>500)throw Error('invalid_title');
    if(!Number.isInteger(raw.year)||raw.year<1800||raw.year>2100||!Number.isFinite(raw.rating)||raw.rating<=0||raw.rating>10)throw Error('invalid_metadata');
    if(ranked&&(!Number.isInteger(raw.rank)||raw.rank<1||raw.rank>250))throw Error('invalid_rank');
    if(!Array.isArray(raw.genres)||raw.genres.length>30||raw.genres.some(g=>typeof g!=='string'||g.length>60))throw Error('invalid_genres');
    const poster=raw.poster||'';
    if(typeof poster!=='string'||poster.length>2000||(poster&&!/^\.\/posters\/tt\d{7,12}\.jpg$/.test(poster)&&!/^https:\/\/m\.media-amazon\.com\/images\/[^\s<>]+$/.test(poster)))throw Error('invalid_poster');
    return {id:raw.id,type:raw.type,rank:ranked?raw.rank:null,title:raw.title,year:raw.year,rating:raw.rating,poster,
      genres:[...new Set(raw.genres)],runtime:Number.isFinite(raw.runtime)&&raw.runtime>0&&raw.runtime<2000?Math.round(raw.runtime):0,
      fa:typeof raw.fa==='string'?raw.fa.slice(0,500):'',aliases:Array.isArray(raw.aliases)?raw.aliases.filter(s=>typeof s==='string').slice(0,12).map(s=>s.slice(0,500)):[],
      summary:raw.summaryLanguage==='fa'&&typeof raw.summary==='string'?raw.summary.slice(0,5000):'',summaryLanguage:'fa'};
  }
  function validate(raw,now=Date.now()){
    if(!raw||!Array.isArray(raw.titles)||raw.titles.length!==500)throw Error('incomplete_catalogue');
    const stamp=Date.parse(raw.retrievedAt);if(!Number.isFinite(stamp)||stamp>now+600000)throw Error('invalid_timestamp');
    const titles=raw.titles.map(t=>title(t)),ids=new Set(titles.map(t=>t.id));if(ids.size!==500)throw Error('duplicate_titles');
    for(const kind of ['movie','tv']){const ranks=titles.filter(t=>t.type===kind).map(t=>t.rank).sort((a,b)=>a-b);if(ranks.length!==250||ranks.some((n,i)=>n!==i+1))throw Error('incomplete_chart');}
    if(raw.archive!==undefined&&(!Array.isArray(raw.archive)||raw.archive.length>10000))throw Error('invalid_archive');
    const archive=(raw.archive||[]).map(t=>title(t,false)),archivedIds=new Set(archive.map(t=>t.id));
    if(archivedIds.size!==archive.length||archive.some(t=>ids.has(t.id)))throw Error('invalid_archive');
    const status=['ok','stale','snapshot'].includes(raw.status)?raw.status:'snapshot';
    const version=typeof raw.version==='string'&&/^[a-f0-9]{64}$/.test(raw.version)?raw.version:'snapshot-'+raw.retrievedAt;
    if(status==='ok'&&version.startsWith('snapshot'))throw Error('invalid_version');
    return {schemaVersion:1,version,status,retrievedAt:raw.retrievedAt,checkedAt:typeof raw.checkedAt==='string'?raw.checkedAt:raw.retrievedAt,refreshMinutes:60,titles,archive};
  }
  function fresher(next,current){return Date.parse(next.retrievedAt)>=Date.parse(current.retrievedAt);}
  function memory(seed,archive=[]){const result=new Map();for(const t of [...(Array.isArray(archive)?archive:[]),...(seed.archive||[]),...seed.titles]){try{result.set(t.id,title(t,false));}catch{}}return result;}
  function freshness(feed,now=Date.now()){
    const age=Math.max(0,now-Date.parse(feed.retrievedAt));
    return feed.status==='ok'&&age<3*60*60*1000?'current':feed.status==='snapshot'?'snapshot':'stale';
  }
  window.CinemaLive={validate,title,fresher,memory,freshness};
})();
