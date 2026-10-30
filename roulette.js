/* Cinema500: small, offline, fair roulette helper. Uses only available catalogue data. */
(()=>{'use strict';
function eligible(titles,kind='all',source='unseen',seen=[],wanted=[]){
 const done=new Set(seen),saved=new Set(wanted);
 return (titles||[]).filter(a=>a&&a.id&&(a.type==='movie'||a.type==='tv')
   &&(kind==='all'||a.type===kind)
   &&(source!=='unseen'||!done.has(a.id))
   &&(source!=='watchlist'||saved.has(a.id)));
}
function randomIndex(max){
 if(!Number.isSafeInteger(max)||max<=0)throw new RangeError('empty roulette');
 const cryptoSource=typeof crypto!=='undefined'?crypto:globalThis.crypto;
 if(cryptoSource&&typeof cryptoSource.getRandomValues==='function'){
  const range=4294967296,ceiling=Math.floor(range/max)*max,number=new Uint32Array(1);
  do{cryptoSource.getRandomValues(number)}while(number[0]>=ceiling);
  return number[0]%max;
 }
 return Math.floor(Math.random()*max);
}
function sample(items,count=8,choose=randomIndex){
 const copy=[...(items||[])],n=Math.min(Math.max(0,count),copy.length);
 for(let i=0;i<n;i++){
  const offset=choose(copy.length-i);
  if(!Number.isInteger(offset)||offset<0||offset>=copy.length-i)throw new RangeError('invalid roulette index');
  const j=i+offset;[copy[i],copy[j]]=[copy[j],copy[i]];
 }
 return copy.slice(0,n);
}
function remaining(items,used=[]){
 const chosen=new Set(used),fresh=(items||[]).filter(a=>!chosen.has(a.id));
 return fresh.length?fresh:[...(items||[])];
}
window.CinemaRoulette={eligible,randomIndex,sample,remaining};
})();