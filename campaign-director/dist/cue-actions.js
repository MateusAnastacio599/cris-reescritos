/** Uma troca já encerra a trilha anterior. Unifica stop/play simultâneos sem alterar a cue salva. */
export function planCueActions(actions){
  const time=action=>Number(action.delay)||0,plays=new Set(actions.filter(a=>a.type==='music-play').map(time));
  return actions.filter(a=>a.type!=='music-stop'||!plays.has(time(a))).map(action=>{
    if(action.type!=='music-play'||action.fadeOut!==undefined)return action;
    const stop=actions.find(a=>a.type==='music-stop'&&time(a)===time(action));
    return stop?{...action,fadeOut:stop.duration??2}:action;
  });
}
