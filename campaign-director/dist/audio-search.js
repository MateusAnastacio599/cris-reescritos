export const normalizeSearch=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
export function filterAudioAssets(assets,query='',kind='all'){
  const words=normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  return assets.filter(a=>(kind==='all'||kind==='youtube'&&a.provider==='youtube'||kind==='spotify'&&a.provider==='spotify'||kind==='files'&&!['youtube','spotify'].includes(a.provider)||a.kind===kind)&&words.every(word=>normalizeSearch([a.name,a.filename,a.tags,a.kind,a.provider,a.provider==='youtube'?'youtube':a.provider==='spotify'?'spotify':'arquivo enviado local',({music:'música',ambience:'ambiência ambiente',sfx:'efeito som'})[a.kind]].join(' ')).includes(word)));
}
