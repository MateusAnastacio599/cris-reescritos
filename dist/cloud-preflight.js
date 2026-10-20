import {validateState,getMedia} from './storage.js';

// Read-only inventory. Never writes to local storage or Supabase.
export async function inspectLocalWorkspace(state,{readMedia=getMedia,now=()=>new Date().toISOString()}={}){
  const snapshot=validateState(structuredClone(state));
  const report={checkedAt:now(),campaigns:snapshot.campaigns.length,pages:0,scenes:0,cues:0,playlists:snapshot.playlists.length,ambiences:snapshot.ambiences.length,youtube:0,files:[],bytes:0,missing:[],ready:false};
  for(const campaign of snapshot.campaigns)for(const page of campaign.pages){report.pages++;for(const scene of page.scenes){report.scenes++;report.cues+=(scene.cues||[]).length;}}
  for(const asset of snapshot.audioAssets){
    if(asset.provider==='youtube'){report.youtube++;continue;}
    if(asset.provider!=='upload')continue;
    const blob=await readMedia(asset.id);
    if(!blob||typeof blob.size!=='number'||blob.size===0){report.missing.push({id:asset.id,name:asset.name});continue;}
    const file={id:asset.id,name:asset.name,bytes:blob.size,type:blob.type||'application/octet-stream'};
    report.files.push(file);report.bytes+=file.bytes;
  }
  report.ready=report.missing.length===0;return report;
}
export function formatBytes(value){if(value<1024)return `${value} B`;const units=['KB','MB','GB'];let n=value/1024,i=0;while(n>=1024&&i<units.length-1){n/=1024;i++;}return `${n.toLocaleString('pt-BR',{maximumFractionDigits:1})} ${units[i]}`;}
