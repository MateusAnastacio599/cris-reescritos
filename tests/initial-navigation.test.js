import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script=readFileSync('integration-main/cris.js','utf8');
const setup=script.split("document.addEventListener('DOMContentLoaded', () => {")[1].split("  const login =")[0];
function enter(href,state){let result=href;vm.runInNewContext(setup,{URL,location:{href},history:{state,replaceState:(_,__,url)=>result=String(url)}});return new URL(result);}
test('restored archive navigation returns to briefing',()=>{const url=enter('https://cris.test/?investigation=case&document=doc#arquivos',{crisArchiveNavigation:true});assert.equal(url.hash,'#briefing');assert.equal(url.search,'');});
test('explicit evidence deep links remain available and normal entry has no archive target',()=>{assert.equal(enter('https://cris.test/?evidence=photo#arquivos',null).searchParams.get('evidence'),'photo');assert.equal(enter('https://cris.test/',null).hash,'');});
