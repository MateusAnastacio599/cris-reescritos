import {build} from 'esbuild';
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:process.cwd()},outfile:'dist/vendor/supabase.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'linked'});
