export const SCRIPT_FONT_MIN=85, SCRIPT_FONT_MAX=135, SCRIPT_FONT_STEP=5;
export function scriptDisplay(ui){
  const size=Number.isFinite(ui?.scriptFontSize)?ui.scriptFontSize:100;
  return {
    scriptWidth:ui?.scriptWidth==='comfortable'?'comfortable':'wide',
    scriptFontSize:Math.max(SCRIPT_FONT_MIN,Math.min(SCRIPT_FONT_MAX,Math.round(size/SCRIPT_FONT_STEP)*SCRIPT_FONT_STEP)),
  };
}

export const scriptDisplayHTML=`<details class="script-display">
  <summary class="notes-layout-toggle">Exibição do roteiro</summary>
  <div class="script-display-options">
    <label>Largura <select data-script-width aria-label="Largura do roteiro">
      <option value="wide">Largura ampla</option><option value="comfortable">Largura confortável</option>
    </select></label>
    <div class="script-font-controls" role="group" aria-label="Tamanho da fonte">
      <button type="button" data-script-font="-5" aria-label="Diminuir fonte do roteiro">A−</button>
      <output data-script-font-value aria-label="Tamanho da fonte do roteiro"></output>
      <button type="button" data-script-font="5" aria-label="Aumentar fonte do roteiro">A+</button>
      <button type="button" data-script-font="reset" aria-label="Restaurar fonte padrão">Restaurar</button>
    </div>
  </div>
</details>`;

export function mountScriptDisplay(card,ui,onChange){
  const details=card.querySelector('.script-display');
  const width=details.querySelector('[data-script-width]');
  const value=details.querySelector('[data-script-font-value]');
  const smaller=details.querySelector('[data-script-font="-5"]');
  const larger=details.querySelector('[data-script-font="5"]');
  const render=({scriptWidth,scriptFontSize})=>{
    card.dataset.scriptWidth=width.value=scriptWidth;
    card.style.setProperty('--script-scale',scriptFontSize/100);
    value.value=scriptFontSize+'%';
    // aria-disabled keeps keyboard focus on the button at either boundary.
    smaller.setAttribute('aria-disabled',scriptFontSize===SCRIPT_FONT_MIN);
    larger.setAttribute('aria-disabled',scriptFontSize===SCRIPT_FONT_MAX);
  };
  let current=scriptDisplay(ui);
  const update=patch=>{
    const next=scriptDisplay({...current,...patch});
    if(next.scriptWidth===current.scriptWidth&&next.scriptFontSize===current.scriptFontSize)return;
    current=next;
    onChange(next,()=>render(next));
  };
  render(current);
  width.onchange=()=>update({scriptWidth:width.value});
  details.onclick=event=>{
    const step=event.target.closest('[data-script-font]')?.dataset.scriptFont;
    if(step)update({scriptFontSize:step==='reset'?100:current.scriptFontSize+Number(step)});
  };
  details.onkeydown=event=>{
    if(event.key==='Escape'&&details.open){
      event.stopPropagation();
      details.open=false;
      details.querySelector('summary').focus();
    }
  };
}
