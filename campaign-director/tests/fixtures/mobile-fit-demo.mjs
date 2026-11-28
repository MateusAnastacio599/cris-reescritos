// Isolated real-renderer QA. Optional reference PNG remains outside the repository.
import {mkdirSync,cpSync,copyFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const dest=resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Informe um diretório novo.');
mkdirSync(join(dest,'public'),{recursive:true});
cpSync(new URL('../../dist/',import.meta.url),join(dest,'public/dist'),{recursive:true});
cpSync(new URL('./mobile-fit/',import.meta.url),join(dest,'public'),{recursive:true});
for(const ext of ['png','webm'])copyFileSync(new URL('./cinematic-studio/alpha-probe.'+ext,import.meta.url),join(dest,'public/alpha.'+ext));
if(process.argv[3])copyFileSync(resolve(process.argv[3]),join(dest,'public/reference.png'));
mkdirSync(join(dest,'.openai'),{recursive:true});
writeFileSync(join(dest,'.openai/hosting.json'),JSON.stringify({static:{directory:'public'}}));
console.log(dest);
