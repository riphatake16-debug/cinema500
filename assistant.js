/* Lightweight Persian intent-based recommender. No network calls, API keys or generative AI. */
(()=>{'use strict';
const normalize=text=>String(text||'').toLowerCase().replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200f\u200e]/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const genreWords={
'Comedy':['کمدی','خنده','خنده دار','بامزه','شاد','طنز','حال خوب','سرگرم کننده','funny','comedy'],
'Drama':['درام','احساسی','غمگین','غم انگیز','گریه','تلخ','دراماتیک','emotional','drama'],
'Crime':['جنایی','مافیا','پلیسی','کارآگاه','جرم','جنایت','criminal','crime'],
'Mystery':['معمایی','معما','رازآلود','راز','کارآگاهی','mystery'],
'Thriller':['هیجانی','هیجان','تعلیق','دلهره','پر تنش','thriller'],
'Horror':['ترسناک','وحشت','ترس','جن','ارواح','horror'],
'Sci-Fi':['علمی تخیلی','فضایی','فضا','آینده','ربات','سای فای','سایفای','sci-fi','science fiction'],
'Action':['اکشن','مبارزه','جنگیدن','زد و خورد','action'],
'Adventure':['ماجراجویی','ماجراجویانه','ماجرا','سفر','adventure'],
'Romance':['عاشقانه','رمانتیک','عشق','romance'],
'Animation':['انیمیشن','کارتون','پویانمایی','animation','anime'],
'Fantasy':['فانتزی','جادو','جادویی','افسانه','fantasy'],
'Documentary':['مستند','واقعی','حقیقت','documentary'],
'Biography':['زندگینامه','زندگی نامه','بیوگرافی','زندگی واقعی','biography'],
'History':['تاریخی','تاریخ','history'],
'War':['جنگی','جنگ جهانی','سرباز','war'],
'Family':['خانوادگی','بچه ها','برای خانواده','family'],
'Sport':['ورزشی','ورزش','فوتبال','بوکس','sport'],
'Music':['موزیکال','موسیقی','آهنگ','music']
};
const includesWord=(s,term)=>s.includes(normalize(term));
const numberWord={نیم:0.5,یک:1,یکی:1,دو:2,سه:3,چهار:4};
function parse(query){
 const s=normalize(query), exclude=new Set(), genres=[];
 for(const [genre,words] of Object.entries(genreWords)){
  const matches=words.map(normalize).filter(w=>s.includes(w));
  if(!matches.length)continue;
  const negative=matches.some(w=>{const p=s.indexOf(w);return /(?:بدون|نمی خوام|نمیخوام|نباشه|نه|غیر)\s*$/.test(s.slice(Math.max(0,p-17),p))});
  if(negative)exclude.add(genre);else genres.push(genre);
 }
 const kind=/(?:سریال|مینی سریال|series|tv show)/.test(s)?'tv':/(?:فیلم|movie)/.test(s)?'movie':null;
 const unseen=/(?:ندیدم|ندیده|هنوز ندید|تکراری نباشه|جدید برای من)/.test(s);
 const saved=/(?:لیست تماشا|ذخیره کردم|ذخیره شده|بوکمارک|واچ لیست)/.test(s);
 let maxMinutes=null;
 const hours=s.match(/(?:زیر|کمتر از|تا|حداکثر|نهایتا|نهایتاً)?\s*(\d+(?:\.\d+)?|نیم|یک|دو|سه|چهار)(?:\s*و\s*نیم)?\s*(?:ساعت|ساعته)/);
 const mins=s.match(/(?:زیر|کمتر از|تا|حداکثر|نهایتا)?\s*(\d+)\s*دقیقه/);
 if(hours){const h=Number(hours[1])||numberWord[hours[1]]||1;maxMinutes=Math.round(h*60+(hours[0].includes('و نیم')?30:0))}
 if(mins)maxMinutes=Math.min(maxMinutes||Infinity,Number(mins[1]));
 let minRating=null;const rating=s.match(/(?:امتیاز|نمره|imdb|آی ام دی بی)\s*(?:بالای|بیشتر از|حداقل|از)?\s*(\d(?:\.\d)?)/);
 if(rating)minRating=Number(rating[1]);
 const period=/(?:جدید|تازه|مدرن|امروزی)/.test(s)?2010:/(?:قدیمی|کلاسیک|نوستالژی)/.test(s)?-2000:null;
 const year=s.match(/(?:بعد از|بعد)\s*(19\d\d|20\d\d)/);
 const wantsSeen=/(?:دیدم|دیده شده|قبلا دیده ام)/.test(s)&&!unseen;
 const tokens=s.split(/\s+/).filter(w=>w.length>3&&!/^(فیلم|سریال|میخوام|می خوام|پیشنهاد|یه|برام|چی|ببینم|دارم|بده|اسم|خیلی|باشه|نباشه|درباره|شبیه|داشته|میشه|میتونی)$/.test(w));
 return {query:s,kind,genres,exclude:[...exclude],unseen,saved,maxMinutes,minRating,period,afterYear:year?Number(year[1]):null,wantsSeen,tokens};
}
function recommend(query,titles,watched=[],watchlist=[],limit=5){
 const intent=parse(query),done=new Set(watched),saved=new Set(watchlist);let candidates=(titles||[]).filter(a=>a&&a.id&&a.type);
 if(intent.kind)candidates=candidates.filter(a=>a.type===intent.kind);
 if(intent.unseen)candidates=candidates.filter(a=>!done.has(a.id));
 if(intent.saved)candidates=candidates.filter(a=>saved.has(a.id));
 if(intent.wantsSeen)candidates=candidates.filter(a=>done.has(a.id));
 if(intent.maxMinutes)candidates=candidates.filter(a=>a.runtime>0&&a.runtime<=intent.maxMinutes);
 if(intent.minRating)candidates=candidates.filter(a=>a.rating>=intent.minRating);
 if(intent.afterYear)candidates=candidates.filter(a=>a.year>intent.afterYear);
 if(intent.period===2010)candidates=candidates.filter(a=>a.year>=2010);
 if(intent.period===-2000)candidates=candidates.filter(a=>a.year<2000);
 if(intent.exclude.length)candidates=candidates.filter(a=>!intent.exclude.some(g=>(a.genres||[]).includes(g)));
 const scored=candidates.map(a=>{
  const matches=intent.genres.filter(g=>(a.genres||[]).includes(g));
  const searchable=normalize([a.title,a.fa,a.summary].filter(Boolean).join(' '));
  const textMatches=intent.tokens.filter(w=>searchable.includes(w)).length;
  const relevance=matches.length*5+textMatches*1.7;
  const score=relevance*10+(a.rating||0)*2.5+(251-Math.min(250,a.rank||250))*.017+(done.has(a.id)?-4:3)+(saved.has(a.id)?2:0);
  const reasons=[...matches.slice(0,2).map(g=>({g,txt:({Comedy:'کمدی',Drama:'درام',Crime:'جنایی',Mystery:'معمایی',Thriller:'هیجان انگیز',Horror:'ترسناک','Sci-Fi':'علمی‌تخیلی',Action:'اکشن',Adventure:'ماجراجویی',Romance:'عاشقانه',Animation:'انیمیشن',Fantasy:'فانتزی',Documentary:'مستند',Biography:'زندگی‌نامه',History:'تاریخی',War:'جنگی',Family:'خانوادگی',Sport:'ورزشی',Music:'موسیقی'})[g]||g})).map(x=>x.txt)];
  if(intent.maxMinutes&&a.runtime)reasons.push(a.runtime+' دقیقه');
  if(!reasons.length)reasons.push('امتیاز IMDb '+a.rating);
  return {title:a,score,relevance,reasons};
 }).sort((a,b)=>b.score-a.score||a.title.rank-b.title.rank);
 // A descriptive genre query must not silently return irrelevant titles as perfect matches.
 const hasGenre=intent.genres.length>0;
 const matching=scored.filter(a=>!hasGenre||a.relevance>=5);
 const top=(matching.length?matching:scored).slice(0,Math.max(1,Math.min(12,limit)));
 return {intent,results:top,exact:!hasGenre||matching.length>0,total:candidates.length};
}
window.CinemaAssistant={normalize,parse,recommend};
})();