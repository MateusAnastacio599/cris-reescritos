# CRIS Campaign Director V3

Aplicativo web funcional e independente para preparação e direção de RPG. Parte do código e dos dados de **CRIS-Campaign-Director-Prototype.zip**, preservando integralmente os roteiros da Casa São Martinho e os seis arquivos WAV originais. O CRIS principal não é alterado.

## Usar

Abra o site publicado em um navegador moderno, no computador ou no celular. As três cenas iniciais estão em **Reescritos → Sessão 01 → Casa São Martinho**.

- **Editar página:** editor visual com blocos de texto, títulos, citações, listas, tarefas, notas e cues. Digite `/` em um bloco vazio. Os blocos podem ser reordenados pelas opções da alça ou arrastados no desktop.
- **Links internos:** use o botão de link no editor ou `[[Nome da página]]` no Markdown. As referências criam backlinks nas páginas de destino.
- **Campanhas, páginas e cenas:** adicione pela navegação; renomeie, organize e exclua nas respectivas opções. As cenas podem ser duplicadas com sua configuração sonora.
- **Biblioteca:** upload de áudio para IndexedDB; nomes, categorias e tags; URLs e playlists do YouTube; playlists com ordem definida ou aleatória.
- **Direção:** camadas em loop, gatilhos, cues compostas e timeline. Configure usando os botões `+` ou o ícone ao lado de Direção da cena.
- **Player persistente:** navegação troca somente o workspace. A transição sonora acontece ao iniciar outra cena, com crossfade dos arquivos locais.
- **Celular:** alterne entre Roteiro e Direção da cena; o player fica no rodapé. O primeiro áudio exige um gesto de reprodução.
- **Backup e dados:** exportação JSON completa, incluindo arquivos enviados. Restauração validada, com cópia do estado textual anterior mantida no navegador.

As edições são locais a cada navegador/origem, sem sincronização automática entre aparelhos. Exportar/importar é o caminho para transferi-las. A continuidade com tela bloqueada depende do navegador/sistema. O YouTube usa seu player oficial visível; a disponibilidade de vídeos e a permissão de reprodução dependem do provedor. A transição de dois vídeos do YouTube usa um único player; o crossfade simultâneo é fornecido para áudio local.

## Atualização 3.5 — fades de efeitos e camadas

- **Biblioteca → Editar áudio:** padrões opcionais de fade in e fade out de 0 a 30 segundos para efeitos e loops. Campos vazios herdam o comportamento anterior; 0 desativa o fade. As alterações valem no próximo play.
- **Direção da cena:** camadas, gatilhos, efeitos da timeline e ações “Tocar efeito” nas cues podem escolher tempos próprios. “Parar camada” também aceita um fade out.
- **Ambientes:** cada camada pode escolher sua entrada e saída. No modo ocasional, os fades são aplicados a cada som; em loop, na ativação e desativação. Playlists mantêm o crossfade separado entre faixas. A transição explícita de uma cena/cue tem prioridade sobre os padrões do ambiente.
- Efeitos fazem a saída antes do final do arquivo. Os fades de arquivos curtos são reduzidos proporcionalmente para evitar sobreposição; pausa, buffering e busca na faixa refazem o envelope pelo tempo de reprodução. Volume e amplificação usam ganhos separados.
- “Silêncio total” continua imediato. Os campos são opcionais no backup V3; arquivos, roteiros e configurações existentes permanecem no navegador.

Novos módulos: `audio-fades.js` (envelope dos efeitos, sem timers) e `fade-ui.js` (controles compartilhados). O motor e a interface permanecem independentes para a futura integração ao CRIS.

## Atualização 3.7.0 — CRIS integrado e dados privados no Supabase

- Importação real concluída do backup de 20/10: 1 campanha, 2 páginas, 6 cenas, 33 itens de áudio, 3 playlists, 4 ambientes e 5 cues compostas. Os 23 arquivos (51.555.008 bytes) foram enviados ao bucket privado e lidos de volta com verificação SHA-256. A cópia JSON original ficou preservada em director_backups; o estado canônico em director_workspaces é igual ao original importado.
- Director permite abrir a cópia do Supabase e salvar alterações manualmente. A abertura verifica os áudios antes de aplicar o estado e preserva o JSON local anterior em cris-campaign-director:v3:before-cloud-load. Arquivo local com o mesmo ID e conteúdo divergente bloqueia a abertura. O salvamento envia arquivos novos, lê de volta e verifica hash; só depois confirma a revisão. Não há sincronização automática de texto em tempo real.
- director_workspaces é a fonte da edição corrente. As tabelas normalizadas existentes registram a importação inicial e ficam como base para evoluir os serviços de cenas/biblioteca; o editor atual não deve ser reconstruído a partir delas após novas edições do workspace.
- Preview completo do CRIS em dist/cris/ usa o código existente, com o motor ativo quadro-cris-v7, LUME e assets preservados. integration-main/ contém as alterações portáveis para a raiz do repositório principal; a única diferença de caminho do preview está em integration-bridge.js.
- Credenciais antigas removidas do login principal e dos três motores do quadro. Nomes, identidade e acesso de mestre vêm do backend. Criadas as contas iris, andre, matias, celine e convidado com seus perfis de agente e associação à campanha. O administrador mateus preservou UUID/senha. Novas senhas dos amigos devem ser definidas pelo mestre em Conta e nuvem; não foram reaproveitadas as credenciais públicas antigas.
- Fichas mantêm todas as regras e campos personalizados, com acesso por usuário e campanha. Salvamento compara revisão e preserva cópia local por UUID de usuário. A ficha antiga sem dono permanece local e só é vinculada por ação explícita do usuário. Rascunhos do assistente de criação permanecem locais. O mestre pode consultar fichas pela permissão de banco; a interface atual ainda mostra a própria ficha.
- Quadro mantém PeerJS/WebRTC e objetos interativos. Mestre pode salvar um snapshot privado no banco pelo botão SALVAR NA NUVEM; outro dispositivo carrega o snapshot quando não tem quadro local. O quadro local tem preferência e não é apagado automaticamente. Não é ainda uma substituição do transporte PeerJS por Realtime autenticado. Os binários de itens ocultos foram filtrados do snapshot inicial enviado a jogadores. Jogadores podem abrir sua própria ficha dentro do quadro.
- A importação no servidor usou autorização temporária; o endpoint de importação foi desativado após a conclusão. Nenhum backup pessoal, áudio adicionado, senha ou chave administrativa foi incluído no GitHub.
- Validação: 150 testes, sintaxe dos módulos e do motor ativo, testes de RLS no banco para mestre/jogador, isolamento de fichas e conflitos de revisão. Testes de banco foram revertidos. Teste visual em navegador, uso com dois monitores e partida real continuam pendentes.

## Atualização 3.6.1 — usuários e senhas para uma mesa fechada

- O acesso visível passa a ser por nome de usuário e senha. Cadastro público e recuperação por e-mail foram removidos da interface.
- A conta existente e confirmada foi associada ao usuário `mateus`, com o mesmo UUID e senha. Nenhuma senha foi lida, redefinida ou adicionada ao código.
- O mestre administrador pode criar usuários, definir novas senhas para amigos e trocar sua própria senha em Conta e nuvem. Contas novas não ganham acesso a campanhas automaticamente.
- A Edge Function `director-accounts` autentica o login com Supabase Auth e exige token validado em todas as ações de conta. Administração depende da tabela protegida `director_accounts`, nunca de metadados editáveis do usuário. E-mails técnicos das contas ficam apenas no backend, sem envio ou confirmação. Não é necessário configurar links de retorno para esse fluxo.
- `verify_jwt=false` é intencional para permitir o login inicial: a função faz sua própria autenticação e autorização. Login tem limite persistente por usuário e origem. As chaves administrativas existem somente no ambiente da função e nunca no navegador ou no repositório.
- 139 testes passaram. RLS de contas, bloqueio de autopromoção e limite de tentativas foram testados no banco em transação revertida. Endpoint real recusou login inválido e criação sem token. Login com a senha real e o fluxo visual ainda precisam do teste do usuário.
- O backup fornecido em 20/10 foi validado sem modificações: 1 campanha, 2 páginas, 6 cenas, 33 itens de áudio, 3 playlists, 4 ambientes e 23 arquivos incluídos (51.555.008 bytes). Nenhum arquivo ausente ou base64 inválido. O backup do usuário não foi incluído no repositório, nem importado para o banco remoto nesta etapa.

Configuração: `backend/username-accounts.sql` registra o SQL já aplicado; a adoção inicial pressupõe uma única conta confirmada. A função usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` fornecidos pelo ambiente Supabase. Ao publicar outra instalação, revisar o domínio CORS em `backend/functions/director-accounts/index.ts`.

A auditoria de segurança registra RLS sem política em `cris_private.login_limits`, intencional: somente service_role tem acesso. Também informa que a configuração opcional de proteção contra senhas vazadas está desativada no projeto; essa configuração de Auth não foi alterada por esta implementação. Referências: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy e https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Atualização 3.6.0 — conta e preparação da importação

- Conta e nuvem na barra lateral: cadastro por e-mail e senha, login, recuperação de senha e saída apenas desta sessão.
- Sessão Supabase separada dos dados do Director. Entrar ou sair não importa, apaga ou substitui roteiros/áudios.
- Conferência manual do conteúdo local, com inventário de campanhas, páginas, cenas, cues, playlists, ambientes, referências YouTube e arquivos do IndexedDB. Arquivos ausentes ou vazios impedem o estado pronto.
- A conferência autentica o usuário com Auth e consulta campanhas via Data API, mas não envia conteúdo ou arquivos. Importação e sincronização permanecem para a próxima etapa.
- Cliente oficial Supabase 2.118.0 e esbuild 0.28.2 fixados no package-lock.json; SDK empacotado em dist/vendor/supabase.js, sem CDN em tempo de execução. Recriar com npm ci && npm run build:vendor.
- 128 testes aprovados. SDK local importado e Data API testada: acesso sem login retorna 401. Login real, entrega de e-mail e navegação no celular ainda dependem do teste com a conta do usuário; não houve teste visual automatizado neste ambiente.

Nota histórica da versão 3.6.0 (fluxo substituído por usuário/senha na 3.6.1): antes de testar cadastro/recuperação no projeto Supabase, em Authentication > URL Configuration, conferir Site URL e Redirect URLs para https://cris-campaign-director-v3.mateusfernando599.chatgpt.site/ . Esta configuração não é alterada pelo aplicativo. Manter confirmação de e-mail ativada. A chave em cloud-config.js é pública; autorização depende de RLS, não de esconder essa chave. Nenhuma chave secreta está no código.

## Atualização 3.5.1 — repetição musical e volume no replay

- Faixas musicais individuais repetem por padrão até trocar/encerrar, inclusive em cues existentes. O controle **Repetir a música** em cues, cenas e trilhas de ambiente permite tocar uma vez. Playlists preservam sua sequência e seu modo aleatório; efeitos sonoros continuam tocando uma vez.
- Arquivos usam loop do elemento de áudio. Vídeos individuais do YouTube são reiniciados pelo motor ao terminar, preservando volume, fades e posição inicial configurados. As restrições de reprodução e carregamento do YouTube continuam se aplicando.
- Reiniciar ou voltar o mesmo vídeo cancela o fade final antigo e recupera o volume de destino. Um encerramento explícito ou Silêncio total invalida reinícios pendentes.
- **Mixer → Faixa atual:** volume independente da faixa e controle de repetição, sem editar a cue ou reiniciar o áudio. O volume final continua multiplicado pelos canais Música e Geral. Mudanças no mixer valem para a reprodução atual; a cue mantém sua configuração salva.
- `loop` é opcional e booleano no backup V3. Os testes incluem múltiplas rodadas do mesmo vídeo, replay após fade final, seek sem evento de reprodução, fila de músicas e cancelamento de reinício durante carregamento.

## Organização

| Arquivo | Responsabilidade |
| --- | --- |
| `dist/index.html` | Shell persistente: navegação, player e host do YouTube |
| `dist/app.js` | Controle da interface e CRUD de campanhas, páginas e cenas |
| `dist/campaign-data.js` | Conteúdo e definições originais do protótipo |
| `dist/storage.js` | Modelo V3, persistência, mídia e backup |
| `dist/markdown.js` | Conversão de blocos e renderização segura de texto |
| `dist/editor.js` | Editor visual e ordenação de blocos |
| `dist/audio-engine.js` | Motor de áudio independente da navegação |
| `dist/scene-config.js` | Editor visual da direção sonora |
| `dist/library-ui.js` | Biblioteca, upload, YouTube e playlists |
| `dist/director.css` | Layout responsivo e tema |
| `reference/prototype-original` | Código original e hashes dos áudios, para rastreabilidade |

Não há dependências de execução, build ou servidor de aplicação. `dist/` contém o site completo. Um servidor HTTP(S) é necessário para carregar os módulos JavaScript; abrir `index.html` diretamente como `file://` não é suportado.

## Integração futura

O `AudioEngine` recebe um getter para o estado e não consulta a página atualmente aberta. Uma instância deve pertencer ao shell do CRIS principal, com injeção dos repositórios de estado/mídia quando houver backend. Eventos `change`, `tick`, `cue` e `error` permitem conectar outra interface. A cena ativa é um snapshot independente da cena em edição; mudanças na direção são aplicadas ao parar e iniciar a cena novamente.

O modelo exportado tem `schemaVersion: 3`, `campaigns`, `audioAssets`, `playlists`, `settings` e `ui`. Áudios enviados são identificados por ID; URLs `blob:` são resolvidas em tempo de execução, não gravadas como fonte permanente. Cues contêm ações `play`, `fade` e `stop`, cada uma com atraso em segundos. A Terceira Badalada foi convertida em quatro ações editáveis mantendo a sequência original.

## Atualização 3.1 — direção musical e ambientes

- **Biblioteca → Transições:** fades padrão de entrada/saída e crossfade automático de playlists de arquivos locais, com pré-carregamento da próxima faixa.
- **Playlist do YouTube → ícone de lista:** mostra a sequência disponibilizada por `getPlaylist()`, com capas clicáveis, nomes de referência e opção de trazer as faixas individualmente para a biblioteca. O player fornece IDs; os títulos são completados pelo vídeo em reprodução. Não há chave da YouTube Data API configurada, portanto não é prometida uma lista com todos os títulos preenchidos de imediato. Playlists privadas ou indisponíveis podem não ser listadas.
- **Direção da cena → Música:** manter, iniciar/trocar ou encerrar a música; faixa/playlist e primeira faixa; timestamp, volume e fades específicos; ambiente salvo opcional. A primeira faixa é 1 na interface.
- **Ambientes:** presets com loops contínuos, efeitos ocasionais com intervalo mínimo/máximo, volumes independentes, disparos manuais e fades de entrada/saída. São persistentes e independentes das camadas da cena.
- **Cues ampliadas:** música, ambientes, mixer, lembretes e navegação entre roteiros, além dos efeitos originais.

O YouTube usa um único player oficial visível, com tamanho compacto de 248 × 200 px para o vídeo, sem cobrir os controles ou substituir a reprodução por uma capa. O fade de saída antecede a troca; o fade de entrada aguarda `PLAYING` e é suspenso em `BUFFERING`. Rede, anúncios, vídeos indisponíveis e restrições do navegador continuam podendo causar intervalos. Um ambiente local em execução permanece durante a troca. Não há extração de áudio, player oculto ou promessa de crossfade simultâneo entre vídeos do YouTube.

As mudanças são aditivas, preservam a chave de armazenamento e a versão 3 do formato de backup. A migração adiciona `ambiences` e os novos padrões de música quando ausentes, sem substituir textos, cenas ou áudio enviado.

Novos módulos: `music-methods.js` (direção musical e YouTube), `volume-envelope.js` (fades canceláveis), `music-ui.js` (configuração), `youtube-library.js` (lista de faixas), `ambience-engine.js` / `ambience-ui.js` (SoundPad), `cue-editor.js` (ações compostas) e `audio-tools.css` (layout responsivo).

## Atualização 3.2 — exclusão e surpresa nas playlists

- Lixeira permanente em cada áudio/música adicionado, no desktop e no celular, com confirmação. A exclusão remove o arquivo enviado e suas referências em playlists, camadas, gatilhos, cues, timeline e ambientes; preserva os textos. Somente o áudio excluído é interrompido, sem parar os outros canais. Os seis sons originais continuam protegidos.
- Botão **Aleatório** no cabeçalho das playlists do CRIS. A escolha fica salva; novas playlists começam com o modo ativo. Cada rodada toca todas as faixas uma vez, evita repetir a última na virada e mantém histórico para Anterior/Próxima. O pré-carregamento consulta a mesma próxima faixa e os fades continuam ativos.
- Playlists nativas do YouTube têm **Aleatório** na lista de capas e na edição do áudio. O player oficial executa `setShuffle` e `setLoop`; a seleção de capas identifica o vídeo por ID para funcionar mesmo após reordenar. Novos links de playlists usam aleatório por padrão. A garantia da rodada sem repetição do CRIS se aplica às playlists criadas/importadas na biblioteca; a ordem da playlist nativa é gerida pelo YouTube.
- Cenas e cues que iniciam uma playlist com aleatório ativo sorteiam a faixa inicial. A primeira faixa configurada é usada no modo sequencial. Tocar diretamente uma faixa da lista continua permitindo escolhê-la antes do restante da rodada.

Novos módulos: `playlist-order.js` (fila, rodadas e histórico) e `audio-assets.js` (remoção das referências). O formato de backup permanece V3; `shuffle` é opcional em arquivos antigos.

## Atualização 3.3 — playlists nos ambientes

Em **Ambientes → Adicionar playlist**, escolha uma playlist de arquivos da biblioteca. Cada camada tem sua própria fila, volume, opção de aleatório e comportamento:

- **Contínuo:** toca uma faixa após a outra, com pré-carregamento e crossfade configurável. Em modo aleatório, percorre todas as faixas antes de repetir e evita repetir a última na virada da rodada.
- **Ocasional:** escolhe uma faixa e espera seu término; depois sorteia o intervalo até o próximo som. A fila continua sem repetição dentro da rodada.

Várias camadas podem tocar juntas sem ocupar o player musical. O cartão informa o áudio atual e permite avançar uma playlist contínua. A fila e a faixa são mantidas ao navegar, pausar, retomar ou reaplicar o mesmo ambiente.

A seção **Trilha musical do lugar** aceita uma faixa ou playlist, incluindo YouTube, com volume e fades. Ela começa junto do ambiente e usa o canal de música da mesa. Ao encerrar/trocar o lugar, apenas a trilha ainda pertencente a ele é encerrada; uma escolha musical manual posterior é preservada. Configure **Ambiente salvo ao iniciar** na música da cena para chamar tudo junto. Uma música explicitamente configurada na própria cena tem prioridade sobre a trilha do lugar.

Exemplo de uso: criar na biblioteca a playlist “Conversas do café” com quatro arquivos; adicioná-la ao ambiente “Café”, em modo aleatório; adicionar talheres ocasionais e escolher uma playlist de jazz na trilha musical. Os arquivos devem ser fornecidos pelo mestre. Playlists com links do YouTube usam a trilha musical, pois o player oficial permanece único e visível.

O módulo `ambient-playlist.js` mantém a reprodução por camada separada do motor musical. O formato continua `schemaVersion: 3`: a camada passa a aceitar `playlistId` em lugar de `assetId`, com `shuffle` e `crossfade` opcionais; o ambiente pode conter `music`. Backups anteriores continuam válidos. A exclusão de áudio ou playlist também limpa os vínculos nos ambientes e cancela as filas correspondentes.

## Atualização 3.4 — roteiros, editor e biblioteca

- Os textos de **Quarto**, **Corredor** e **Escritório** passam a ser os enviados em 19/10/2026. A atualização automática é única, identifica a campanha/página/cenas pelos IDs e altera somente `markdown`. Cada texto anterior fica em `scene.textHistory`, acessível em **Página e cena → Versões anteriores do roteiro**. Uma cópia do estado anterior também é guardada no navegador antes da migração. Arquivos enviados, playlists, ambientes, cues, camadas e timeline são mantidos.
- Editor de blocos com tipografia consistente entre edição e leitura, tabelas editáveis, listas numeradas, menu `/` pesquisável, barra de formatação da seleção e desfazer/refazer. Enter divide o texto no cursor; Backspace junta parágrafos e sai de blocos de lista/título. Shift+Enter preserva quebras dentro do bloco. Tabelas têm controles de linha/coluna; Tab navega pelas células e expande a última linha. Colagem HTML, Markdown e de planilhas passa por conversão de estrutura e formatação; scripts e outros elementos ativos não são inseridos. As cenas continuam nas abas próprias.
- **Editar/criar playlist:** busca por nome, arquivo e tags, filtros por tipo, seleção de múltiplas faixas com checkboxes, adição dos resultados e ordenação separada da seleção. Os seletores de fontes em cenas, cues e ambientes também têm busca, mantendo seus valores/formulários originais.
- Os demos passam a ser excluíveis individualmente ou por **Biblioteca → Remover demos**, com confirmação. A limpeza remove referências antigas por ID e, quando não há ID, pelo caminho de áudio. Textos e arquivos enviados são preservados; os WAVs do protótipo seguem disponíveis no código de referência.
- **Biblioteca → Editar áudio → Amplificação:** de 100% a 400% por arquivo. O ganho é separado do volume/fade da instância, fica salvo em `audioAsset.boost` e pode ser aplicado durante a reprodução sem reiniciar a faixa. Há controle de picos na saída Web Audio; amplificações altas ainda podem distorcer. O arquivo não é regravado. YouTube permanece no player oficial, cujo volume é de 0 a 100; o ganho extra atende arquivos locais/enviados.

Novos módulos: `scene-updates.js` (textos e migração), `editor-model.js` (operações/histórico), `editor-clipboard.js` (colagem), `audio-search.js` / `search-select.js` (seleção com busca) e `editor-tools.css` (edição, tabelas e novos controles). O formato de backup permanece V3.

## Verificação

```sh
node scripts/check.mjs
node --test tests/*.test.js
```

Os testes verificam preservação integral das cenas e hashes dos WAVs, persistência, backup, renderização/links, URLs do YouTube, independência da navegação, crossfade, timeline/pausa, mixer e cancelamento de eventos. O AudioEngine é exercitado com uma interface de mídia simulada; isso não confirma saída sonora real, codecs ou autoplay em um aparelho físico.

Nesta entrega, o preview supervisionado do Work não iniciou por falha de infraestrutura (`bwrap` sem permissão de montagem). A validação visual no navegador e a reprodução real no celular ficaram pendentes. Os testes de código e a publicação são independentes dessa limitação.


### Evidências interativas nos arquivos

No quadro salvo da investigação, selecione um objeto e abra **CRIS → Preparar evidência do acervo**. Escolha uma evidência existente ou **Criar nova evidência deste objeto**, informe o título e o documento, e decida se deseja publicar. Não é necessário anexar uma imagem para cadastrar um objeto nativo. A investigação, o documento e o quadro de destino também devem estar publicados para os jogadores.

A preparação inclui o item selecionado, os conteúdos dos recipientes, peças do mesmo quebra-cabeça e objetos explicitamente vinculados, até 32 itens por preparação. Não inclui itens soltos sem vínculo. Ativadores e ferramentas administrativas continuam reservados ao mestre. Para modificar a preparação entregue, salve-a novamente após editar o objeto.

O jogador recebe sua própria cópia ao escolher **Adicionar ao quadro**. O estado interativo (como combinações, desbloqueios, respostas e abertura de recipientes) fica no progresso individual do pin. Marcas rasterizadas, como grafite e raspagem, ficam em registros privados imutáveis por hash, com remoção em cascata ao excluir o pin. Os originais dos anexos permanecem no armazenamento existente. Anotações avulsas continuam no navegador, como antes.

Validação desta integração: testes automatizados e verificações transacionais com papéis de mestre e jogador; teste do motor real com decalque, celular, ficha de caso e maleta com conteúdo, incluindo recarga. Os demais objetos nativos usam a mesma serialização, mas não foram todos exercitados individualmente na interface.


### Central de notificações — rascunhos e destinos (3.32)

O sino do mestre oferece **Rascunhos**. Cada rascunho é privado, persistido em `operation_notice_drafts`, e pode ser editado, duplicado e excluído. Salvar não envia. O conteúdo antigo da Ocorrência 010 continua disponível para recuperação no navegador original, sem ser sobrescrito pela recuperação das novas edições.

O fluxo mantém **Salvar rascunho**, **Enviar somente para mim**, **Revisar envio à equipe** e a confirmação final separados. A publicação real usa o id do rascunho como chave idempotente; avisos enviados ficam bloqueados para edição, mas podem ser duplicados. Alterações concorrentes exigem reabrir/revisar. Os status de envio descrevem a gravação na caixa de entrada; a aceitação pelo push é informada separadamente e não comprova entrega física ao aparelho.

Os tipos Atualização de investigação, Comunicado operacional e Nova evidência ou documento dispensam campos policiais. O destino interno pode apontar a investigação, documento, evidência ou quadro publicado; a validação ocorre no servidor antes do envio e novamente com RLS ao abrir o conteúdo. Não há envio agendado/automático. Fotografias continuam opcionais e privadas antes da publicação.

Banco: `schema/notification-drafts.sql`. Backend: `backend/cris-notifications/`. Validação real de RLS e persistência com usuários sintéticos, em transação revertida: `backend/verify-notification-drafts.sql`. Testes do publicador usam o handler real com clientes simulados, sem enviar push. A revisão visual usa módulos reais em fixtures descartáveis desktop e viewport 390px; não substitui um teste físico de push/vibração no Android/iOS.

Acervo: leitor compacto aceita os dois formatos de relatório existentes, preserva dados/narrativa, reúne anexos em galeria e consome links diretos para não reabrir documentos em recargas posteriores. O vínculo da preparação a anexos com imagem não envia mais atualização vazia ao PostgREST nem muda a publicação do anexo existente.
