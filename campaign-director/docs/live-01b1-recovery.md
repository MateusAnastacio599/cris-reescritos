# LIVE-01B.1 · recuperação da sala e diagnóstico da entrega

Base: `00ec34b`, main com PRs #24 e #25 integrados. Branch: `fix/live-01b1-room-ux-cinematic-delivery`. Sem merge, publicação, migração ou acesso/escrita a campanhas reais nesta sessão. Todos os testes de UI usaram contas e quadros fictícios.

## Causas confirmadas e inventário

| Área | O que existia | Problema confirmado | Consolidação |
|---|---|---|---|
| `wr()` / `sharePanel` | Link, estado, ações básicas | Outros blocos modificavam o mesmo DOM, às vezes escondendo controles anteriores | Uma composição em `board-room-ui.js`, mantendo o mesmo `sharePanel` |
| Trecho OBS, antigo `Hb = vr` | Link OBS e protocolo/câmera | Criava outra linha a cada composição inicial, posteriormente escondida | Link na seção recolhível; transporte OBS mantido |
| `shChoose`, `ix2 = vr` | Escolha compartilhar/entrar e código formatado 3 + resto | Segundo painel, listeners de captura, instruções repetidas, código de 12 caracteres quebrado | Compartilhar no painel único, entrar em outra mesa nas configurações, código sem quebra |
| `kx2 = vr`, `Ax2` | Fechar, OBS, limite, lista/remover | Mais um wrapper reconstruía participantes e escondia link e botões anteriores | Uma lista por identidade declarada; remover usa conexão/identidade, não índice que muda |
| `vwJoin` / LIVE-01A.2 | Campo código/link, nome, botão CASO, última mesa | Formulário concorre com tarja fixa; troca duplicada | Entrada central, um campo principal, última mesa discreta, nome/cor recolhidos |
| `vwBar` | Estado, campanha, troca, retry | Tarja invasiva e `2147483647` acima do filme | Removida; estado e ações reutilizam o menu CRIS existente e seu `boardSyncStatus` |
| `vwDown` / `ac()` | Aviso de saída e espera | Queda temporária afirmava que o mestre saiu e cobria o quadro | Estado Reconectando, retry explícito, sem overlay bloqueante |
| `masterLaunch` | Abrir / editar / voltar | No CSS efetivamente carregado, era `position:static`, `z-index:auto`, atrás do quadro. Os estilos estavam no bundle legado não usado pelo HTML | Mesma entrada com camada explícita e botão Abrir mesa compartilhada; clique validado |
| `vr()` / `Ar()` | Texto em `Os.st` e mensagens do transporte | Erro antigo preservado; eventos ICE podiam substituir sucesso por “Conectando” | Estado derivado de DataChannel, snapshot aplicado/ACK, queda e sessão; sinalização não prova jogador sincronizado |
| Participantes da Cinematic | Painel flutuante separado | Mais uma camada acima da apresentação | Estados no mesmo painel da mesa; detalhes técnicos só em configurações |
| Cor do cursor / debug | Wrapper de `kr()` e `Ar()` | Extensões de DOM e limpeza de frase que o transporte atual não produz | Cor preservada no formulário secundário; wrappers redundantes removidos |

Mantidos: renderer, `CinematicFrame`, Audio Engine, dados/arquivos/fichas, pins/fios, bolso, nome/cor do cursor, OBS, limite/remoção, chamada de câmera, compatibilidade CASO, códigos por campanha, integridade/hash/ACK/cache e projeção pública do quadro. Não houve reescrita geral do motor.

A composição nova substitui a criação anterior; não cria um painel de sala adicional. O motor delega UI ao módulo, sem uma nova sequência de overrides no final do arquivo. `scripts/sync-live-board.mjs` replica somente a superfície LIVE para integração e distribuição, com diferenças de caminhos explícitas e verificadas em testes.

## Entrada e camadas

Antes de conectar: campanha quando acessível, código/link, Entrar na mesa, última mesa e opções de nome/cor recolhidas. A preferência continua por conta/origem e é revalidada pelo acesso à campanha; não concede permissão. Trocar mesa usa o diálogo já existente no menu. Não depende de barra de endereço.

Depois: menu CRIS com ponto de estado, campanha, sala, Sincronizado / Carregando / Reconectando / Falha. Reconectar cancela uma tentativa pendente antes de discar outra. Clientes antigos sem ACK não são apresentados como sincronizados pelo mestre; a compatibilidade permanece identificada. Código do mestre aparece completo uma vez no conteúdo principal e é copiável; convite é uma ação direta. OBS, limite, código antigo, outro código, entrada em outra mesa e diagnóstico ficam recolhidos.

Camadas ordinárias: menu CRIS 90, sala 95, entrada 110, Cinematic 200, acesso intencional “Mesa” 210. Diálogos nativos usam a top layer após ação explícita. Durante o filme, a interface comum fica oculta; o acesso discreto abre os controles existentes. Removidos os z-index máximos usados na LIVE-01B. O renderer e as preferências de movimento reduzido são os mesmos.

## Caminho da Cinematic e correções

1. O Director usa o CinematicLink e o receptor local do mestre, preservados.
2. O receptor chama RemoteCinematics somente depois de abrir o player local.
3. Host registra a chave pública; a falha agora informa indisponibilidade e uma causa sanitizada consultável, por exemplo `host-key-registration / 42501`. A falha injetada foi exercitada, **não é prova de RLS defeituosa em produção**.
4. Jogador lê a chave e verifica nonce/campanha/sala/sessão. Falha de leitura/verificação é comunicada ao mestre, em vez de apenas aguardar o timeout global.
5. Oferta de mídia aguarda snapshot confirmado. `refresh()` é acionado pela confirmação do quadro e oferece somente a apresentação atual, uma vez por conexão.
6. Manifesto, solicitação, transferência, validação, início do player e recibos possuem etapas consultáveis. Payload de instruções acima do limite é reportado, não perdido silenciosamente.
7. `frame.show()` que retorna falso é falha explícita, com limpeza e recibo. Antes podia permanecer carregando até timeout.
8. Falha de importação tem código e aviso humano; versão de capacidade Cinematic é negociada para diagnóstico de clientes antigos. Pré-carregamento e URL do motor foram alinhados em `live01b1`.
9. Fim, substituição, reconexão e barreiras de sessão/revisão mantidos; testes cobrem não reviver apresentações encerradas.

O service worker atual não intercepta nem armazena assets. Não há evidência para atribuir a falha relatada exclusivamente a cache. Diferença de build, conta/RLS, conexão não sincronizada e versão antiga permanecem hipóteses para o aparelho do usuário até colher seu diagnóstico.

## Resultado remoto real e limite da conclusão

A conexão **PeerJS real** nesta sessão parou antes do snapshot e da prova do mestre: oferta e resposta aplicadas, signaling stable, gathering complete, 2 candidatos locais em stats, 0 em SDP/eventos utilizáveis, 0 remotos, ICE new e DataChannel connecting, timeout de 20 s. Eventos Cinematic do jogador: nenhum; peers Cinematic: zero. Evidência sanitizada em [real-peerjs-summary.json](evidence/live-01b1/real-peerjs-summary.json).

Portanto: existe um bloqueio de estabelecimento WebRTC no navegador disponível. Não atribuímos esse diagnóstico automaticamente ao Android do usuário. Não adicionamos servidores/infraestrutura nem alteramos ICE: a configuração observada pertence aos defaults já utilizados pelo PeerJS. Não declaramos homologação física nem sucesso remoto real desta branch.

Com DataConnections de QA simuladas, o caminho completo passou em **duas instâncias do quadro verdadeiro**, incluindo PeerSession, snapshot ACK, prova criptográfica, receptor local, manifesto, mídia, LiveWire, composição e CinematicFrame. Não foi apenas um componente isolado. Esse teste distingue integração do produto de conectividade de rede; não prova RLS ou perfis independentes.

## Validação

**524 testes aprovados, 0 falhas**, incluindo 8 novos testes/regressões. `npm run check`, `check-integration` e diff sem erros. Regressões de áudio/local/CINEMATIC-01.6 incluídas na suíte; Audio Engine e implementação do frame não foram alterados.

No Chrome, interface completa em viewports de iframe **1440, 1024, 768, 390 e 360 CSS px**: entrada central, código em uma linha, painel dentro da área útil, rolagem de configurações. Em 1024/1440 a página de QA usa escala visual para caber na janela; isso não altera a largura CSS do iframe. Não é emulação de Android físico.

Executado no transporte simulado, explicitamente rotulado:

- Código, convite completo e cópia real para clipboard; convite contém sala/campanha.
- Recuperação da última mesa após reabrir, troca pelo diálogo e CASO26107 em mesa fictícia.
- OBS copiado com `obs=1`; limite/remoção e chamada de câmera preservados e presentes.
- PNG adicionado pelo fluxo nativo: mídia recebida, 2 pins e 1 fio preservados.
- Queda, pausa de rede de QA, retry manual, retomada com uma presença.
- Cinematic simples, substituição por câmera/luz/camada WebM; jogador com vídeo readyState 4, paused false e confirmação apresentando.
- Reconexão durante apresentação, fim confirmado nas duas pontas, reentrada sem reviver o filme.
- Registro de chave com erro 42501 injetado: aviso humano e causa avançada, sem credenciais.

Galeria de capturas reais do navegador (contas fictícias; conexão simulada quando houver participantes):

| Situação | Evidência |
|---|---|
| Antes: entrada / painel | [Entrada](evidence/live-01b1/before-entry-390.jpg) · [Painel](evidence/live-01b1/before-master.jpg) |
| Depois: entrada e mestre sem participantes | [360](evidence/live-01b1/after-layout-360.jpg) · [390](evidence/live-01b1/after-layout-390.jpg) · [768](evidence/live-01b1/after-layout-768.jpg) · [1024](evidence/live-01b1/after-layout-1024.jpg) · [1440](evidence/live-01b1/after-layout-1440.jpg) |
| Jogador conectado / reconectando | [Conectado](evidence/live-01b1/after-connected-390.jpg) · [Reconectando](evidence/live-01b1/after-reconnecting-390.jpg) |
| Mestre com participante e configurações | [Painel/rolagem](evidence/live-01b1/after-advanced-390.jpg) |
| Cinematic nas duas pontas | [WebM](evidence/live-01b1/after-cinematic-webm-390.jpg) |
| Falha de permissão injetada | [Aviso e diagnóstico](evidence/live-01b1/after-permission-failure.jpg) |

As capturas estão em [evidence/live-01b1](evidence/live-01b1). As imagens anteriores do main incluem a sobreposição identificada de controles de QA da fixture antiga; ela não fazia parte do produto. As capturas novas ocultam esses controles dentro do quadro e deixam a legenda externa de teste visível. As evidências históricas dos PRs anteriores foram preservadas.

## Reprodução e homologação Windows/Android

Automatizados, a partir da raiz:

```sh
npm --prefix campaign-director test
npm --prefix campaign-director run check
node campaign-director/scripts/check-integration.mjs
node campaign-director/scripts/sync-live-board.mjs
```

Fixture descartável (não publicar):

```sh
node campaign-director/tests/fixtures/live-room-recovery-demo.mjs <diretorio-novo>
```

Sirva `public/`. `/room-qa.html` tem simulação explicitamente identificada e seleção de viewports. `/room-qa.html?real=1&case=teste-unico` usa PeerJS/WebRTC reais, com contas ainda fictícias. Para reproduzir erro de registro: `/quadro/?case=teste-unico&transport=simulated&failure=register&visual=1`. A fixture nunca deve ser tratada como autenticação real.

Para homologação física, use **este build em origem HTTPS de teste isolada**, com mestre e membro de uma campanha fictícia, sem substituir produção. Nenhuma implantação foi realizada nesta entrega.

1. Atualize/reabra as duas pontas. Windows: Abrir mesa compartilhada → Copiar convite. Android/PWA: entrar pelo link ou pelo campo; conferir campanha/sala. Reabrir pelo ícone e usar última mesa; testar Trocar mesa.
2. Exija **Sincronizado** nos dois lados, imagem recebida e uma presença. Só então avalie Cinematic. Se não sincronizar, abra Configurações da mesa → Diagnóstico avançado e registre connection/ICE/channel/etapa, sem tokens, SDP nem IP.
3. Director da mesma campanha/conta do mestre: Apresentar uma imagem simples em loop. Exija confirmação **Apresentando** do participante e imagem visível no celular. Depois teste composição com WebM/fallback, câmera, luz e movimento reduzido.
4. Se só o mestre apresentar, consulte `cinematic.hostFailure` e `peers[].phase/code`: registro → prova → confirmação do quadro → manifesto → mídia → player → recibo. Isso localiza a etapa que falta. Se `host-key-registration / 42501`, verifique owner/GM e políticas do ambiente de teste, sem desativar RLS. Se o jogador não aparece nos peers Cinematic, resolva primeiro a conexão/versão de ambas as pontas.
5. Substitua enquanto carrega, encerre e confirme Encerrado no mestre. Interrompa a rede e reentre durante e depois do filme; preserve mesa e presença única. Mova cursor/objeto durante upload e confira imagem/pins/fios após recuperar.
6. Teste papéis e acesso com contas reais **de teste**, mais de um jogador, suspensão/retorno do PWA e regressão de áudio. Guarde build, aparelho, ação e diagnóstico sanitizado. O gate permanece aberto até esses cenários passarem fisicamente.

Segurança restante: a prova autentica o mestre, **não cada identidade individual PeerJS**. O envio continua limitado ao quadro público e aos assets visíveis da apresentação explicitamente apresentada; não envia biblioteca/camadas ocultas. A autorização individual dos peers não foi resolvida nesta correção de UI. Não liberar uso de material privado real sem homologar esse limite e a autorização dos participantes.
