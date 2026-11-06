import test from 'node:test';
import assert from 'node:assert/strict';
import {draftCaseRecords, groupRecordAttachments, normalizeArchiveMarkdown} from '../integration-main/case-records.js';

const entry = (code, name) => [
  '### '+code+'. '+name+' · 42 anos',
  '',
  '**Ocupação:** Professor  ',
  '**Ocorrência:** 02/10/2026  ',
  '**Local:** Paris  ',
  '**Classificação preliminar:** Em análise',
  '',
  'Primeiro parágrafo.',
  '',
  '**Material associado:** Documento em análise.'
].join('\n');
const original = ['**DOCUMENTO:** REL-002', entry('03','A'), entry('04','B'), '### OBSERVAÇÕES\n\nTexto geral.'].join('\n\n---\n\n');

test('conversão do formato legado preserva conteúdo e separa as ocorrências', () => {
  const draft = draftCaseRecords(original.replaceAll('\n','\\n'));
  assert.deepEqual(draft.entries.map(row=>row.name), ['A','B']);
  assert.equal(draft.entries[0].summary, 'Primeiro parágrafo.');
  assert.equal(draft.entries[0].notes, '**Material associado:** Documento em análise.');
  assert.equal(draft.entries[0].classification, 'Em análise');
  assert.equal(draft.notes, '### OBSERVAÇÕES\n\nTexto geral.');
  assert.equal(draftCaseRecords(original.replace('**Ocupação:**','**Função:**')), null);
  assert.equal(draftCaseRecords('## 01. IDENTIFICAÇÃO\n\n**Local:** Paris'), null);
  assert.equal(normalizeArchiveMarkdown('Exemplo literal \\n'), 'Exemplo literal \\n');
});

test('anexos seguem o identificador estável após reordenar e renomear', () => {
  const a = {id:'record-a',name:'Nome editado'}, b = {id:'record-b',name:'B'};
  const attachment = {id:'attachment-a',record_id:'record-a'};
  const general = {id:'general',record_id:null};
  const orphan = {id:'older',record_id:'missing'};
  const grouped = groupRecordAttachments([b,a], [attachment,general,orphan]);
  assert.deepEqual(grouped.groups.get(a.id), [attachment]);
  assert.deepEqual(grouped.groups.get(b.id), []);
  assert.deepEqual(grouped.general, [general,orphan]);
});
