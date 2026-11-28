# CLOUD-RELIABILITY-01 — revisão de implementação

Base: main `88f2db0` (DIRECTOR-CINEMATIC-02 integrado). Não houve publicação, merge, aplicação de SQL nem gravação em campanhas reais.

## Inventário e lacuna confirmada

| Dado | Persistência existente | Tratamento nesta mudança |
| --- | --- | --- |
| Campanhas, páginas, cenas, texto, cues, triggers, timelines, configurações de áudio | localStorage + `director_workspaces.payload` no PostgreSQL | Preservados; mesma revisão otimista |
| Definições Cinematic, IDs, camadas, câmera, fallback, luz e atmosfera | Documento da campanha | Preservados, inclusive alternates/camadas ocultas do mestre |
| Imagens e WebM Cinematic | IndexedDB `cris-director-cinematic-media`, store `images` | Cache/biblioteca local preservado + objetos privados verificados |
| Mídia remota de apresentação | Store `remote-cache`, temporário | Inalterada; não recebe a biblioteca privada por este fluxo |
| Áudios enviados | IndexedDB + `cris-audio`, manifesto da revisão | Fluxo existente preservado; incluído na preparação e no backup completo |
| Spotify/YouTube e mídias externas | Referências e autorização externa | Não viram arquivos offline; Spotify exige autorização neste navegador |
| Quadro, documentos, evidências e anexos | Snapshots/publicações/anexos e buckets próprios do CRIS | Sem migração ou mudança de transporte |
| Preferências, navegação, viewport, sessão OAuth, vínculo local da mesa | Armazenamento local por dispositivo | Permanecem locais; não distribuir tokens |

`cloud-workspace.js` publicava a revisão somente após confirmar áudios, mas ignorava todas as referências retornadas por `cinematicReferences()`. Assim, a indicação anterior de disponibilidade em outros computadores era incorreta para Cinematics.

A inspeção somente de leitura do projeto Supabase conectado encontrou `cris-images` e `cris-audio` privados, RLS do workspace limitada ao proprietário, catálogo `media_assets` restrito ao mestre e políticas de imagens publicadas para jogadores. Nenhum conteúdo de campanha foi lido para esta auditoria. A política proposta precisa ser validada no ambiente de homologação; a inspeção não substitui testes reais com JWTs de contas diferentes.

## Estrutura escolhida e ordem de confirmação

Reutiliza `director_workspaces.media.cinematics` como manifesto de metadados PostgreSQL da mesma revisão. Não cria uma segunda biblioteca em `media_assets`: esse catálogo possui categorias de imagem/áudio/documento e outro ciclo de vida, enquanto a relação indivisível necessária é entre a revisão completa e seus hashes Cinematic, inclusive WebM. Nenhum binário é armazenado em JSONB.

Cada entrada contém bucket, caminho, SHA-256, tipo, bytes e dimensões; WebM inclui metadados validados do parser existente (duração/fps/alpha). Caminho: `cris-images/<campaign UUID>/director-private/<owner UUID>/<image|video>-<sha256>`.

1. Primeiro envio cria backup completo, contendo documento, áudios e imagens/WebM, pelo exportador existente. O Blob é gravado e relido no IndexedDB de mídia; SHA-256 precisa conferir antes de enviar qualquer arquivo. Falha de quota/backup interrompe o envio.
2. Todas as referências locais e composições são verificadas. Arquivo ausente bloqueia a revisão.
3. Reutiliza hashes existentes; novo envio usa `upsert:false`. O download de confirmação valida tamanho, tipo e hash antes de registrar o arquivo no manifesto.
4. Em salvamentos posteriores, objetos já confirmados são consultados por `info` (tamanho/tipo); sem suporte a `info`, usa download verificado. Bytes imutáveis com o mesmo hash não são reenviados. A verificação completa acontece de novo no primeiro download em cada dispositivo.
5. Somente então chama o RPC otimista existente `save_director_workspace`. Conflito não sobrescreve a revisão. Uploads confirmados antes de um conflito podem ficar órfãos e ser reutilizados numa nova tentativa; não há coleta destrutiva automática.
6. No outro computador, baixa e valida todo o conjunto antes de escrever os arquivos faltantes e retornar o documento. Arquivos locais válidos são reutilizados; arquivo local divergente gera erro sem ser sobrescrito. Falha não aplica documento incompleto.

O escopo é a sessão/workspace sincronizado existente, incluindo suas campanhas, e não um novo seletor de sessões. Isso evita confirmar um documento que ainda tenha referências ausentes fora da página aberta.

## Backup e recuperação

Os originais não são removidos. O backup completo verificado pode ser baixado em **Minha conta → Recuperação e opções avançadas → Baixar backup anterior à migração** e restaurado pelo importador existente. O snapshot anterior do documento e rascunhos por conta/revisão continuam preservados pelos mecanismos existentes.

O checkpoint é criado uma vez por instância de sincronização com Cinematics, antes do primeiro envio; uma nova abertura pode criar outro. O apontador da interface recupera o mais recente por conta. Não há expurgo automático dos backups ou da biblioteca original. Um backup completo usa espaço adicional (incluindo expansão Base64); se não couber, a migração falha com os originais intactos. Copiar o backup para outro local continua recomendado antes da homologação, mas não é necessário para a troca normal de computador após sincronizar.

## Uploads grandes, progresso e falhas

Até 6 MiB usa o upload padrão. Acima disso usa TUS (`/storage/v1/upload/resumable`), chunks de 6 MiB. Guarda somente URL de retomada por projeto/caminho, nunca credenciais. Uma nova tentativa faz HEAD e retoma no offset confirmado; cursor expirado 404/410 cria outra sessão. Location de outra origem/caminho é recusado. Cada requisição tem timeout. Não há retry cego em loop; o fluxo de reconexão existente ou “Tentar sincronizar agora” inicia nova tentativa controlada.

Progresso mostra bytes efetivamente confirmados por chunk TUS ou por arquivo verificado. Upload padrão não anuncia percentuais inventados durante a requisição. Download mostra arquivos sendo preparados; conclusão somente após hash. Não foi implementada retomada parcial de download: repete o arquivo interrompido e reutiliza os já íntegros.

Referências técnicas consultadas em 28/11/2026:
- https://supabase.com/docs/guides/storage/uploads/resumable-uploads
- https://supabase.com/docs/guides/storage/uploads/standard-uploads
- https://supabase.com/docs/reference/javascript/storage-from-info
- https://supabase.com/changelog.md

O protocolo TUS implementado ainda requer homologação contra o serviço real. Não foi usado service-role nem adicionada dependência/CDN ao navegador.

## Segurança e migração SQL revisável

`schema/cloud-cinematic-private.sql` adiciona duas políticas RESTRICTIVE ao bucket existente:
- Prefixo `director-private`: somente proprietário do workspace correspondente pode acessar, mesmo se uma referência for incluída em publicação do quadro por outra política permissiva.
- UPDATE proibido nesse prefixo: novo conteúdo exige novo hash/caminho.

Não torna bucket público, não concede acesso a jogadores, não muda autenticação, não remove políticas existentes ou objetos. As políticas permissivas existentes de mestre continuam necessárias; a nova política somente restringe. **Aplicar primeiro em um projeto Supabase isolado para homologação e revisar os resultados antes de qualquer publicação do cliente.** O SQL não foi executado neste trabalho. Sem essa homologação, não considerar liberada a proteção nova de acesso cruzado. Um administrador/service-role ainda pode modificar objetos; downloads são sempre validados no cliente.

## Migração das Cinematics antigas

1. No PC que contém os arquivos originais, manter o IndexedDB e entrar na conta do mestre na versão de homologação, apontada para uma cópia isolada do backend.
2. Se surgir conflito, escolher explicitamente a versão correta; as duas versões ficam preservadas. Não escolher uma nuvem incompleta sobre a preparação original.
3. O carregamento reconhece IDs antigos, verifica os arquivos locais, cria o checkpoint e envia os hashes ausentes antes de confirmar o documento.
4. Esperar **Salvo na nuvem · arquivos confirmados**. Se houver arquivo ausente, corrigir no PC de origem; não há fabricação de mídia perdida.
5. O notebook vazio só deve abrir essa revisão depois do envio completo pelo PC de origem. Se uma revisão antiga tiver referências sem arquivos na nuvem e sem cache local, apresenta falha e preserva seu documento local.

## Preparar o notebook

Entrar na mesma conta → aguardar sincronização → **Minha conta → Preparar sessão neste computador**. Confere áudios e Cinematics; baixa somente arquivos ausentes e valida tudo. Conclusão: **Pronto neste dispositivo · arquivos verificados**. Falha não recebe esse estado. Se o servidor mudou de revisão durante a preparação, pede sincronização antes de continuar. Troca de conta durante a operação não restaura status da conta anterior.

Isso prepara arquivos, não promete funcionamento offline completo. Login, Spotify, arquivos externos, transporte multiplayer e shell do aplicativo ainda dependem das respectivas conexões. Não foi acrescentado service worker nem demonstrado carregamento a frio sem rede.

## Validação executada e limites

- `npm run check`: aprovado (módulos, imports, shell, CSS, manifesto e áudios).
- `npm test`: **615 testes aprovados, 0 falhas** (base: 597; 18 novas regressões); inclui regressões de imagem e composição WebM/fallback, IDs preservados, cache independente A/B, não sobrescrever cache válido, corrupção, rede/quota, autorização antes do envio, conflitos, backup verificado, retomada TUS, recusa de URL externa e preparação após troca de conta.
- `node scripts/check-integration.mjs`: aprovado; motores e cópias de integração preservados.
- Smoke no Chrome do ambiente: shell e tela de entrada carregaram; nenhum erro de módulo observado. Não houve login nem acesso a campanhas reais.
- A/B automatizado usa caches totalmente separados em memória e backend Storage/RPC simulado. **Não é teste com dois navegadores autenticados, dois computadores físicos ou Supabase real.**
- Não foram aplicadas políticas no backend nem criadas contas/campanhas para teste. Não há Postgres/Supabase CLI/Docker neste ambiente. RLS com contas distintas e TUS real continuam bloqueadores de homologação, não resultados aprovados.

## Roteiro de homologação isolada (obrigatório antes de liberar)

1. Projeto Supabase de teste, schema/políticas existentes + SQL novo, buckets privados; frontend de teste apontado somente a ele. Usar campanha fictícia e contas A (mestre), B (outra conta) e J (jogador), nunca dados reais.
2. Chrome perfil A no Windows cria fundo, camada oculta, fallback e WebM. Salvar. Conferir checkpoint completo, manifesto/hash, revisão e objetos privados. Repetir salvamento: nenhum upload duplicado.
3. Firefox/perfil limpo B (mesma conta A, nenhum dado de origem) entra e prepara sessão. Comparar todos os hashes, IDs/cues/luzes e reproduzir com o player atual. Reabrir: reutilizar cache. Editar no PC A: B recebe nova revisão e baixa somente hashes novos.
4. Interromper rede no segundo chunk (>6 MiB); nova tentativa deve fazer HEAD e terminar sem retransmitir o prefixo confirmado. Interromper download e repetir. Simular quota/Storage indisponível: nenhuma revisão incompleta ou estado de prontidão.
5. Editar documento nos dois navegadores: exigir escolha de conflito, preservar ambas as versões. Apagar arquivo apenas na cópia de teste: detectar ausência; corromper bytes apenas em homologação: detectar hash.
6. Conta B/J tenta listar/baixar/inserir/atualizar o caminho privado de A: todas devem ser negadas. Publicação de quadro de teste contendo o caminho privado também não pode liberar acesso. A pode inserir/ler, mas não atualizar bytes sob o hash existente. Quadro publicado normal e áudios continuam funcionando.
7. Preparar notebook, reproduzir simples/WebM, entrar no quadro e apresentar a jogador Android. Confirmar cues, prewarm, sincronismo, primeira reprodução, reconexão, áudio e limpeza normal.
8. Registrar navegador/OS, revisões, hashes, volumes, tempos, resultados e falhas. Só liberar após esse teste independente real. Não há promessa de carregamento instantâneo quando mídia ainda não foi enviada/baixada.
