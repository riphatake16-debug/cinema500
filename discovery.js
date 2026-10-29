/* Small, local discovery engine. No network requests or personal data leave the browser. */
(() => {
  'use strict';
  const genres = ['Action','Adventure','Animation','Biography','Comedy','Crime','Documentary','Drama','Family','Fantasy','History','Horror','Music','Mystery','Romance','Sci-Fi','Sport','Thriller','War','Western'];
  const categories = [
    {id:'featured',label:'برای شروع'}, {id:'all',label:'همهٔ مسیرها'},
    {id:'suspense',label:'معما و هیجان'}, {id:'imagination',label:'علمی‌تخیلی و فانتزی'},
    {id:'life',label:'درام و کمدی'}, {id:'classic',label:'کلاسیک‌ها'},
    {id:'world',label:'سینمای جهان'}, {id:'history',label:'جنگ و تاریخ'}, {id:'animation',label:'انیمیشن و انیمه'},
    {id:'series',label:'سریال‌ها'}
  ];
  const journeys = [
    {id:'mind', title:'بازی با ذهن', subtitle:'پنج فیلم که مدام برداشتت از داستان را عوض می‌کنند.', tag:'معما و هیجان', categories:['suspense'], featured:true, color:'#9f8cdb', ids:['tt0133093','tt0209144','tt0482571','tt1375666','tt1130884']},
    {id:'animation', title:'انیمیشن، فراتر از کودکی', subtitle:'داستان‌هایی دربارهٔ خانواده، تنهایی و بزرگ‌شدن.', tag:'انیمیشن', categories:['animation'], featured:true, color:'#d89c74', ids:['tt0245429','tt0910970','tt2380307','tt0095327','tt4633694']},
    {id:'classics', title:'پنج قرار با کلاسیک‌ها', subtitle:'از کمدی صامت تا دادگاه و معمای جنایی.', tag:'کلاسیک', categories:['classic'], featured:true, color:'#8ab5aa', ids:['tt0050083','tt0034583','tt0027977','tt0047396','tt0043014']},
    {id:'space', title:'سفر به فضا', subtitle:'سفرهای فضایی، سیاره‌های دور و خطرهایی ناشناخته.', tag:'علمی‌تخیلی', categories:['imagination'], color:'#7c9bc9', ids:['tt0062622','tt0076759','tt0080684','tt0078748','tt0816692']},
    {id:'memory', title:'زمان و خاطره', subtitle:'وقتی نمی‌شود به حافظه یا گذر زمان اعتماد کرد.', tag:'زمان و هویت', categories:['imagination','suspense'], color:'#b093cf', ids:['tt0088763','tt0209144','tt0338013','tt1375666','tt5311514']},
    {id:'middle-earth', title:'سه‌گانهٔ ارباب حلقه‌ها', subtitle:'سفر فرودو و یاران حلقه را به ترتیب دنبال کن.', tag:'فانتزی و ماجراجویی', categories:['imagination'], color:'#a9b77d', ids:['tt0120737','tt0167261','tt0167260']},
    {id:'crime', title:'دنیای تبهکارها', subtitle:'خانواده، قدرت و بهایی که زندگی در مافیا دارد.', tag:'جنایی', categories:['suspense'], color:'#ba8f85', ids:['tt0068646','tt0071562','tt0099685','tt0317248','tt0407887']},
    {id:'clues', title:'دنبال سرنخ', subtitle:'پنج پرونده که جوابشان به این سادگی پیدا نمی‌شود.', tag:'معمای جنایی', categories:['suspense'], color:'#8aa6a5', ids:['tt0047396','tt0051201','tt0052357','tt0114369','tt0353969']},
    {id:'hope', title:'آدم‌ها و امید', subtitle:'دوستی و همراهی در روزهایی که زندگی سخت می‌گیرد.', tag:'درام انسانی', categories:['life'], color:'#c6ac7d', ids:['tt0111161','tt0118799','tt0119217','tt0097165','tt1675434']},
    {id:'comedy', title:'کمی بخندیم', subtitle:'کمدی، موسیقی و چند ماجرای شیرین و غیرمنتظره.', tag:'کمدی', categories:['life'], color:'#caa687', ids:['tt0045152','tt0053291','tt0070735','tt0120382','tt2278388']},
    {id:'world-cinema', title:'دور دنیا در پنج فیلم', subtitle:'پنج انتخاب از سینمای ایران، ژاپن، فرانسه، برزیل و کره.', tag:'سینمای جهان', categories:['world'], color:'#8eb5a3', ids:['tt1832382','tt0047478','tt0211915','tt0317248','tt6751668']},
    {id:'war', title:'آدم‌ها در دل جنگ', subtitle:'جنگ از نگاه سربازان، کودکان و آدم‌های عادی.', tag:'جنگ و تاریخ', categories:['history'], color:'#a3a185', ids:['tt0050825','tt0078788','tt0095327','tt0120815','tt0253474']},
    {id:'series-mystery', title:'معماهای تلویزیونی', subtitle:'پرونده‌های جنایی و رازهایی که قسمت‌به‌قسمت باز می‌شوند.', tag:'سریال معمایی', categories:['series','suspense'], color:'#8a98b7', ids:['tt1475582','tt2356777','tt5290382','tt0098936','tt5753856']},
    {id:'series-crime', title:'سریال‌های جنایی', subtitle:'از خیابان‌های بالتیمور تا دفتر ساول گودمن.', tag:'سریال جنایی', categories:['series','suspense'], color:'#b29889', ids:['tt0306414','tt0141842','tt0903747','tt3032476','tt2802850']},
    {id:'anime', title:'پنج انیمه برای دنبال‌کردن', subtitle:'ماجراجویی، معما و شخصیت‌هایی با انتخاب‌های دشوار.', tag:'انیمهٔ سریالی', categories:['animation','series'], color:'#9e9dcc', ids:['tt0213338','tt0877057','tt1355642','tt1910272','tt2560140']}
  ];
  function settings(raw, strict = false) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      if (strict) throw Error('invalid_discovery');
      raw = {};
    }
    const chosen = raw.genres ?? [];
    const active = raw.activeJourney ?? null;
    if (strict && (!Array.isArray(chosen) || chosen.length > 5 || chosen.some(g => !genres.includes(g)) || new Set(chosen).size !== chosen.length || (active !== null && !journeys.some(j => j.id === active)))) throw Error('invalid_discovery');
    return {
      genres: [...new Set(Array.isArray(chosen) ? chosen.filter(g => genres.includes(g)) : [])].slice(0, 5),
      activeJourney: journeys.some(j => j.id === active) ? active : null
    };
  }
  function mergeSettings(current, incoming) {
    const a = settings(current), b = settings(incoming, true);
    return {genres:a.genres.length ? a.genres : b.genres, activeJourney:a.activeJourney || b.activeJourney};
  }
  function similar(titles, source, seen = [], limit = 4) {
    const watched = new Set(seen), sourceGenres = new Set(source.genres || []);
    return titles.filter(t => t.id !== source.id && t.type === source.type).map(t => {
      const common = (t.genres || []).filter(g => sourceGenres.has(g)).length;
      const union = new Set([...(t.genres || []), ...sourceGenres]).size;
      return {title:t, score:common / Math.max(1,union) * 8 + (t.rating - 7) * .4 - Math.min(60,Math.abs(t.year-source.year)) / 100 - (watched.has(t.id) ? 2 : 0)};
    }).sort((a,b) => b.score - a.score || a.title.rank - b.title.rank).slice(0,limit).map(x => x.title);
  }
  function journeyProgress(journey, titles, seen = []) {
    const watched = new Set(seen), byId = new Map(titles.map(t => [t.id,t]));
    const entries = journey.ids.map(id => byId.get(id)).filter(Boolean);
    const done = entries.filter(t => watched.has(t.id)).length;
    const remaining=entries.filter(t=>!watched.has(t.id)),kind=entries[0]?.type || 'movie';
    const minutes=kind==='movie'&&entries.length&&entries.every(t=>t.runtime>0)?entries.reduce((n,t)=>n+t.runtime,0):null;
    const remainingMinutes=kind==='movie'&&remaining.every(t=>t.runtime>0)?remaining.reduce((n,t)=>n+t.runtime,0):null;
    return {entries, done, total:entries.length, next:remaining[0] || null, kind, minutes, remainingMinutes};
  }
  function normalize(value) {return String(value||'').toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200e\u200f]/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
  function filterJourneys(titles,{category='featured',query='',unfinishedOnly=false,seen=[]}={}) {
    const watched=new Set(seen),byId=new Map(titles.map(t=>[t.id,t])),q=normalize(query);
    return journeys.filter(j=>category==='all'||(category==='featured'?j.featured:j.categories.includes(category))).filter(j=>!unfinishedOnly||j.ids.some(id=>!watched.has(id))).filter(j=>!q||normalize([j.title,j.subtitle,j.tag,...j.ids.flatMap(id=>{const t=byId.get(id);return t?[t.title,t.fa,...(t.aliases||[])]:[]})].join(' ')).includes(q));
  }
  window.CinemaDiscovery = {genres, categories, journeys, settings, mergeSettings, similar, journeyProgress, filterJourneys};
})();
