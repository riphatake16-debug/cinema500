import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=path=>readFile(path,'utf8');

test('optional identity is a no-op without Firebase project and never requires an online account',async()=>{
  const config=await read('firebase-config.js');
  const source=await read('auth.js');
  const win={CINEMA500_FIREBASE_CONFIG:null};
  vm.runInNewContext(source,{window:win,Event:class Event{}});
  assert.equal(win.CinemaAuth.isConfigured(),false);
  assert.equal(win.CinemaAuth.getState().status,'unconfigured');
  assert.equal(win.CinemaAuth.getState().user,null);
  const ui=await read('auth-ui.js');
  assert.match(ui,/دفتر تماشای/);
  assert.match(ui,/همگام/);
  assert.match(config,/CINEMA500_FIREBASE_CONFIG = null/);
  assert.doesNotMatch(config,/serviceAccount|private_key|client_secret/);
});

test('authentication UI, scripts and Firebase config are included in static deployment',async()=>{
 const [home,workflow,app,css,privacy]=await Promise.all([
   read('index.html'),read('../.github/workflows/pages.yml'),read('app.js'),read('auth.css'),read('privacy.html')
 ]);
 assert.match(home,/firebase-config\.js\?v=/);
 assert.match(home,/auth\.js\?v=/);
 assert.match(home,/auth-ui\.js\?v=/);
 assert.match(home,/auth\.css\?v=/);
 assert.match(workflow,/cp index\.html privacy\.html terms\.html auth\.css firebase-config\.js auth\.js auth-ui\.js app\.js/);
 assert.match(app,/id="auth-root"/);
 assert.match(app,/CinemaAuthUI\?\.render\(\)/);
 assert.match(css,/\.auth-panel/);
 assert.match(privacy,/Firebase Authentication/);
});

test('login code does not sync the local journal or expose secrets',async()=>{
 const src=await read('auth.js');
 assert.match(src,/createUserWithEmailAndPassword/);
 assert.match(src,/signInWithEmailAndPassword/);
 assert.match(src,/signInWithPopup/);
 assert.match(src,/sendPasswordResetEmail/);
 assert.match(src,/sendEmailVerification/);
 assert.match(src,/deleteUser/);
 assert.match(src,/window\.Cinema500Android/);
 assert.doesNotMatch(src,/setDoc\(|addDoc\(|localStorage\.getItem\(/);
 assert.match(src,/firebasejs\/.*firebase-app/);
});
