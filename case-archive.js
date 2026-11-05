import {archiveClient, CaseArchive, evidenceImage} from './case-archive-data.js?v=327';
import {mountCaseBoards} from './case-boards.js?v=327';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));
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
  const documentBlocks = markdown => parseBlocks(markdown.replace(/\\(?=\r?$)/gm, ''))
    .filter(block => !['clue','cue','note'].includes(block.type))
    .map(block => block.type === 'todo' ? {...block,type:'list'} : block);
  const readDocument = markdown => renderReadBlocks(documentBlocks(markdown));
  function occurrenceBody(markdown) {
    const sections = [{title:'Dados do registro', blocks:[]}];
    for (const block of documentBlocks(markdown)) {
      if (block.type === 'h2') sections.push({title:block.text, blocks:[]});
      else sections.at(-1).blocks.push(block);
    }
    const identification = sections.find(section => /identificação/i.test(section.title));
    const fields = identification?.blocks.filter(block => block.type !== 'divider');
    const lines = fields?.every(block => block.type === 'paragraph')
      ? fields.flatMap(block => block.text.split('\n')).map(line => line.match(/^\*\*([^*]+):\*\*\s*(.+)$/))
      : null;
    if (!lines?.length || !lines.every(Boolean)) return {overview:'',details:readDocument(markdown)};
    const conclusion = sections.find(section => /conclusão/i.test(section.title));
    const summary = conclusion?.blocks.find(block => block.type === 'paragraph');
    const overview = '<section class="occurrence-overview" aria-label="Ficha da ocorrência"><dl class="occurrence-facts">'+
      lines.map(([,key,value]) => '<div><dt>'+escape(key)+'</dt><dd>'+escape(value)+'</dd></div>').join('')+
      '</dl>'+(summary?'<div class="case-document-body"><strong>EM RESUMO</strong>'+renderReadBlocks([summary])+'</div>':'')+'</section>';
    const details = sections.filter(section => section !== identification && section.blocks.length).map(section =>
      '<details class="occurrence-section"><summary>'+escape(section.title)+'</summary><div class="case-document-body">'+
      renderReadBlocks(section.blocks)+'</div></details>').join('');
    return {overview,details};
  }
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
  dialog.addEventListener('close', () => { if (!dialog.open) release(); });
  function show(html) {
    release();
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

  function render() {
    const manage = master && !preview;
    const investigations = data.investigations.filter(row => !preview || row.published);
    const associated = new Set(investigations.map(row => row.board_id).filter(Boolean));
    mountCaseBoards({...identity,isMaster:manage}, associated).catch(report);
    root.innerHTML = '<div class="case-boards-head"><div><span class="micro-label">CASO 26-107</span><h3>Investigações</h3></div>'+
      '<div class="case-archive-actions">'+(master ? '<button type="button" data-preview aria-pressed="'+preview+'">'+
      (preview?'Voltar à gestão':'Ver como jogador')+'</button>' : '')+(manage?'<button type="button" data-new>Nova investigação</button>':'')+
      '</div></div><p role="status"></p><div class="case-boards-list">'+
      investigations.map(row => {
        const board = (manage ? drafts : destinations).find(item => item.id === row.board_id);
        const docs = data.documents.filter(doc => doc.investigation_id === row.id && (!preview || doc.published));
        const published = new Set(docs.filter(doc => row.published && doc.published).map(doc => doc.id));
        const count = data.attachments.filter(attachment => published.has(attachment.document_id)).length;
        return '<article class="case-board-card"><span class="micro-label">'+(manage?statusLabel(row.published):'INVESTIGAÇÃO')+
          '</span><h4>'+escape(row.title)+'</h4>'+(row.description?'<p>'+escape(row.description)+'</p>':'')+
          '<p class="dossier-counts">'+published.size+(published.size===1?' documento':' documentos')+' · '+count+(count===1?' evidência publicada':' evidências publicadas')+'</p>'+
          (docs.length ? '<ul class="case-document-list">'+docs.map(doc => '<li><button type="button" data-document="'+doc.id+'">'+
          escape(doc.title)+(manage?' · '+statusLabel(doc.published):'')+'</button></li>').join('')+'</ul>' : '<p>Sem documentos disponíveis.</p>')+
          '<div>'+(board?'<a href="'+linkBoard(board.id)+'">'+(manage?'Preparar quadro · ':'Abrir quadro · ')+escape(board.title)+' ↗</a>'+(manage?'<span class="linked-board-controls" data-linked-board="'+board.id+'"></span>':''):'')+
          (manage?'<details class="archive-admin"><summary>Gerenciar dossiê</summary><div class="case-archive-actions"><button type="button" data-edit="'+row.id+'">Editar investigação</button><button type="button" data-add="'+row.id+'">Novo documento</button></div></details>':'')+
          '</div></article>';
      }).join('')+'</div>';
    if (!investigations.length) root.querySelector('[role=status]').textContent = 'Nenhuma investigação disponível.';
    root.querySelector('[data-new]')?.addEventListener('click', action(() => editInvestigation()));
    root.querySelector('[data-preview]')?.addEventListener('click', () => { preview = !preview; render(); });
    root.querySelectorAll('[data-edit]').forEach(button => button.onclick = action(() => editInvestigation(data.investigations.find(row => row.id === button.dataset.edit))));
    root.querySelectorAll('[data-add]').forEach(button => button.onclick = () => editDocument(null, button.dataset.add));
    root.querySelectorAll('[data-document]').forEach(button => button.onclick = action(() => openDocument(button.dataset.document)));
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
      area('body','Conteúdo',row?.body)+position(row)+publication(row)+
      (row?'<button type="button" data-remove>Excluir documento</button>':''),
      async (fields, fd) => {
        const saved = await api.save('case_documents', row?.id, {...fields, investigation_id: fd.get('investigation_id'), body: String(fd.get('body'))});
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

  function editAttachment(document, row) {
    edit(row?'Editar evidência':'Nova evidência', title(row)+area('body','Descrição ou depoimento',row?.body)+
      (row?.object_path?'':'<label>Arquivo original (opcional)<input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,audio/mpeg,audio/ogg,audio/wav,text/plain"></label>')+
      position(row)+publication(row)+(row?'<button type="button" data-remove>Excluir evidência</button>':''),
      async (fields, fd) => {
        fields.body = String(fd.get('body'));
        const file = fd.get('file');
        if (file?.size > 26214400) throw Error('O arquivo deve ter até 25 MB.');
        const original = file?.size ? file : null;
        if (!row?.object_path && !original && !fields.body.trim() && (!row || fields.published)) {
          throw Error('Anexe um arquivo ou escreva o conteúdo da evidência.');
        }
        if (row) await api.completeAttachment(row, fields, original);
        else await api.attach(document.id, fields, original);
        await openDocument(document.id);
      }, action(() => openDocument(document.id)));
    dialog.querySelector('[data-remove]')?.addEventListener('click', action(async () => {
      if (!confirm('Excluir esta evidência e os pins que a referenciam?')) return;
      await api.remove('case_attachments', row.id);
      await openDocument(document.id);
    }));
  }

  async function openDocument(id) {
    const result = await api.document(id);
    const doc = result.document;
    const investigation = data.investigations.find(row => row.id === doc?.investigation_id);
    if (!doc || !investigation || (preview && (!doc.published || !investigation.published))) {
      show('<h3>Documento indisponível</h3><p>Este documento não está acessível à sua conta.</p>');
      return;
    }
    const manage = master && !preview;
    const attach = result.attachments.filter(row => !preview || row.published);
    const body = doc.body ? occurrenceBody(doc.body) : {overview:'',details:''};
    const available = await boards.list(false);
    const add = !master || preview
      ? (available.length
        ? '<button type="button" data-pin>Adicionar ao quadro</button>'
        : '<small class="case-no-board">Nenhum quadro disponível para esta evidência.</small>')
      : '';
    const evidenceCard = row => '<article class="case-board-card case-attachment" data-attachment="'+row.id+'">'+
      (row.object_path && evidenceImage(row.mime)?'<div class="case-file-preview" aria-busy="true"></div>':'')+
      '<span class="micro-label">'+(manage?statusLabel(row.published):'EVIDÊNCIA')+'</span><h4>'+escape(row.title)+'</h4>'+
      (row.body?'<div class="case-document-body">'+readDocument(row.body)+'</div>':'')+
      (!row.object_path&&!row.body&&manage?'<p>Aguardando arquivo original.</p>':'')+
      '<div class="case-archive-actions">'+add+
      (row.object_path?'<button type="button" data-original>Arquivo original</button>':'')+'</div>'+
      (manage?'<details class="archive-admin"><summary>Gerenciar evidência</summary><button type="button" data-edit-attachment>Editar evidência</button></details>':'')+'</article>';
    show('<header class="dossier-header"><span class="micro-label">'+escape(investigation.title)+'</span><h3>'+escape(doc.title)+'</h3>'+
      (manage?'<small>'+statusLabel(doc.published && investigation.published)+' · acesso dos agentes</small>':'')+'</header>'+
      body.overview+'<p role="status"></p>'+
      (attach.length?'<section class="dossier-evidence"><h4>Evidências e anexos</h4><div class="evidence-gallery">'+attach.map(evidenceCard).join('')+'</div></section>':'')+
      (body.details?'<section class="dossier-complement"><h4>Informações complementares</h4><div class="case-document-body">'+body.details+'</div></section>':'')+
      ((!master || preview) && available.length ? '<button type="button" data-pin-document>Adicionar documento ao quadro</button>' : '')+
      (manage?'<details class="archive-admin"><summary>Gerenciar documento</summary><div class="case-archive-actions"><button type="button" data-edit-doc>Editar documento</button><button type="button" data-add-attachment>Nova evidência</button></div></details>':''));
    const current = view;
    dialog.querySelector('[data-edit-doc]')?.addEventListener('click', () => editDocument(doc, doc.investigation_id));
    dialog.querySelector('[data-add-attachment]')?.addEventListener('click', () => editAttachment(doc));
    dialog.querySelectorAll('[data-pin]').forEach(button => button.onclick = action(async () => {
      const id = button.closest('[data-attachment]').dataset.attachment;
      button.disabled = true;
      try { await chooseBoard(investigation, 'attachment', id, doc.id); } finally { button.disabled = false; }
    }));
    dialog.querySelector('[data-pin-document]')?.addEventListener('click', action(() => chooseBoard(investigation, 'document', doc.id, doc.id)));
    for (const row of attach) {
      const card = dialog.querySelector('[data-attachment="'+row.id+'"]');
      card.querySelector('[data-edit-attachment]')?.addEventListener('click', () => editAttachment(doc,row));
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

  async function chooseBoard(investigation, kind, sourceId, documentId) {
    const available = [...await boards.list(false)];
    available.sort((a,b) => Number(b.id === investigation.board_id) - Number(a.id === investigation.board_id));
    const back = () => openDocument(documentId);
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
      '<button type="button" data-back>Voltar ao documento</button>');
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
  const target = new URLSearchParams(location.search).get('document');
  if (target && uid.test(target)) await openDocument(target);
}
