/* Rank is derived from unique watched catalogue entries; no extra stored state. */
(() => {
 const tiers=[
  {at:0,name:'تازه‌وارد',tag:'FIRST FRAME',color:'#a5b1c8'},
  {at:5,name:'جویندهٔ داستان',tag:'STORY SEEKER',color:'#8ecab6'},
  {at:15,name:'عاشق سینما',tag:'CINEMA LOVER',color:'#82d6ea'},
  {at:35,name:'کاشف جهان‌ها',tag:'WORLD EXPLORER',color:'#b3a2f2'},
  {at:75,name:'منتقد تیزبین',tag:'THE CRITIC',color:'#e6c38e'},
  {at:150,name:'استاد سینما',tag:'CINEMA MASTER',color:'#e4a6bb'},
  {at:300,name:'افسانهٔ پرده',tag:'SCREEN LEGEND',color:'#8ab7ff'},
  {at:500,name:'اسطورهٔ ۵۰۰',tag:'THE FINAL FRAME',color:'#f1da9e'}
 ];
 function forCount(value){const count=Math.min(500,Math.max(0,Math.floor(Number(value)||0)));let index=0;for(let i=1;i<tiers.length;i++)if(count>=tiers[i].at)index=i;const tier=tiers[index],next=tiers[index+1]||null;return {count,index,level:index+1,tier,next,xp:count*10,remaining:next?next.at-count:0,progress:next?(count-tier.at)/(next.at-tier.at):1};}
 function avatar(index){const level=Math.max(0,Math.min(7,index|0)),color=tiers[level].color;
  const orbit=level>=3?'<ellipse class="avatar-orbit" cx="60" cy="60" rx="53" ry="24" transform="rotate(-38 60 60)" fill="none" stroke="currentColor" opacity=".5" stroke-width="1"/>':'';
  const crown=level>=5?'<path d="m39 29-4-13 14 7 11-13 11 13 14-7-4 13" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>':'';
  const wings=level>=4?'<path d="m30 64-13-8 4 24 13 9m56-25 13-8-4 24-13 9" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="1.5"/>':'';
  const stars=level>=6?'<path d="m18 25 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm84 55 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="currentColor"/>':'';
  const crest=level===7?'<path d="m60 33 4 7 8 2-6 6 1 8-7-4-7 4 1-8-6-6 8-2Z" fill="currentColor"/>':level>=2?'<path d="m60 37 6 7-6 7-6-7Z" fill="currentColor"/>':'<path d="M55 44h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
  return `<svg class="rank-avatar tier-${level}" viewBox="0 0 120 120" fill="none" aria-hidden="true" style="--rank-accent:${color};color:${color}"><circle cx="60" cy="60" r="56" fill="currentColor" fill-opacity=".04"/><circle cx="60" cy="60" r="52" stroke="currentColor" stroke-opacity=".3" stroke-dasharray="${level>=1?'35 5':'2 5'}"/>${orbit}${stars}${wings}<path d="M30 100c2-17 13-25 30-25s28 8 30 25" fill="#171d2a" stroke="currentColor" stroke-opacity=".55" stroke-width="1.5"/><path d="m42 88 18 12 18-12" stroke="currentColor" stroke-opacity=".3"/>${crown}<g class="avatar-core"><path d="M36 44c0-10 9-17 24-17s24 7 24 17v23c0 13-10 23-24 23S36 80 36 67Z" fill="#151b29" stroke="currentColor" stroke-width="1.8"/><path d="M42 48c0-8 7-12 18-12s18 4 18 12" stroke="currentColor" stroke-opacity=".23"/>${crest}<rect x="40" y="53" width="40" height="18" rx="9" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-opacity=".5"/><path class="avatar-visor" d="M47 62h8m10 0h8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M54 78h12" stroke="currentColor" stroke-opacity=".6" stroke-linecap="round"/></g><path d="m60 92 4 4-4 4-4-4Z" fill="currentColor"/><circle cx="${level%2?100:20}" cy="${level%2?39:77}" r="3" fill="currentColor"/></svg>`;
 }
 window.CinemaRanks=Object.freeze({tiers:Object.freeze(tiers.map(Object.freeze)),forCount,avatar});
})();
