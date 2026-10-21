const decodeURIComponentSafe=value=>{try{return decodeURIComponent(value);}catch{return value;}};
export const escapeHTML = value => String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function tableCells(line){
  const value=line.trim().replace(/^\|/,'').replace(/(?<!\\)\|$/,'');const cells=[];let cell='',escaped=false,wiki=0;
  for(let i=0;i<value.length;i++){const ch=value[i];if(escaped){cell+=ch==='|'?'|':'\\'+ch;escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(value.slice(i,i+2)==='[[')wiki++;if(value.slice(i,i+2)===']]')wiki=Math.max(0,wiki-1);if(ch==='|'&&!wiki){cells.push(cell.trim());cell='';}else cell+=ch;}
  if(escaped)cell+='\\';cells.push(cell.trim());return cells.map(cell=>cell.replace(/<br\s*\/?>/gi,'\n'));
}
export function parseBlocks(markdown) {
  const result=[],lines=String(markdown??'').split(/\r?\n/);let paragraph=[];
  const flush=()=>{if(paragraph.length){result.push({type:'paragraph',text:paragraph.join('\n')});paragraph=[];}};
  for(let i=0;i<lines.length;i++){
    const raw=lines[i],text=raw.trim();if(!text){flush();continue;}
    if(text.includes('|')&&i+1<lines.length&&tableCells(lines[i+1]).every(cell=>/^:?-{3,}:?$/.test(cell))){
      flush();const headers=tableCells(text),align=tableCells(lines[++i]).map(v=>v.startsWith(':')&&v.endsWith(':')?'center':v.endsWith(':')?'right':'left'),rows=[];
      while(i+1<lines.length&&lines[i+1].trim()&&lines[i+1].includes('|')){const row=tableCells(lines[++i]);rows.push(headers.map((_,n)=>row[n]||''));}
      result.push({type:'table',text:'',headers,rows,align});continue;
    }
    let type='paragraph',value=text,extra={},match;
    if(text==='<!--cris:empty-->'){flush();result.push({type:'paragraph',text:''});continue;}
    if((match=text.match(/^\[\[clue(-hide)?:([^:|\]]*):([^|\]]*)\|(.*)\]\]$/))){type='clue';extra={campaignId:match[2],itemId:decodeURIComponentSafe(match[3]),action:match[1]?'hide':'reveal'};value=match[4];}
    else if((match=text.match(/^\[\[cue:([^|\]]*)\|(.*)\]\]$/))){type='cue';extra={triggerId:match[1]};value=match[2];}
    else if((match=text.match(/^\[\[note:(.*)\]\]$/))){type='note';value=match[1];}
    else if(text==='---'||text==='***'){type='divider';value='';}
    else if((match=text.match(/^(#{1,3}) (.*)$/))){type='h'+match[1].length;value=match[2];}
    else if(text.startsWith('> ')){type='quote';value=text.slice(2);}
    else if((match=text.match(/^- \[([ xX])\] ?(.*)$/))){type='todo';value=match[2];extra={checked:match[1].toLowerCase()==='x'};}
    else if(/^[-*] /.test(text)){type='list';value=text.slice(2);}
    else if((match=text.match(/^(\d+)\. (.*)$/))){type='numbered';value=match[2];extra={number:Number(match[1])};}
    if(type==='paragraph')paragraph.push(value);else{flush();result.push({type,text:value.replace(/<br\s*\/?>/gi,'\n'),...extra});}
  }
  flush();return result.length?result:[{type:'paragraph',text:''}];
}
const lineEscape=value=>String(value??'').replace(/\n/g,'<br>');
const tableEscape=value=>lineEscape(value).replace(/\|/g,'\\|');
export function blocksToMarkdown(blocks){return blocks.map(b=>{
  const prefix={h1:'# ',h2:'## ',h3:'### ',quote:'> ',list:'- '};
  if(b.type==='table'){const headers=b.headers||['Coluna 1','Coluna 2'];return ['| '+headers.map(tableEscape).join(' | ')+' |','| '+headers.map((_,i)=>({left:'---',right:'---:',center:':---:'})[b.align?.[i]]||'---').join(' | ')+' |',...(b.rows||[]).map(row=>'| '+headers.map((_,i)=>tableEscape(row[i])).join(' | ')+' |')].join('\n');}
  if(b.type==='clue')return `[[clue${b.action==='hide'?'-hide':''}:${b.campaignId||''}:${encodeURIComponent(b.itemId||'')}|${lineEscape(b.text).replace(/\|/g,'·')}]]`;
  if(b.type==='cue')return `[[cue:${b.triggerId||''}|${lineEscape(b.text)}]]`;
  if(b.type==='note')return `[[note:${lineEscape(b.text)}]]`;
  if(b.type==='divider')return '---';
  if(b.type==='todo')return `- [${b.checked?'x':' '}] ${lineEscape(b.text)}`;
  if(b.type==='numbered')return `${b.number||1}. ${lineEscape(b.text)}`;
  if(!b.text)return '<!--cris:empty-->';
  return (prefix[b.type]||'')+(b.type==='paragraph'?b.text:lineEscape(b.text));
}).join('\n\n');}
export function inlineHTML(text,pages=[],editing=false) {
  const tokens=[];const token=html=>{tokens.push(html);return `\u0000${tokens.length-1}\u0000`;};
  let source=String(text??'').replace(/`([^`]+)`/g,(_,code)=>token('<code>'+escapeHTML(code)+'</code>')).replace(/\[\[([^\]\n]+)\]\]/g,(_,value)=>{
    const [target,label]=value.split('|');if(target.startsWith('cue:')||target.startsWith('note:'))return _;
    const lookup=target.replace(/^page:/,''),page=pages.find(p=>p.id===lookup||p.title.toLocaleLowerCase()===lookup.toLocaleLowerCase());
    return token(editing?`<span class="wiki-token" contenteditable="false" data-markdown="${escapeHTML(_)}">↗ ${escapeHTML(label||page?.title||lookup)}</span>`:`<button class="wiki-link ${page?'':'unresolved'}" data-page-link="${escapeHTML(page?.id||'')}" data-link-title="${escapeHTML(lookup)}">↗ ${escapeHTML(label||page?.title||lookup)}</button>`);
  });
  source=escapeHTML(source).replace(/\*\*\*([\s\S]+?)\*\*\*/g,'<strong><em>$1</em></strong>').replace(/\*\*([\s\S]+?)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/~~(.+?)~~/g,'<s>$1</s>').replace(/\n/g,'<br>');
  return source.replace(/\u0000(\d+)\u0000/g,(_,index)=>tokens[Number(index)]||'');
}
export function editableToMarkdown(element,{trim=true}={}) {
  function walk(node){
    if(node.nodeType===3)return node.textContent.replace(/\u00a0/g,' ');if(node.nodeType!==1)return '';
    if(node.dataset?.markdown)return node.dataset.markdown;
    const text=[...node.childNodes].map(walk).join('');
    if(['STRONG','B'].includes(node.tagName))return text?`**${text}**`:'';
    if(['EM','I'].includes(node.tagName))return text?`*${text}*`:'';
    if(['S','STRIKE','DEL'].includes(node.tagName))return text?`~~${text}~~`:'';
    if(node.tagName==='CODE')return text?'`'+text+'`':'';
    if(node.tagName==='BR')return '\n';
    if(['DIV','P'].includes(node.tagName))return '\n'+text;
    return text;
  }
  const text=[...element.childNodes].map(walk).join('').replace(/\n{3,}/g,'\n\n');return trim?text.trim():text;
}
export function renderTable(block,pages=[],editing=false,index=0){
  const row=(cells,r,header=false)=>'<tr>'+cells.map((cell,c)=>{const tag=header?'th':'td';return `<${tag} style="text-align:${['left','right','center'].includes(block.align?.[c])?block.align[c]:'left'}">${editing?`<div class="table-cell" data-block="${index}" data-cell-row="${r}" data-cell-col="${c}" contenteditable="true" role="textbox" aria-label="${header?'Cabeçalho':'Linha '+r}, coluna ${c+1}">${inlineHTML(cell,pages,true)}</div>`:inlineHTML(cell,pages)}</${tag}>`;}).join('')+'</tr>';
  return '<div class="document-table-scroll"><table class="document-table"><thead>'+row(block.headers,0,true)+'</thead><tbody>'+block.rows.map((cells,i)=>row(cells,i+1)).join('')+'</tbody></table></div>';
}
export function renderReadBlocks(blocks,pages=[]) {
  let html='',listType=null;
  blocks.forEach((b,i)=>{
    const list=['list','numbered'].includes(b.type)?b.type:null;if(listType&&listType!==list){html+=listType==='numbered'?'</ol>':'</ul>';listType=null;}
    const text=inlineHTML(b.text,pages);
    if(list){if(!listType){html+=list==='numbered'?`<ol class="document-list" start="${b.number||1}">`:'<ul class="document-list">';listType=list;}html+=`<li>${text}</li>`;return;}
    if(b.type==='table'){html+=renderTable(b,pages);return;}
    if(b.type==='clue'){html+=`<div class="inline-board-clue"><div><span aria-hidden="true">◇</span><span><small>PISTA DO QUADRO</small>${text||'Escolher pista'}</span></div><button type="button" class="btn" data-inline-clue="${escapeHTML(b.itemId)}" data-board-campaign="${escapeHTML(b.campaignId)}" data-board-action="${b.action==='hide'?'hide':'reveal'}">${b.action==='hide'?'Ocultar':'Revelar pista'}</button></div>`;return;}
    if(b.type==='cue'){html+=`<div class="inline-cue"><div><span class="cue-glyph">♫</span><span>${text}</span></div><button class="btn cue-fire" data-inline-cue="${escapeHTML(b.triggerId)}">▶ <span>Disparar</span></button></div>`;return;}
    if(b.type==='note'){html+=`<aside class="master-note"><span class="note-label">✦ NOTA DO MESTRE</span><p>${text}</p></aside>`;return;}
    if(b.type==='divider'){html+='<hr>';return;}
    if(b.type==='todo'){html+=`<label class="read-todo"><input type="checkbox" data-todo="${i}" ${b.checked?'checked':''}> <span>${text}</span></label>`;return;}
    const tag={paragraph:'p',quote:'blockquote',h1:'h1',h2:'h2',h3:'h3'}[b.type]||'p';html+=`<${tag}>${text||'<br>'}</${tag}>`;
  });if(listType)html+=listType==='numbered'?'</ol>':'</ul>';return html;
}
export function parseYouTube(value) {
  let url;try{url=new URL(value);}catch{throw new Error('Cole um link completo do YouTube.');}
  if(!['https:','http:'].includes(url.protocol))throw new Error('Link do YouTube inválido.');
  const host=url.hostname.toLowerCase().replace(/^www\./,'').replace(/^m\./,'');
  if(!['youtube.com','youtu.be','music.youtube.com','youtube-nocookie.com'].includes(host))throw new Error('Use um link de youtube.com ou youtu.be.');
  const videoId=host==='youtu.be'?url.pathname.slice(1).split('/')[0]:url.searchParams.get('v')||url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)?.[1];
  const playlistId=url.searchParams.get('list');
  if(videoId&&!/^[\w-]{11}$/.test(videoId))throw new Error('O identificador do vídeo está incompleto.');
  if(playlistId&&!/^[\w-]{10,}$/.test(playlistId))throw new Error('A playlist do YouTube é inválida.');
  if(!videoId&&!playlistId)throw new Error('O link precisa conter um vídeo ou uma playlist.');
  const t=url.searchParams.get('t')||url.searchParams.get('start')||'0';let start=0;
  if(/^\d+$/.test(t))start=Number(t);else{const m=t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);if(m)start=Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0);}
  return {videoId:videoId||null,playlistId:playlistId||null,start};
}
