import {field} from './ui.js';

export function fadeFields(value={},hint='Vazio usa o padrão do áudio. 0 desativa o fade.'){
  value??={};
  const attrs='type="number" min="0" max="30" step="0.1" inputmode="decimal" placeholder="Automático"';
  return '<div class="form-grid">'+field('Fade in · entrada (s)','fadeIn',value.fadeIn??'',attrs)+field('Fade out · saída (s)','fadeOut',value.fadeOut??'',attrs)+'</div><p class="form-hint">'+hint+'</p>';
}
export function readFades(form){
  const read=key=>{const value=form.get(key);return value===null||value===''?undefined:Number(value);};
  return {fadeIn:read('fadeIn'),fadeOut:read('fadeOut')};
}
