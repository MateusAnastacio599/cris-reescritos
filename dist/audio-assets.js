/** Remove só as referências sonoras, sem alterar o texto ou excluir cenas/cues. */
export function removeSceneAudio(scene,assetId){
  scene.layers=scene.layers.filter(l=>l.assetId!==assetId);
  scene.triggers=scene.triggers.filter(t=>t.cue||t.assetId!==assetId);
  scene.timeline=scene.timeline.filter(t=>t.assetId!==assetId);
  for(const cue of scene.cues||[])cue.actions=cue.actions.filter(a=>a.assetId!==assetId||a.playlistId);
  if(scene.music?.assetId===assetId&&!scene.music.playlistId)scene.music={mode:'keep'};
  if(scene.musicAssetId===assetId)delete scene.musicAssetId;
}
export function removeAudioAsset(state,assetId){
  const asset=state.audioAssets.find(a=>a.id===assetId);
  if(!asset)return false;
  if(asset.builtin)throw new Error('Os sons originais da Casa São Martinho são preservados.');
  state.audioAssets=state.audioAssets.filter(a=>a.id!==assetId);
  for(const playlist of state.playlists)playlist.assetIds=playlist.assetIds.filter(id=>id!==assetId);
  for(const campaign of state.campaigns)for(const page of campaign.pages)for(const scene of page.scenes)removeSceneAudio(scene,assetId);
  for(const ambience of state.ambiences||[]){ambience.layers=ambience.layers.filter(l=>l.assetId!==assetId);ambience.pads=ambience.pads.filter(id=>id!==assetId);}
  return true;
}
