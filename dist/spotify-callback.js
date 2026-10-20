import {SpotifyAuth} from './spotify-auth.js';
const params=new URLSearchParams(location.search);
// Remover o código da barra/histórico antes de qualquer outra navegação.
history.replaceState(null,'',location.pathname);
try{
  await new SpotifyAuth().complete(params);
  location.replace('./?spotify=connected');
}catch(error){document.querySelector('h1').textContent='Spotify ainda não conectado';document.querySelector('#spotifyCallbackStatus').textContent=error.message;}
