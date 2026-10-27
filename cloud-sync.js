/* Durable per-title outbox. No account credentials or records are stored here. */
(() => {
 function createCinemaSync({readQueue,writeQueue,fetchRows,pushRows,snapshot,applyRows,onStatus,delay=800}){
  let owner=null,generation=0,pending=new Map(),serial=0,busy=false,timer,requested=false;
  const status=(phase,error='')=>onStatus({phase,error,pending:pending.size});
  const persist=()=>{if(!writeQueue(owner,[...pending]))throw Error('outbox_storage_failed');};
  function mark(id){if(!owner)return;pending.set(id,++serial);try{persist();status('pending');}catch{status('error','تغییرات روی دستگاه است؛ صف همگام‌سازی ذخیره نشد.');return;}schedule();}
  function schedule(){clearTimeout(timer);if(owner)timer=setTimeout(()=>sync(),delay);}
  async function sync(){if(!owner)return;if(busy){requested=true;return;}busy=true;const run=++generation,user=owner;status('syncing');try{
   const rows=await fetchRows(user);if(run!==generation||user!==owner)return;
   const remote=new Set(rows.map(row=>row.id));
   applyRows(rows,new Set(pending.keys()));
   // Existing local entries missing from the server are uploaded, never discarded.
   for(const row of snapshot())if(!remote.has(row.id)&&!pending.has(row.id))pending.set(row.id,++serial);
   persist();
   while(pending.size){
    const batch=new Map(pending);const local=new Map(snapshot().map(row=>[row.id,row]));
    const outgoing=[...batch.keys()].map(id=>local.get(id)||{id,status:'none',rating:null,favorite:false,watchedOn:null,note:''});
    await pushRows(user,outgoing);if(run!==generation||user!==owner)return;
    for(const [id,revision] of batch)if(pending.get(id)===revision)pending.delete(id);
    persist();
   }
   status('synced');
  }catch{if(run===generation&&user===owner)status('error','ارتباط با دفتر ابری برقرار نشد؛ تغییرات روی این دستگاه حفظ شده‌اند.');}
  finally{if(run===generation&&user===owner){busy=false;if(requested){requested=false;schedule();}}}}
  return {connect(id){if(id===owner)return;clearTimeout(timer);generation++;busy=false;requested=false;owner=id;pending=new Map();serial=0;if(!id){status('local');return;}try{const saved=readQueue(id);pending=new Map(saved.filter(p=>Array.isArray(p)&&/^tt\d{7,12}$/.test(p[0])&&Number.isSafeInteger(p[1])));serial=Math.max(0,...pending.values());}catch{status('error','صف همگام‌سازی خوانده نشد.');return;}sync();},mark,sync,status:()=>({owner,pending:[...pending.keys()],busy})};
 }
 window.createCinemaSync=createCinemaSync;
})();
