/** Remove só as referências sonoras, sem alterar o texto ou excluir cenas/cues. */
export function removeSceneAudio(scene,assetId,src=null){
  const matches=item=>item.assetId===assetId||!item.assetId&&Boolean(src)&&item.src===src;
  scene.layers=scene.layers.filter(l=>!matches(l));
  scene.triggers=scene.triggers.filter(t=>t.cue||!matches(t));
  scene.timeline=scene.timeline.filter(t=>!matches(t));
  for(const cue of scene.cues||[])cue.actions=cue.actions.filter(a=>a.assetId!==assetId||a.playlistId);
  if(scene.music?.assetId===assetId&&!scene.music.playlistId)scene.music={mode:'keep'};
  if(scene.musicAssetId===assetId)delete scene.musicAssetId;
}
export function removeAudioAsset(state,assetId){
  const asset=state.audioAssets.find(a=>a.id===assetId);
  if(!asset)return false;
  state.audioAssets=state.audioAssets.filter(a=>a.id!==assetId);
  for(const playlist of state.playlists)playlist.assetIds=playlist.assetIds.filter(id=>id!==assetId);
  for(const campaign of state.campaigns)for(const page of campaign.pages)for(const scene of page.scenes)removeSceneAudio(scene,assetId,asset.src);
  for(const ambience of state.ambiences||[]){ambience.layers=ambience.layers.filter(l=>l.assetId!==assetId);ambience.pads=ambience.pads.filter(id=>id!==assetId);if(ambience.music?.assetId===assetId)delete ambience.music;}
  return true;
}
export function removePlaylist(state,playlistId){
  state.playlists=state.playlists.filter(p=>p.id!==playlistId);
  for(const ambience of state.ambiences||[]){ambience.layers=ambience.layers.filter(l=>l.playlistId!==playlistId);if(ambience.music?.playlistId===playlistId)delete ambience.music;}
  for(const campaign of state.campaigns)for(const page of campaign.pages)for(const scene of page.scenes){if(scene.music?.playlistId===playlistId)scene.music={mode:'keep'};for(const cue of scene.cues||[])cue.actions=cue.actions.filter(a=>a.playlistId!==playlistId);}
}
