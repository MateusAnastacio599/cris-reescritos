import {playCrisMedia} from './media-output.js?v=338';
import {draftCaseRecords, groupRecordAttachments, normalizeArchiveMarkdown, recordFacts} from './case-records.js?v=338';
import {presentDocument} from './document-presentation.js?v=338';
import {archiveClient, CaseArchive, evidenceImage} from './case-archive-data.js?v=338';
import {mountCaseBoards} from './case-boards.js?v=338';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));
const backIcon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg>';
const clipIcon='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9M6 14l8-8"/></svg>';
const statusLabel = published => published ? 'PUBLICADO' : 'RASCUNHO';
const uid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const position = row => '<label>Ordem<input name="position" type="number" min="0" max="99999" required value="'+(row?.position ?? 0)+'"></label>';
const title = row => '<label>Nome<input name="title" maxlength="200" required value="'+escape(row?.title)+'"></label>';
const area = (name, label, value) => '<label>'+label+'<textarea name="'+name+'" maxlength="100000" rows="8">'+escape(value)+'</textarea></label>';
const publication = row => '<label class="case-archive-check"><input type="checkbox" name="published" '+(row?.published?'checked':'')+'> Publicar para os agentes</label>';
const linkBoard = (id, focus) => 'quadro/?board='+id+(focus?'&evidence='+focus:'');
const options = (rows, id, empty) => (empty ? '<option value="">'+empty+'</option>' : '') +
  rows.map(row => '<option value="'+row.id+'" '+(row.id===id?'selected':'')+'>'+escape(row.title)+'</option>').join('');

export async function mountCaseArchive(bridge, identity) {
  const root = document.getElementById('caseArchive');
  if (!root) return;
  const master = identity.isMaster;
  const {parseBlocks, renderReadBlocks} = await import(new URL('markdown.js', bridge.directorURL));
  const documentBlocks = markdown => parseBlocks(normalizeArchiveMarkdown(markdown).replace(/\\(?=\r?$)/gm, ''))
    .filter(block => !['clue','cue','note'].includes(block.type))
    .map(block => block.type === 'todo' ? {...block,type:'list'} : block);
  const readDocument = markdown => renderReadBlocks(documentBlocks(markdown));
  const occurrenceBody=markdown=>presentDocument(documentBlocks(markdown),renderReadBlocks);
  const api = new CaseArchive(await archiveClient(bridge), bridge.campaignId);
  const boards = await bridge.boardLibrary();
  let preview = false, data = {investigations:[], documents:[], attachments:[]}, destinations = [], drafts = [];
  const dialog = document.createElement('dialog');
  dialog.className = 'case-board-dialog case-archive-dialog';
  dialog.setAttribute('aria-label','Arquivos da investigação');
  document.body.append(dialog);
  let urls = [], view = 0;
  const release = () => {
    view++;
    urls.forEach(url => URL.revokeObjectURL(url));
    urls = [];
  };
  dialog.addEventListener('close', () => { if (!dialog.open) {release();const url=new URL(location.href);url.searchParams.delete('document');url.searchParams.delete('evidence');url.searchParams.delete('record');history.replaceState({crisArchiveNavigation:true},'',url);} });
  document.querySelectorAll('a[href="#arquivos"]').forEach(link=>link.addEventListener('click',()=>{dialog.close();navigate('home');}));
  function show(html) {
    release();
    dialog.classList.toggle('archive-compact',!html.startsWith('<header class="dossier-header"'));
    dialog.innerHTML = '<button type="button" class="case-close" data-close aria-label="Fechar">×</button>'+html;
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }
  const errors = error => error?.message || 'Não foi possível concluir. Tente novamente.';
  function report(error) {
    const status = (dialog.open ? dialog : root).querySelector('[role=status]');
    if (status) status.textContent = errors(error);
  }
  const action = fn => (...args) => Promise.resolve().then(() => fn(...args)).catch(report);
  function edit(label, fields, save, back) {
    show('<form><h3>'+label+'</h3>'+fields+'<p role="status"></p><div class="case-archive-actions">'+
      '<button type="button" data-back>Cancelar</button><button type="submit">Salvar</button></div></form>');
    const form = dialog.querySelector('form');
    form.querySelector('[data-back]').onclick = back || (() => dialog.close());
    form.onsubmit = event => {
      event.preventDefault();
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      const fd = new FormData(form);
      const values = {title: String(fd.get('title') || '').trim(), position: Number(fd.get('position')), published: fd.has('published')};
      if (!values.title) {
        button.disabled = false;
        form.querySelector('[role=status]').textContent = 'Informe o nome.';
        return;
      }
      Promise.resolve().then(() => save(values, fd)).catch(report).finally(() => { button.disabled = false; });
    };
  }

  async function refresh() {
    [data, destinations, drafts] = await Promise.all([api.list(), boards.list(false), master ? boards.list(true) : []]);
    render();
  }

  let active = new URLSearchParams(location.search).get('investigation') || 'home';
  const independent = document.getElementById('caseBoards');
  const sources = document.querySelector('#arquivos .external-source');
  function navigate(next) {
    dialog.close();active=next;
    const url=new URL(location.href);
    if(next==='home')url.searchParams.delete('investigation');else url.searchParams.set('investigation',next);
    url.searchParams.delete('document');url.searchParams.delete('evidence');url.searchParams.delete('record');url.hash='arquivos';history.pushState({crisArchiveNavigation:true},'',url);render();root.scrollIntoView({block:'start',behavior:'smooth'});
  }
  addEventListener('popstate',()=>{active=new URLSearchParams(location.search).get('investigation')||'home';render();});
  function render() {
    const manage = master && !preview;
    const investigations = data.investigations.filter(row => !preview || row.published);
    const associated = new Set(investigations.map(row => row.board_id).filter(Boolean));
    const selected=investigations.find(row=>row.id===active);
    if(!selected&&!['home','boards','sources'].includes(active))active='home';
    if(independent)independent.hidden=active!=='boards';
    if(sources)sources.hidden=active!=='sources';
    const dossier = row => {
      const board = (manage ? drafts : destinations).find(item => item.id === row.board_id);
      const docs = data.documents.filter(doc => doc.investigation_id === row.id && (!preview || doc.published));
      const published = new Set(docs.filter(doc => row.published && doc.published).map(doc => doc.id));
      const count = data.attachments.filter(attachment => published.has(attachment.document_id)).length;
      return '<article class="case-board-card dossier-card"><span class="micro-label">'+(manage?statusLabel(row.published):'DOSSIÊ DE INVESTIGAÇÃO')+
        '</span><h4>'+escape(row.title)+'</h4>'+(row.description?'<p>'+escape(row.description)+'</p>':'')+
        '<p class="dossier-counts">'+published.size+(published.size===1?' documento':' documentos')+' · '+count+(count===1?' evidência publicada':' evidências publicadas')+'</p>'+
        (selected ? (docs.length ? '<ul class="case-document-list">'+docs.map(doc => '<li><button type="button" data-document="'+doc.id+'"><span>RELATÓRIO / DOCUMENTO</span><strong>'+
          escape(doc.title)+'</strong>'+(manage?'<small>'+statusLabel(doc.published)+'</small>':'')+'<b aria-hidden="true">Abrir →</b></button></li>').join('')+'</ul>' : '<p>Sem documentos disponíveis.</p>') :
          '<button type="button" class="dossier-open" data-open="'+row.id+'">Consultar investigação <span aria-hidden="true">→</span></button>')+
        (selected&&board?'<div class="dossier-board"><div><span class="micro-label">QUADRO DA INVESTIGAÇÃO</span><p>Reúna as pistas que você escolher. Suas anotações são pessoais.</p></div><a href="'+linkBoard(board.id)+'">'+(manage?'Preparar quadro':'Abrir quadro')+' ↗</a>'+(manage?'<span class="linked-board-controls" data-linked-board="'+board.id+'"></span>':'')+'</div>':'')+
        (selected&&!board?'<p class="case-no-board">O quadro desta investigação ainda não foi liberado.</p>':'')+
        (manage?'<details class="archive-admin"><summary>Gerenciar dossiê</summary><div class="case-archive-actions"><button type="button" data-edit="'+row.id+'">Editar investigação</button><button type="button" data-add="'+row.id+'">Novo documento</button></div></details>':'')+'</article>';
    };
    const heading=selected?'Documentos da investigação':active==='boards'?'Quadros independentes':active==='sources'?'Fontes externas':'Escolha um assunto';
    root.innerHTML = '<nav class="archive-breadcrumb" aria-label="Caminho do acervo">'+
      (active==='home'?'<span>Acervo</span>':'<button type="button" class="archive-back" data-home aria-label="Voltar ao acervo" title="Voltar ao acervo">'+backIcon+'</button><span>'+escape(selected?.title||heading)+'</span>')+'</nav>'+
      '<div class="case-boards-head"><div><span class="micro-label">CASO 26-107</span><h3>'+(selected?'Registros disponíveis':heading)+'</h3></div><div class="case-archive-actions">'+
      (master?'<button type="button" data-preview aria-pressed="'+preview+'">'+(preview?'Voltar à gestão':'Ver como jogador')+'</button>':'')+
      (manage&&active==='home'?'<button type="button" data-new>Nova investigação</button>':'')+'</div></div><p role="status"></p>'+
      (selected?dossier(selected):active==='home'?'<div class="archive-subjects">'+investigations.map(dossier).join('')+
        '<article class="case-board-card archive-utility"><span class="micro-label">ESPAÇO PESSOAL</span><h4>Quadros independentes</h4><p>Organize anotações e explore pistas fora dos dossiês.</p><button type="button" data-open="boards">Consultar quadros →</button></article>'+
        '<article class="case-board-card archive-utility"><span class="micro-label">PESQUISA</span><h4>Fontes externas</h4><p>Links e sites relacionados ao caso, incluindo a LUME.</p><button type="button" data-open="sources">Consultar fontes →</button></article></div>':'');
    root.querySelector('[data-home]')?.addEventListener('click',()=>navigate('home'));
    root.querySelectorAll('[data-open]').forEach(button=>button.onclick=()=>navigate(button.dataset.open));
    root.querySelector('[data-new]')?.addEventListener('click', action(() => editInvestigation()));
    root.querySelector('[data-preview]')?.addEventListener('click', () => { preview = !preview; render(); });
    root.querySelectorAll('[data-edit]').forEach(button => button.onclick = action(() => editInvestigation(data.investigations.find(row => row.id === button.dataset.edit))));
    root.querySelectorAll('[data-add]').forEach(button => button.onclick = () => editDocument(null, button.dataset.add));
    root.querySelectorAll('[data-document]').forEach(button => button.onclick = action(() => openDocument(button.dataset.document)));
    mountCaseBoards({...identity,isMaster:manage}, associated).catch(report);
  }

  async function editInvestigation(row) {
    const drafts = await boards.list(true);
    edit(row?'Editar investigação':'Nova investigação', title(row)+area('description','Descrição',row?.description)+position(row)+
      '<label>Quadro associado<select name="board_id">'+options(drafts,row?.board_id,'Sem quadro')+'</select></label>'+
      '<p>Os agentes só podem abrir quadros publicados pelo mestre.</p>'+publication(row)+
      (row?'<button type="button" data-remove>Excluir investigação</button>':''),
      async (fields, fd) => {
        await api.save('case_investigations', row?.id, {...fields, description: String(fd.get('description')), board_id: fd.get('board_id') || null});
        dialog.close();
        await refresh();
      });
    dialog.querySelector('[data-remove]')?.addEventListener('click', action(async () => {
      if (!confirm('Excluir esta investigação, seus documentos e as referências aos anexos?')) return;
      await api.remove('case_investigations', row.id);
      dialog.close();
      await refresh();
    }));
  }

  function editDocument(row, investigationId) {
    edit(row?'Editar documento':'Novo documento', title(row)+
      '<label>Investigação<select name="investigation_id" required>'+options(data.investigations,investigationId)+'</select></label>'+
      (row?.records ? '<p>Use a opção Gerenciar registros para editar o conteúdo consolidado.</p>' : area('body','Conteúdo',row?.body))+position(row)+publication(row)+
      (row?'<button type="button" data-remove>Excluir documento</button>':''),
      async (fields, fd) => {
        const saved = await api.save('case_documents', row?.id, {...fields, investigation_id: fd.get('investigation_id'), ...(row?.records ? {} : {body:String(fd.get('body'))})});
        await refresh();
        await openDocument(saved.id);
      }, row ? action(() => openDocument(row.id)) : undefined);
    dialog.querySelector('[data-remove]')?.addEventListener('click', action(async () => {
      if (!confirm('Excluir este documento e suas referências de evidência?')) return;
      await api.remove('case_documents', row.id);
      dialog.close();
      await refresh();
    }));
  }

  const recordName = row => row.name !== row.name.toLocaleUpperCase('pt-BR') ? row.name : row.name.toLocaleLowerCase('pt-BR').replace(/(^|[\s-])\p{L}/gu, letter => letter.toLocaleUpperCase('pt-BR'));
  const recordOptions = doc => doc.records?.entries.map(row => ({id:row.id,title:row.code+' · '+recordName(row)})) ?? [];

  function convertRecords(doc, draft, selectedId) {
    show('<h3>Prévia da conversão</h3><p>Confira os registros antes de ativar a edição por vítima. O Markdown original ficará guardado e os anexos gerais permanecem no documento.</p>'+
      draft.entries.map(row => '<details class="occurrence-section"><summary>'+escape(row.code+' · '+recordName(row))+'</summary>'+
        '<dl class="record-facts">'+recordFacts.map(([key,label])=>'<div><dt>'+label+'</dt><dd>'+escape(row[key])+'</dd></div>').join('')+'</dl>'+
        '<div class="case-document-body">'+readDocument([row.summary,row.notes].filter(Boolean).join('\n\n'))+'</div></details>').join('')+
      '<p role="status"></p><div class="case-archive-actions"><button type="button" data-back>Voltar à leitura</button><button type="button" data-convert>Confirmar conversão</button></div>');
    dialog.querySelector('[data-back]').onclick = action(() => openDocument(doc.id,false,selectedId));
    dialog.querySelector('[data-convert]').onclick = action(async event => {
      const button = event.target.closest('button');
      button.disabled = true;
      try {
        const entries = draft.entries.map(row => ({...row,id:crypto.randomUUID()}));
        await api.saveRecords(doc,{...draft,entries});
        await openDocument(doc.id,false,entries[draft.entries.findIndex(row => row.id===selectedId)]?.id);
      } finally { button.disabled = false; }
    });
  }

  function editRecord(doc, row) {
    const input = (key,label,required=false) => '<label>'+label+'<input name="'+key+'" maxlength="240" '+(required?'required ':'')+'value="'+escape(row?.[key])+'"></label>';
    const entries = doc.records.entries;
    const index = entries.findIndex(record => record.id === row?.id);
    show('<form><h3>'+(row?'Editar registro':'Novo registro')+'</h3><div class="record-editor-fields">'+
      input('code','Identificação')+input('name','Nome da vítima',true)+recordFacts.map(([key,label])=>input(key,label)).join('')+
      '<label>Posição<input type="number" name="order" min="1" max="'+(row?entries.length:entries.length+1)+'" value="'+(row?index+1:entries.length+1)+'" required></label></div>'+
      area('summary','Registro da ocorrência',row?.summary)+area('notes','Informações complementares',row?.notes)+
      '<p role="status"></p><div class="case-archive-actions"><button type="button" data-back>Cancelar</button>'+
      (row&&entries.length>1?'<button type="button" data-remove>Excluir registro</button>':'')+'<button type="submit">Salvar registro</button></div></form>');
    const form = dialog.querySelector('form');
    const back = id => openDocument(doc.id,false,id);
    form.querySelector('[data-back]').onclick = action(() => back(row?.id));
    form.onsubmit = event => {
      event.preventDefault();
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      action(async () => {
        try {
          const fd = new FormData(form);
          const record = {id:row?.id || crypto.randomUUID()};
          for (const key of ['code','name',...recordFacts.map(([key])=>key),'summary','notes']) record[key] = String(fd.get(key)).trim();
          const next = entries.filter(entry => entry.id !== record.id);
          next.splice(Number(fd.get('order'))-1,0,record);
          await api.saveRecords(doc,{...doc.records,entries:next});
          await back(record.id);
        } finally { button.disabled = false; }
      })();
    };
    form.querySelector('[data-remove]')?.addEventListener('click', action(async () => {
      if (!confirm('Excluir este registro? Os registros com anexos precisam ter os vínculos movidos primeiro.')) return;
      await api.saveRecords(doc,{...doc.records,entries:entries.filter(entry=>entry.id!==row.id)});
      await back();
    }));
  }

  function editAttachment(document, row, recordId) {
    edit(row?'Editar evidência':'Nova evidência', title(row)+area('body','Descrição ou depoimento',row?.body)+
      (row?.object_path?'':'<label>Arquivo original (opcional)<input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,audio/mpeg,audio/ogg,audio/wav,text/plain"></label>')+
      (document.records ? '<label>Vincular a um registro<select name="record_id">'+options(recordOptions(document),row ? row.record_id : recordId,'Anexos gerais')+'</select></label>' : '')+
      position(row)+publication(row)+(row?'<button type="button" data-remove>Excluir evidência</button>':''),
      async (fields, fd) => {
        fields.body = String(fd.get('body'));
        if (document.records) fields.record_id = fd.get('record_id') || null;
        const file = fd.get('file');
        if (file?.size > 26214400) throw Error('O arquivo deve ter até 25 MB.');
        const original = file?.size ? file : null;
        if (row?.mime!=='application/x-cris-object' && !row?.object_path && !original && !fields.body.trim() && (!row || fields.published)) {
          throw Error('Anexe um arquivo ou escreva o conteúdo da evidência.');
        }
        if (row) await api.completeAttachment(row, fields, original);
        else await api.attach(document.id, fields, original);
        await openDocument(document.id,true,fields.record_id || recordId);
      }, action(() => openDocument(document.id,true,recordId)));
    dialog.querySelector('[data-remove]')?.addEventListener('click', action(async () => {
      if (!confirm('Excluir esta evidência e os pins que a referenciam?')) return;
      await api.remove('case_attachments', row.id);
      await openDocument(document.id,true,recordId);
    }));
  }

  async function openDocument(id, expandAnnexes = false, recordId) {
    const result = await api.document(id);
    const available = await boards.list(false);
    renderDocument(result, available, expandAnnexes, recordId);
  }

  function renderDocument(result, available, expandAnnexes, recordId, focusRecord = false) {
    const doc = result.document;
    const investigation = data.investigations.find(row => row.id === doc?.investigation_id);
    if (!doc || !investigation || (preview && (!doc.published || !investigation.published))) {
      show('<h3>Documento indisponível</h3><p>Este documento não está acessível à sua conta.</p>');
      return;
    }
    const manage = master && !preview;
    const attach = result.attachments.filter(row => !preview || row.published);
    const draft = doc.records ? null : draftCaseRecords(doc.body);
    const records = doc.records || draft;
    const body = !records && doc.body ? occurrenceBody(doc.body) : {overview:'',details:'',annex:''};
    const selectedRecord = records?.entries.find(row => row.id===recordId) || records?.entries[0];
    const {groups, general} = groupRecordAttachments(records?.entries ?? [],attach);
    const visibleAttachments = selectedRecord ? groups.get(selectedRecord.id) : [];
    const add = !master || preview
      ? (available.length
        ? '<button type="button" data-pin>Adicionar ao quadro</button>'
        : '<small class="case-no-board">Nenhum quadro disponível para esta evidência.</small>')
      : '';
    const evidenceCard = row => '<article class="case-board-card case-attachment" data-attachment="'+row.id+'">'+
      (row.object_path && evidenceImage(row.mime)?'<div class="case-file-preview" aria-busy="true"></div>':
        '<span class="case-file-kind" aria-hidden="true">'+(row.mime?.startsWith('audio/')?'♫':clipIcon)+'</span>')+
      '<span class="micro-label">'+(row.mime==='application/x-cris-object'?'OBJETO INTERATIVO · ':'')+(manage?statusLabel(row.published):'EVIDÊNCIA')+'</span><h4>'+escape(row.title)+'</h4>'+
      (row.body?'<div class="case-document-body">'+readDocument(row.body)+'</div>':'')+
      (row.mime!=='application/x-cris-object'&&!row.object_path&&!row.body&&manage?'<p>Aguardando arquivo original.</p>':'')+
      '<div class="case-archive-actions">'+add+
      (row.object_path?'<button type="button" data-original>Arquivo original</button>':'')+
      (row.mime?.startsWith('audio/')&&row.object_path?'<button type="button" data-play-audio>Ouvir áudio</button>':'')+
      (row.object_path && ['application/pdf','text/plain'].includes(row.mime)?'<button type="button" data-open-file>Visualizar</button>':'')+'</div>'+
      (manage?'<details class="archive-admin"><summary>Gerenciar evidência</summary><button type="button" data-edit-attachment>Editar evidência</button></details>':'')+'</article>';
    const annexesMarkup = (rows, manifest, label) => (rows.length||manifest) ?
      '<details class="dossier-annexes"><summary>'+clipIcon+'<strong>'+label+'</strong>'+
      (rows.length?'<span>'+rows.length+(rows.length===1?' evidência':' evidências')+'</span>':'')+
      '<svg class="annex-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>'+
      '<div class="dossier-annexes-body">'+(rows.length?'<div class="evidence-gallery">'+rows.map(evidenceCard).join('')+'</div>':'')+
      (manifest?'<div class="annex-manifest case-document-body">'+manifest+'</div>':'')+'</div></details>' : '';
    const recordsMarkup = records ? '<div class="case-records">'+(records.intro?'<div class="records-intro case-document-body">'+readDocument(records.intro)+'</div>':'')+
      '<label class="record-picker-mobile">Consultar ocorrência<select data-record-select>'+
        options(records.entries.map(row=>({id:row.id,title:row.code+' · '+recordName(row)})),selectedRecord.id)+'</select></label>'+
      '<nav class="record-picker" aria-label="Ocorrências do documento">'+records.entries.map(row=>
        '<button type="button" data-record="'+row.id+'" aria-pressed="'+(row===selectedRecord)+'"><span>'+escape(row.code)+'</span>'+escape(recordName(row))+'</button>').join('')+'</nav>'+
      '<section class="record-current" aria-labelledby="record-name"><header><span class="micro-label">REGISTRO '+escape(selectedRecord.code)+'</span><h4 id="record-name">'+escape(recordName(selectedRecord))+'</h4></header>'+
      '<dl class="record-facts">'+recordFacts.filter(([key])=>selectedRecord[key]).map(([key,label])=>'<div><dt>'+label+'</dt><dd>'+escape(selectedRecord[key])+'</dd></div>').join('')+'</dl>'+
      (selectedRecord.summary?'<div class="record-summary case-document-body"><h5>Registro da ocorrência</h5>'+readDocument(selectedRecord.summary)+'</div>':'')+
      (selectedRecord.notes?'<details class="occurrence-section"><summary>Informações complementares</summary><div class="case-document-body">'+readDocument(selectedRecord.notes)+'</div></details>':'')+
      (visibleAttachments.length?'<section class="record-evidence"><h5>Evidências do registro</h5><div class="evidence-gallery">'+visibleAttachments.map(evidenceCard).join('')+'</div></section>':'')+'</section>'+
      (records.notes?'<details class="occurrence-section record-general-notes"><summary>Observações do documento</summary><div class="case-document-body">'+readDocument(records.notes)+'</div></details>':'')+'</div>' : '';
    show('<header class="dossier-header"><span class="micro-label">'+escape(investigation.title)+'</span><h3>'+escape(doc.title)+'</h3>'+
      (manage?'<small>'+statusLabel(doc.published && investigation.published)+' · acesso dos agentes</small>':'')+'</header>'+
      '<p role="status"></p>'+(records?recordsMarkup:body.overview)+
      annexesMarkup(general,records?'':body.annex,records?'Anexos gerais':'Anexos')+
      (!records&&body.details?'<section class="dossier-complement"><h4>Informações complementares</h4><div class="case-document-body">'+body.details+'</div></section>':'')+
      ((!master || preview) && available.length ? '<button type="button" data-pin-document>Adicionar documento ao quadro</button>' : '')+
      (manage?'<details class="archive-admin"><summary>Gerenciar documento</summary><div class="case-archive-actions"><button type="button" data-edit-doc>Editar documento</button><button type="button" data-add-attachment>Nova evidência</button>'+
      (draft?'<button type="button" data-convert-records>Revisar conversão em registros</button>':'')+
      (doc.records?'<button type="button" data-edit-record>Editar registro atual</button><button type="button" data-new-record>Novo registro</button>':'')+'</div></details>':''));
    const annexes=dialog.querySelector('.dossier-annexes');
    if(expandAnnexes&&annexes)annexes.open=true;
    if (focusRecord && selectedRecord) {
      const picker = dialog.querySelector(focusRecord==='select'?'[data-record-select]':'[data-record="'+selectedRecord.id+'"]');
      picker?.focus();
    }
    dialog.querySelectorAll('[data-record]').forEach(button=>button.onclick=()=>renderDocument(result,available,false,button.dataset.record,'button'));
    dialog.querySelector('[data-record-select]')?.addEventListener('change',event=>renderDocument(result,available,false,event.target.value,'select'));
    dialog.querySelector('[data-convert-records]')?.addEventListener('click',()=>convertRecords(doc,draft,selectedRecord.id));
    dialog.querySelector('[data-edit-record]')?.addEventListener('click',()=>editRecord(doc,selectedRecord));
    dialog.querySelector('[data-new-record]')?.addEventListener('click',()=>editRecord(doc));
    const current = view;
    dialog.querySelector('[data-edit-doc]')?.addEventListener('click', () => editDocument(doc, doc.investigation_id));
    dialog.querySelector('[data-add-attachment]')?.addEventListener('click', () => editAttachment(doc,null,doc.records ? selectedRecord?.id : null));
    dialog.querySelectorAll('[data-pin]').forEach(button => button.onclick = action(async () => {
      const id = button.closest('[data-attachment]').dataset.attachment;
      button.disabled = true;
      try { await chooseBoard(investigation, 'attachment', id, doc.id, selectedRecord?.id); } finally { button.disabled = false; }
    }));
    dialog.querySelector('[data-pin-document]')?.addEventListener('click', action(() => chooseBoard(investigation, 'document', doc.id, doc.id, selectedRecord?.id)));
    for (const row of [...visibleAttachments,...general]) {
      const card = dialog.querySelector('[data-attachment="'+row.id+'"]');
      card.querySelector('[data-edit-attachment]')?.addEventListener('click', () => editAttachment(doc,row,selectedRecord?.id));
      if (!row.object_path) continue;
      const original = card.querySelector('[data-original]');
      let pending;
      const load = () => pending ||= (async () => {
        const blob = await api.original(row);
        if (view !== current) return null;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return url;
      })().catch(error => { pending = null; throw error; });
      original.onclick = action(async () => {
        const url = await load();
        if (!url) return;
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = row.title;
        anchor.click();
      });
      card.querySelector('[data-play-audio]')?.addEventListener('click', action(async event => {
        const button = event.target.closest('button');
        button.disabled = true;
        try {
          const url = await load();
          if (!url) return;
          const audio = document.createElement('audio');
          audio.controls = true;
          audio.src = url;
          card.append(audio);
          button.remove();
          playCrisMedia(audio).catch(() => {});
        } finally { button.disabled = false; }
      }));
      card.querySelector('[data-open-file]')?.addEventListener('click', action(async event => {
        const button = event.target.closest('button');
        button.disabled = true;
        try {
          const url = await load();
          if (!url) return;
          const panel = document.createElement('dialog');
          panel.className = 'evidence-zoom case-file-reader';
          const close = document.createElement('button');
          close.textContent = 'Fechar arquivo';
          close.onclick = () => panel.close();
          const file = document.createElement('iframe');
          file.title = row.title;
          file.src = url;
          file.setAttribute('sandbox','');
          panel.append(close,file);
          document.body.append(panel);
          panel.onclose = () => { panel.remove(); button.focus(); };
          panel.showModal();
        } finally { button.disabled = false; }
      }));
      const frame = card.querySelector('.case-file-preview');
      if (!frame) continue;
      load().then(url => {
        if (!url) return;
        const img = document.createElement('img');
        img.src = url;
        img.alt = row.title;
        const enlarge = document.createElement('button');
        enlarge.type = 'button';
        enlarge.className = 'evidence-enlarge';
        enlarge.setAttribute('aria-label','Ampliar imagem de '+row.title);
        enlarge.append(img);
        enlarge.onclick = () => {
          const zoom = document.createElement('dialog');
          zoom.className = 'evidence-zoom';
          const close = document.createElement('button');
          close.textContent = 'Fechar imagem';
          close.onclick = () => zoom.close();
          const full = img.cloneNode();
          zoom.append(close, full);
          document.body.append(zoom);
          zoom.onclose = () => { zoom.remove(); enlarge.focus(); };
          zoom.showModal();
        };
        frame.append(enlarge);
        const fileLink = document.createElement('a');
        fileLink.href = url;
        fileLink.target = '_blank';
        fileLink.rel = 'noopener';
        fileLink.textContent = 'Arquivo original';
        original.replaceWith(fileLink);
      }).catch(() => {
        if (view === current) frame.textContent = 'Imagem indisponível.';
      }).finally(() => frame.removeAttribute('aria-busy'));
    }
  }

  async function chooseBoard(investigation, kind, sourceId, documentId, recordId) {
    const available = [...await boards.list(false)];
    available.sort((a,b) => Number(b.id === investigation.board_id) - Number(a.id === investigation.board_id));
    const back = () => openDocument(documentId,kind==='attachment',recordId);
    async function addTo(boardId) {
      const result = await api.pin(boardId,kind,sourceId);
      show('<h3>'+(result.existing?'Evidência já está no quadro':'Evidência adicionada')+'</h3>'+
        '<div class="case-archive-actions"><a href="'+linkBoard(boardId,result.id)+'">Abrir quadro e localizar pin ↗</a>'+
        '<button type="button" data-back>Voltar ao documento</button></div>');
      dialog.querySelector('[data-back]').onclick = action(back);
    }
    if (available.length === 1 && !preview) {
      await addTo(available[0].id);
      return;
    }
    const content = !available.length ? '<p>Nenhum quadro disponível para esta evidência.</p>' :
      '<form><label>Quadro de destino<select name="board">'+options(available,investigation.board_id)+'</select></label>'+
      (preview ? '<p>Prévia do jogador. Apenas uma conta de jogador pode salvar o pin.</p>' : '<button type="submit">Adicionar</button>')+'</form>';
    show('<h3>Adicionar ao quadro</h3><p role="status"></p>'+content+
      '<div class="case-archive-actions archive-dialog-footer"><button type="button" data-back>Voltar ao documento</button></div>');
    dialog.querySelector('[data-back]').onclick = action(back);
    const form = dialog.querySelector('form');
    if (!form || preview) return;
    form.onsubmit = event => {
      event.preventDefault();
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      addTo(new FormData(form).get('board')).catch(report).finally(() => { button.disabled = false; });
    };
  }

  await refresh();
  const params=new URLSearchParams(location.search),target=params.get('document'),evidence=params.get('evidence'),record=params.get('record');
  if(location.hash==='#arquivos'||params.has('investigation')||target||evidence){document.getElementById('arquivos')?.classList.add('is-open');document.querySelector('.content')?.classList.add('view-restricted');}
  if(target||evidence){const consumed=new URL(location.href);consumed.searchParams.delete('document');consumed.searchParams.delete('evidence');consumed.searchParams.delete('record');history.replaceState({crisArchiveNavigation:true},'',consumed);}
  if(evidence&&uid.test(evidence)){const r=await api.rows('case_attachments','*').eq('id',evidence).maybeSingle();if(r.data){await openDocument(r.data.document_id,true,r.data.record_id);dialog.querySelector('[data-attachment="'+evidence+'"]')?.scrollIntoView({block:'nearest'});}else show('<h3>Evidência indisponível</h3><p>Este conteúdo não está disponível para esta conta.</p>');}
  else if(target&&uid.test(target))await openDocument(target,false,uid.test(record)?record:undefined);
}
