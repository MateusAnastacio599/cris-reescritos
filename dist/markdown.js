export const escapeHTML = value => String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export function parseBlocks(markdown) {
  const result=[];
  for(const raw of markdown.split(/\r?\n/)) {
    if(!raw.trim())continue;
    let type='paragraph',text=raw.trim(),extra={};let match;
    if((match=text.match(/^\[\[cue:([^|\]]+)\|(.+)\]\]$/))){type='cue';extra={triggerId:match[1]};text=match[2];}
    else if((match=text.match(/^\[\[note:([\s\S]+)\]\]$/))){type='note';text=match[1];}
    else if(text==='---'){type='divider';text='';}
    else if(text.startsWith('### ')){type='h3';text=text.slice(4);}
    else if(text.startsWith('## ')){type='h2';text=text.slice(3);}
    else if(text.startsWith('# ')){type='h1';text=text.slice(2);}
    else if(text.startsWith('> ')){type='quote';text=text.slice(2);}
    else if((match=text.match(/^- \[([ xX])\] (.*)$/))){type='todo';text=match[2];extra={checked:match[1].toLowerCase()==='x'};}
    else if(/^[-*] /.test(text)){type='list';text=text.slice(2);}
    result.push({type,text,...extra});
  }
  return result.length?result:[{type:'paragraph',text:''}];
}
export function blocksToMarkdown(blocks){return blocks.map(b=>{
  const prefix={h1:'# ',h2:'## ',h3:'### ',quote:'> ',list:'- '};
  if(b.type==='cue')return `[[cue:${b.triggerId||''}|${b.text}]]`;
  if(b.type==='note')return `[[note:${b.text}]]`;
  if(b.type==='divider')return '---';
  if(b.type==='todo')return `- [${b.checked?'x':' '}] ${b.text}`;
  return (prefix[b.type]||'')+b.text;
}).join('\n\n');}
export function inlineHTML(text,pages=[],editing=false) {
  const tokens=[];
  let source=String(text).replace(/\[\[([^\]\n]+)\]\]/g,(_,value)=>{
    const [target,label]=value.split('|');
    if(target.startsWith('cue:')||target.startsWith('note:'))return _;
    const lookup=target.replace(/^page:/,'');
    const page=pages.find(p=>p.id===lookup||p.title.toLocaleLowerCase()===lookup.toLocaleLowerCase());
    const html=editing?`<span class="wiki-token" contenteditable="false" data-markdown="${escapeHTML(_)}">↗ ${escapeHTML(label||page?.title||lookup)}</span>`:`<button class="wiki-link ${page?'':'unresolved'}" data-page-link="${escapeHTML(page?.id||'')}" data-link-title="${escapeHTML(lookup)}">↗ ${escapeHTML(label||page?.title||lookup)}</button>`;
    tokens.push(html);return `\u0000${tokens.length-1}\u0000`;
  });
  source=escapeHTML(source).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/`([^`]+)`/g,'<code>$1</code>');
  return source.replace(/\u0000(\d+)\u0000/g,(_,index)=>tokens[Number(index)]);
}
export function editableToMarkdown(element) {
  function walk(node) {
    if(node.nodeType===Node.TEXT_NODE)return node.textContent.replace(/\u00a0/g,' ');
    if(node.nodeType!==Node.ELEMENT_NODE)return '';
    if(node.dataset.markdown)return node.dataset.markdown;
    const text=[...node.childNodes].map(walk).join('');
    if(['STRONG','B'].includes(node.tagName))return text?`**${text}**`:'';
    if(['EM','I'].includes(node.tagName))return text?`*${text}*`:'';
    if(node.tagName==='BR')return '\n';
    if(node.tagName==='DIV')return '\n'+text;
    return text;
  }
  return [...element.childNodes].map(walk).join('').replace(/\n+/g,' ').trim();
}
export function renderReadBlocks(blocks,pages) {return blocks.map((b,i)=>{
  const text=inlineHTML(b.text,pages);
  if(b.type==='cue')return `<div class="inline-cue"><div><span class="cue-glyph">♫</span><span>${text}</span></div><button class="btn cue-fire" data-inline-cue="${escapeHTML(b.triggerId)}">▶ <span>Disparar</span></button></div>`;
  if(b.type==='note')return `<aside class="master-note"><span class="note-label">✦ NOTA DO MESTRE</span><p>${text}</p></aside>`;
  if(b.type==='divider')return '<hr>';
  if(b.type==='todo')return `<label class="read-todo"><input type="checkbox" data-todo="${i}" ${b.checked?'checked':''}> <span>${text}</span></label>`;
  if(b.type==='list')return `<div class="bullet-block"><span>•</span><p>${text}</p></div>`;
  const tag={paragraph:'p',quote:'blockquote',h1:'h1',h2:'h2',h3:'h3'}[b.type]||'p';
  return `<${tag}>${text||'<span class="empty-line">Comece a escrever no modo de edição.</span>'}</${tag}>`;
}).join('');}
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
