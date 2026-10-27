import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile('auth.js','utf8')).replace("import('./vendor/supabase-2.118.0.js')",'Promise.resolve(sdk)');
async function boot({verified=true}={}){
 let options,oauth,callback;
 const session={access_token:'test-only'};
 const auth={onAuthStateChange(fn){callback=fn},async getSession(){return {data:{session}}},async getUser(){return verified?{data:{user:{id:'verified-uuid',email:'test@example.com',user_metadata:{full_name:'Verified user'}}}}:{data:{user:null},error:new Error('invalid')}},async signInWithOAuth(params){oauth=params;return {error:null}},async signOut(){callback('SIGNED_OUT',null);return {error:null}}};
 const window={location:{href:'https://riphatake16-debug.github.io/cinema500/'},CINEMA_AUTH_CONFIG:{supabaseUrl:'https://exampleproject.supabase.co',supabasePublishableKey:'sb_publishable_public_example'}};
 const timers=[];
 vm.runInNewContext(source,{window,URL,setTimeout:fn=>timers.push(fn),sdk:{createClient(url,key,opts){options=opts;return {auth}}}});
 await new Promise(resolve=>setImmediate(resolve));
 let state;window.CinemaAuth.subscribe(s=>state=s);
 return {api:window.CinemaAuth,state:()=>state,options,oauth:()=>oauth,flush:async()=>{for(const fn of timers.splice(0))fn();await new Promise(resolve=>setImmediate(resolve));}};
}
test('Configured Google auth uses PKCE, server-verified identity and the exact Pages callback',async()=>{
 const b=await boot();assert.equal(b.options.auth.flowType,'pkce');assert.equal(b.state().user.id,'verified-uuid');
 await b.api.signIn();assert.equal(b.oauth().provider,'google');assert.equal(b.oauth().options.redirectTo,'https://riphatake16-debug.github.io/cinema500/');
 await b.api.signOut();assert.equal(b.state().user,null);await b.flush();assert.equal(b.state().user,null);
});
test('An existing session rejected by the auth server never creates a signed-in user',async()=>{
 const b=await boot({verified:false});assert.equal(b.state().user,null);assert.ok(b.state().error);assert.equal(b.state().loading,false);
});
