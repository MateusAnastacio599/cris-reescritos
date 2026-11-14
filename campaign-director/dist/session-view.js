// Only presentation state lives here. Campaigns, audio and editor data stay intact.
import {icon} from './icons.js';
const openSections=new Map();
export function mountSceneSections(root,{session,sceneId}){
 for(const section of root.querySelectorAll('[data-scene-section]')){
  section.classList.toggle('session-empty',Number(section.dataset.count)===0);
  const kind=section.dataset.sceneSection;if(!['layers','timeline'].includes(kind))continue;
  const heading=section.querySelector('.director-section-head h3'),body=document.createElement('div'),button=document.createElement('button');
  const id='scene-section-'+kind;
  button.type='button';button.className='scene-section-toggle';button.setAttribute('aria-controls',id);
  while(heading.firstChild)button.append(heading.firstChild);button.insertAdjacentHTML('beforeend',icon('down'));heading.append(button);
  body.id=id;body.className='scene-section-body';while(section.children.length>1)body.append(section.children[1]);section.append(body);
  button.onclick=()=>{
   const session=document.body.classList.contains('session-mode');
   openSections.set(sectionKey(sceneId,kind,session),body.hidden);
   updateSceneSections(root,{session,sceneId});
  };
 }
 updateSceneSections(root,{session,sceneId});
}
function sectionKey(sceneId,kind,session){return [sceneId,kind,session?'session':'prepare'].join(':');}
export function updateSceneSections(root,{session,sceneId}){
 for(const section of root?.querySelectorAll('.scene-section-toggle')??[]){
  const body=section.closest('[data-scene-section]');
  const open=openSections.get(sectionKey(sceneId,body.dataset.sceneSection,session))??!session;
  body.querySelector('.scene-section-body').hidden=!open;
  section.setAttribute('aria-expanded',String(open));
 }
}
export function setupSessionTools(){
 const button=document.querySelector('#toggleSessionTools'),tools=document.querySelector('#sidebarTools');
 if(!button||!tools)return;
 button.innerHTML=icon('sliders')+'<span>Ferramentas</span>'+icon('down');
 button.onclick=()=>{const open=tools.classList.toggle('expanded');button.setAttribute('aria-expanded',String(open));};
}
