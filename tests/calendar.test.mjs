import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const ctx=vm.createContext({window:{addEventListener(){}},document:{addEventListener(){}},Intl,Date});
vm.runInContext(await readFile('dates.js','utf8'),ctx);
const {parts,monthDays}=ctx.window.CinemaCalendar;
test('Persian months map to original ISO dates across Nowruz and leap Esfand',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(parts('2026-10-28'))),{year:1405,month:8,day:6});
 assert.equal(monthDays(1403,12).length,30);assert.equal(monthDays(1404,12).length,29);
 assert.equal(monthDays(1404,1)[0],'2025-03-21');assert.equal(monthDays(1405,1)[0],'2026-03-21');
 for(let m=1;m<=12;m++){const days=monthDays(1405,m);assert.ok(days.length>=29&&days.length<=31);for(let i=0;i<days.length;i++){const p=parts(days[i]);assert.equal(p.year,1405);assert.equal(p.month,m);assert.equal(p.day,i+1);}}
});
test('Date picker replaces native control without altering journal storage values',async()=>{
 const source=await readFile('app.js','utf8');assert.ok(source.includes('type="hidden" id="watched-on"'));assert.ok(!source.includes('type="date"'));assert.ok(source.includes('CinemaDates?.mount()'));assert.ok(source.includes("$('#watched-on').value"));
});
