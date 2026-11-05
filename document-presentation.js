const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function presentDocument(blocks,render){
 const sections=[{title:'Dados do registro',blocks:[]}];
 for(const block of blocks){if(['h2','h3'].includes(block.type))sections.push({title:block.text,blocks:[]});else sections.at(-1).blocks.push(block);}
 const facts=sections.find(s=>/identificação/i.test(s.title))||sections[0];
 const fields=[],remaining=[];
 for(const block of facts.blocks){
  const lines=block.type==='paragraph'?block.text.split(/\n|\s*\|\s*/).filter(s=>s.trim()):[];
  const matches=lines.map(line=>line.trim().match(/^\*\*([^*]+?):?\*\*\s*:?\s*(.+)$/));
  if(matches.length&&matches.every(Boolean))for(const [,key,value] of matches)fields.push([key.replace(/:$/,''),value]);else remaining.push(block);
 }
 const summary=sections.find(s=>/descrição|registro da ocorrência|resumo/i.test(s.title));
 const overview=(fields.length?'<section class="occurrence-overview"><dl class="occurrence-facts">'+fields.map(([key,value])=>'<div><dt>'+esc(key)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl></section>':'')+(summary?'<section class="dossier-summary"><h4>'+esc(summary.title)+'</h4><div class="case-document-body">'+render(summary.blocks)+'</div></section>':'');
 const details=sections.filter(s=>s!==summary).map(s=>({...s,blocks:s===facts?remaining:s.blocks})).filter(s=>s.blocks.some(b=>b.type!=='divider')).map(s=>'<details class="occurrence-section"><summary>'+esc(s.title)+'</summary><div class="case-document-body">'+render(s.blocks)+'</div></details>').join('');
 return {overview,details};
}
