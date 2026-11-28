// Verifies measurements exported by the real Chromium fixture, not simulated sizes.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const [beforePath,afterPath]=process.argv.slice(2);if(!beforePath||!afterPath)throw Error('Informe before-matrix.json e after-matrix.json.');
const before=JSON.parse(readFileSync(beforePath)),after=JSON.parse(readFileSync(afterPath));assert.equal(before.length,9);assert.equal(after.length,9);
const rows=after.map(a=>{const b=before.find(b=>b.size===a.size);assert.ok(b&&!a.error);assert.equal(a.aspect,b.aspect);assert.equal(a.rotated,b.rotated);if(a.viewport.width>=a.viewport.height){assert.deepEqual(a.world,b.world);assert.deepEqual(a.frameLogical,b.frameLogical);}else{assert.equal(a.rotated,'true');assert.ok(a.visible.width*a.visible.height>b.visible.width*b.visible.height*2);assert.ok(a.cropPercent.x<.01);}return {viewport:a.size,rotated:a.rotated,beforeCrop:b.cropPercent,afterCrop:a.cropPercent,beforeVisibleAreaPercent:100*b.visible.width*b.visible.height,afterVisibleAreaPercent:100*a.visible.width*a.visible.height,world:a.world};});
console.log(JSON.stringify({result:'PASS',source:'Chromium DOM measurements; not physical Android',rows},null,2));
