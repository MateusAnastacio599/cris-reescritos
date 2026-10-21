import {parseSpotify} from './spotify-auth.js';
/** O link de uma playlist continua útil quando o catálogo não é exposto à integração. */
export async function lookupSpotifyItem(player,value){
  const parsed=parseSpotify(value);
  try{return {parsed,item:await player.metadata(parsed.uri),limited:false};}
  catch(error){if(parsed.type==='playlist'&&[403,404].includes(error.status))return {parsed,item:null,limited:true};throw error;}
}
export function playlistEmbedURL(value){const parsed=parseSpotify(value);if(parsed.type!=='playlist')throw Error('Escolha uma playlist Spotify.');return 'https://open.spotify.com/embed/playlist/'+parsed.id+'?utm_source=generator&theme=0';}
export function playlistReference(value,name){const parsed=parseSpotify(value),title=String(name||'').trim();if(parsed.type!=='playlist'||!title||title.length>120)throw Error('Informe um nome de até 120 caracteres para a playlist.');return {uri:parsed.uri,name:title,metadataUnavailable:true};}
export function playlistReadError(error){return [403,404].includes(error?.status)?'O Spotify não liberou a lista de faixas desta playlist para o CRIS. Isso acontece com playlists editoriais e outras listas com acesso limitado. Você pode consultar o painel oficial abaixo e tentar reproduzir a playlist pela barra do CRIS.':error?.message||'Não foi possível consultar a playlist agora.';}
