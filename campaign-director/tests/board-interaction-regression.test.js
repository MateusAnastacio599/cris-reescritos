import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const engine = await readFile(new URL('../../quadro/quadro-cris-v7.js', import.meta.url), 'utf8');
const boardHtml = await readFile(new URL('../../quadro/index.html', import.meta.url), 'utf8');
const pinCss = await readFile(new URL('../../quadro/player-pin-actions.css', import.meta.url), 'utf8');

test('visual effects are off by default for both live and archived boards', () => {
  assert.match(engine, /const Af = \{ estilo: "cartoon", fumaca: false, nevoa: 0, brasas: false, poeira: false, liq: false \}/);
  assert.match(engine, /Object\.assign\(\{\}, Af, u\.fx \|\| \{\}\)/);
});

test('new uploads and the Original filter preserve document readability', () => {
  assert.match(engine, /p\[a2\] = await ct\(e2, 2400\)/);
  assert.match(engine, /filter: o2 \|\| "original"/);
  assert.match(engine, /const o2 = Math\.min\(1, 2400 \/ Math\.max\(e2\.width, e2\.height\)\)/);
});

test('pins and connections record their creator and allow explicit connection mode', () => {
  assert.ok((engine.match(/by: Ks \? Os\.me : "host"/g) || []).length >= 3);
  assert.match(engine, /if \("pin" === y\) \{ const p2 = Qe\(e2, n2\); Nt\("pin"\), yt\("select"\), ht\(p2\.id\); return; \}/);
  assert.match(engine, /id="pConnect"/);
  assert.match(engine, /t\("#pConnect"\)\.onclick/);
  assert.match(engine, /u\.pins\.find\(\(p2\) => p2\.id === bt\.pin\)\?\.by !== Os\.me/);
});

test('player permissions and pin controls are available in archive mode without exposing item editing', () => {
  assert.match(engine, /if\(window\.CRISBridge\.archiveId\)\{if\(Ks\)document\.body\.classList\.add\("player"\);return;\}/);
  assert.match(boardHtml, /window\.CRIS_IS_BOARD_OWNER=isOwnedBy/);
  assert.match(pinCss, /body\.player\.pin-selected #props/);
  assert.match(pinCss, /@media \(max-width: 760px\)/);
});
