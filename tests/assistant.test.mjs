import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const context=vm.createContext({window:{},DOMException,Symbol});
vm.runInContext(await readFile('assistant.js','utf8'),context);
vm.runInContext(await readFile('catalogue.js','utf8'),context);
const assistant=context.window.CinemaAssistant,titles=context.window.CINEMA_CATALOGUE.titles;
const id='openrouter:google/gemma-4-26b-a4b-it:free';
const free=()=>({id,provider:'openrouter',input_cost_key:'prompt',output_cost_key:'completion',costs_currency:'usd-cents',costs:{tokens:1000000,prompt:0,completion:0},pricingOverrides:[]});
const clone=x=>JSON.parse(JSON.stringify(x));

test('Only a current, explicitly free model with verified zero pricing is accepted',()=>{
  assert.equal(assistant.selectFreeModel([free()]).id,id);
  const otherShape={id,provider:'openrouter',cost:{currency:'usd-cents',tokens:1000000,input:0,output:0}};
  assert.equal(assistant.selectFreeModel([otherShape]).id,id);
  for(const change of [m=>delete m.costs,m=>m.costs.prompt=.01,m=>m.costs.completion='0',m=>m.costs.request=1,m=>m.provider='other',m=>m.id=id.replace(':free',''),m=>m.pricingOverrides=[{input:1}],m=>m.id='unknown:free']){
    const row=free();change(row);assert.throws(()=>assistant.selectFreeModel([row]),/free_model_unavailable/);
  }
});

test('Unavailable free models cannot call a paid default or retry a request',async()=>{
  let calls=0;
  const sdk={ai:{listModels:async()=>[{...free(),costs:{prompt:2,completion:5}}],chat:async()=>{calls++;}}};
  await assert.rejects(assistant.generate(sdk,[{role:'user',content:'سلام'}]),/free_model_unavailable/);
  assert.equal(calls,0);
});

test('Live SDK contract pins the free provider and uses real streaming without test mode',async()=>{
  let args,checks=0,calls=0;
  const sdk={ai:{listModels:async provider=>{assert.equal(provider,'openrouter');checks++;return [free()];},chat:async(messages,options)=>{calls++;args={messages,options};return(async function*(){yield {type:'reasoning',text:'private reasoning'};yield {type:'text',text:'سلام! '};yield {type:'text',text:'یک فیلم معمایی؟'};})();}}};
  let painted='';const reply=await assistant.generate(sdk,[{role:'user',content:'فیلم معمایی'}],text=>painted=text);
  assert.equal(reply,'سلام! یک فیلم معمایی؟');assert.equal(painted,reply);assert.equal(calls,1);assert.equal(checks,1);
  assert.equal(args.options.model,id);assert.equal(args.options.provider,'openrouter');assert.equal(args.options.stream,true);assert.equal(args.options.normalize,true);assert.equal('testMode' in args.options,false);
});

test('A canceled catalogue lookup cannot later start a model request',async()=>{
  let release,calls=0;const controller=new AbortController();
  const sdk={ai:{listModels:()=>new Promise(resolve=>release=resolve),chat:async()=>{calls++;}}};
  const request=assistant.generate(sdk,[],null,controller.signal);controller.abort();release([free()]);
  await assert.rejects(request,{name:'AbortError'});assert.equal(calls,0);
});

test('Stream failure and empty output are surfaced rather than appearing as answers',async()=>{
  for(const response of [{message:{content:''}},(async function*(){yield {type:'error',message:'busy'};})()]){
    const sdk={ai:{listModels:async()=>[free()],chat:async()=>response}};
    await assert.rejects(assistant.generate(sdk,[]));
  }
});

test('Context contains public catalogue fields only and limits conversation size',()=>{
  const rows=clone(titles);rows[0].note='PRIVATE_JOURNAL';rows[0].watchedOn='2026-10-29';rows[0].personalRating=7;
  const selected=assistant.contextFor('فیلم درام',rows);
  assert.ok(selected.length<=12);assert.ok(selected.every(row=>!('note' in row)&&!('watchedOn' in row)&&!('personalRating' in row)));
  const history=Array.from({length:20},(_,i)=>({role:i%2?'assistant':'user',content:'x'.repeat(5000),note:'PRIVATE_JOURNAL'}));
  const messages=assistant.buildMessages('یک فیلم پیشنهاد بده',history,selected,true,'2026-10-29');
  assert.equal(messages.length,8);assert.ok(messages.slice(1,-1).every(row=>row.content.length<=1800));
  assert.equal(JSON.stringify(messages).includes('PRIVATE_JOURNAL'),false);
  assert.match(messages[0].content,/فاش نکن/);assert.throws(()=>assistant.buildMessages('x'.repeat(1601),[],[]));
});

test('Local suggestions handle Persian input, known titles, runtime and watched exclusions',()=>{
  const pool=assistant.candidates('فیلم معمایی زیر دو ساعت',titles);
  assert.ok(pool.length>0);assert.ok(pool.every(t=>t.type==='movie'&&t.runtime>0&&t.runtime<=120&&t.genres.includes('Mystery')));
  const excluded=new Set([pool[0].id]);assert.ok(!assistant.candidates('فیلم معمایی زیر دو ساعت',titles,excluded).some(t=>excluded.has(t.id)));
  assert.equal(assistant.matchingTitle('یک سریال شبیه Breaking Bad می‌خواهم',titles).id,'tt0903747');
  assert.ok(assistant.candidates('سریالی شبیه Breaking Bad',titles).every(t=>t.type==='tv'&&t.id!=='tt0903747'));
  assert.match(assistant.answerLocal('چطور پشتیبان بگیرم؟',titles).text,/فایل پشتیبان/);
  assert.match(assistant.answerLocal('چطور دیده‌شده‌هایم را ثبت کنم؟',titles).text,/هنوز ندیده/);
});

test('Model text stays inert and recommendations link only to supplied known IDs',()=>{
  const text='<img src=x onerror=alert(1)> [[tt0111161]] [[tt9999999999]]';
  assert.equal(assistant.safeReply(text).includes('<img'),false);assert.match(assistant.safeReply(text),/&lt;img/);
  assert.deepEqual(clone(assistant.references(text,titles)),['tt0111161']);
  assert.deepEqual(clone(assistant.references(text,titles.filter(t=>t.id!=='tt0111161'))),[]);
  assert.equal(assistant.friendlyError({message:'secret-token-from-upstream'}).includes('secret-token'),false);
});
