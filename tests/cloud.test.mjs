import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({window:{},setTimeout:()=>1,clearTimeout(){}});vm.runInContext(await readFile('cloud-sync.js','utf8'),context);const create=context.window.createCinemaSync;
const settle=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:value=>resolve(value)}};
test('Network errors retain the durable outbox and a later retry uploads it',async()=>{
 let online=false,queue=[],last,rows=[{id:'tt0111161',status:'seen',note:'offline note'}],writes=[];
 const sync=create({readQueue:()=>queue,writeQueue:(_id,q)=>{queue=q;return true},fetchRows:async()=>{if(!online)throw Error('offline');return []},pushRows:async(_id,r)=>writes.push(r),snapshot:()=>rows,applyRows(){},onStatus:s=>last=s});
 sync.connect('one');sync.mark('tt0111161');await settle();assert.equal(last.phase,'error');assert.equal(queue.length,1);online=true;await sync.sync();assert.equal(last.phase,'synced');assert.equal(queue.length,0);assert.equal(writes[0][0].note,'offline note');
});
test('Edits made while a pull is in flight are protected from remote overwrite',async()=>{
 const remote=deferred();let protectedIds;
 const sync=create({readQueue:()=>[],writeQueue:()=>true,fetchRows:()=>remote.promise,pushRows:async()=>{},snapshot:()=>[{id:'tt0111161',status:'seen',note:'new local note'}],applyRows:(_rows,dirty)=>protectedIds=dirty,onStatus(){}});
 sync.connect('one');sync.mark('tt0111161');remote.resolve([{id:'tt0111161',status:'none',note:'old remote note'}]);await settle();assert.ok(protectedIds.has('tt0111161'));
});
test('Acknowledging an older upload never clears a newer edit to the same title',async()=>{
 const upload=deferred();let version='first',writes=[],queue=[];
 const sync=create({readQueue:()=>[],writeQueue:(_id,q)=>{queue=q;return true},fetchRows:async()=>[],pushRows:async(_id,rows)=>{writes.push(rows);if(writes.length===1)await upload.promise},snapshot:()=>[{id:'tt0111161',status:'seen',note:version}],applyRows(){},onStatus(){}});
 sync.connect('one');await settle();version='second';sync.mark('tt0111161');upload.resolve();await settle();assert.equal(writes.length,2);assert.equal(writes[1][0].note,'second');assert.equal(queue.length,0);
});
test('A previous account response cannot populate or upload the next account journal',async()=>{
 const first=deferred();const applied=[],pushed=[];
 const sync=create({readQueue:()=>[],writeQueue:()=>true,fetchRows:id=>id==='one'?first.promise:Promise.resolve([]),pushRows:async(id,rows)=>pushed.push(id),snapshot:()=>[],applyRows:rows=>applied.push(rows),onStatus(){}});
 sync.connect('one');sync.connect('two');await settle();first.resolve([{id:'tt0111161',note:'private to one'}]);await settle();assert.equal(applied.length,1);assert.equal(applied[0].length,0);assert.equal(pushed.length,0);
});
