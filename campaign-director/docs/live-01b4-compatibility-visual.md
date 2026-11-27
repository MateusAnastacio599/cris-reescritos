# LIVE-01B.4 — compatibilidade e regressões visuais

Base: `main` / `1d9d1e2` (merge do PR #28). Branch: `fix/live-01b4-mobile-client-visual-regressions`. Sem publicação, merge, migração, alteração de campanha ou mudança no Audio Engine.

## Conclusões e limites

**Celine:** o usuário confirmou uso do app instalado. Não foram fornecidos os diagnósticos daquela tentativa, versão do Android/navegador nem a mídia original. A causa específica continua aberta. O sucesso de André no navegador é evidência relatada pelo usuário, não um teste executado aqui. Não atribuímos a falha ao cache ou autoplay.

O service worker (`sw.js`) existente só trata notificações; não intercepta `fetch` nem mantém cache de assets. Portanto não há evidência de um cache de assets do SW causando a falha. Não foi adicionado outro sistema de cache e nenhum armazenamento foi apagado.

Foi identificada e corrigida uma incompatibilidade independente: o primeiro prepare chamava `signal?.throwIfAborted()`. Um sinal existente sem esse método causava `TypeError`, inclusive antes da detecção de mobile. O mesmo ocorria na carga da composição e no editor. Agora a verificação usa `signal.aborted`, preservando cancelamento. A regressão simula esse sinal e verifica primeiro play e cancelamento. Isso não prova a causa do aparelho da Celine.

## Diagnóstico e publicação

- Capacidade remota continua **v4**. A identidade de publicação `live01b4` é enviada separadamente no handshake PeerSession e preservada por conexão.
- Diagnóstico RemoteCinematics inclui `build`, `environment` local e por participante, `id`, `version`, `verified`, `boardSynced`, `phase`, `failurePhase`, `errorType`, `code` e métricas existentes de bytes, integridade, transferência, preparo e início.
- Ambiente distingue `browser` / `standalone`, família/versão principal do browser e disponibilidade de APIs. Não inclui user agent completo, modelo do aparelho, URLs, tokens ou mensagens brutas de exceção. Esses campos são declarações do cliente para diagnóstico; não autenticam ninguém.
- Falhas de preparação do receiver, preparo da mídia e início do player têm códigos distintos. O tipo de erro é limitado a uma lista. Falhas de uma sessão anterior com `sid` não sobrescrevem a atual. Uma nova oferta limpa o erro anterior.
- Cliente anterior à v4 recebe orientação de atualizar/reabrir, conservando os dados. O jogador tem a ação **Atualizar CRIS** no aviso existente; não há limpeza de storage. O Director agora mostra o motivo curto além de “Falhou”.
- Entradas do quadro, CSS da sala/paleta, CSS Cinematic, entrada do Director e imports transitivos Cinematic usam o mesmo sufixo de publicação. Os módulos centrais expõem a publicação; mistura de versões falha com a orientação existente de atualizar, antes de montar o receiver.
- `board-room.css?v=live01b1` foi atualizado. O sincronizador inclui também `Halloween2026-1.css`; fontes, `integration-main` e `dist/cris` permanecem equivalentes, com os ajustes de caminhos já previstos.
- Um cliente v4 de outro build não é bloqueado apenas pelo número da publicação. Builds desconhecidos são identificados como `unknown`; a capacidade, a prova criptográfica e o escopo continuam obrigatórios.

## Cores: causa comprovada e resultado

A regra de Halloween `body #vwJoin button:not([data-c])` com `!important` atingia os novos swatches, sem `data-c`. No quadro completo, os oito botões resultavam em `rgb(217, 102, 58)` e raio `0px`.

A regra ficou restrita às ações da entrada antiga, fora de `.cris-room-entry`. Os swatches também têm `data-c` e `aria-pressed`; nenhum `!important` global novo foi adicionado. O callback de cor, envio de `cor` e persistência existente `qi-cor` permanecem em uso.

Em viewports **390×844** e **1440×844**, com todas as folhas reais do quadro carregadas:

| Valor individual | RGB computado | Raio |
| --- | --- | --- |
| `#e8b04a` | 232,176,74 | 50% |
| `#4ac2e8` | 74,194,232 | 50% |
| `#e84a7f` | 232,74,127 | 50% |
| `#7fe84a` | 127,232,74 | 50% |
| `#b04ae8` | 176,74,232 | 50% |
| `#e8734a` | 232,115,74 | 50% |
| `#3fd6b0` | 63,214,176 | 50% |
| `#f2f2f2` | 242,242,242 | 50% |

Selecionar azul e reabrir o jogador manteve `#4ac2e8` selecionado. Há regressão de interação para as oito opções, seleção única e restauração pelo callback persistido. A medição CSS foi feita no navegador real; o transporte desse cenário é simulado.

## Iluminação: causa comprovada e correção

Na composição 16:9, a câmera ampliada escapava de `.cinematic-world` (`overflow:visible`). As camadas `cinematic-light-darkness` e `cinematic-light-vignette` cobriam apenas o world; a imagem escapada permanecia sem essa luz. Além disso, `cinematic-atmosphere` cobria o viewport inteiro em vez da composição. Não foi encontrado efeito de escuridão duplicado.

Reprodução controlada no mesmo instante **2,000 s**, mesma mídia fictícia e parâmetros: `motion=breath`, `intensity=20`, zoom `1.24`, luz `#ffcc72`, intensidade `.18`, escuridão `.30`, vinheta `.65`. Na prévia 1280×720 o world ocupa tudo; no quadro 1865×951 ele ocupa `x=87,171875` até `1777,828125`, exatamente a região do retângulo observado. Mestre e remoto apresentaram o mesmo defeito.

Agora o world do CinematicFrame recorta o overscan da câmera, e a atmosfera pertence ao mesmo world das luzes. Sua instância anterior é removida ao recalcular movimentos/encerrar, evitando acúmulo após mover a camada para dentro da composição. Nenhum parâmetro de luz, efeito de atmosfera, blend mode, câmera ou timeline foi removido. Letterbox preserva a composição. A regra de clipping do editor estático continua necessária porque esse canvas não é um CinematicFrame.

Depois: os três players conservaram os mesmos parâmetros em 2 s, escuridão computada `0.3`, vinheta `rgba(0,0,0,0.65)`, uma atmosfera e `overflow:hidden`. As laterais passaram a letterbox, sem faixas de imagem sem iluminação. A fixture usa o renderer de prévia do Studio e CSS de produção; não é um teste de ponta a ponta do formulário completo do Studio. Não houve acesso à composição real “Teatro Teste”.

## Evidências

Todas as imagens abaixo usam contas, campanha e mídia fictícias. Capturas reais do usuário foram apenas inspecionadas; não foram incluídas no repositório.

- [Cores antes](validation/live-01b4/b4-colors-before.jpg)
- [Cores depois / mobile](validation/live-01b4/b4-colors-mobile-after.jpg)
- [Cores depois / desktop](validation/live-01b4/b4-colors-desktop-after.jpg)
- [Prévia, mestre e remoto antes / mesmo instante](validation/live-01b4/b4-parity-before.jpg)
- [Prévia, mestre e remoto depois / mesmo instante](validation/live-01b4/b4-parity-after.jpg)
- [Quadro corrigido](validation/live-01b4/b4-board-after.jpg)
- [WebM em viewport mobile](validation/live-01b4/b4-mobile-webm.jpg)
- [Parâmetros e geometria](validation/live-01b4/b4-parity-metrics.json)
- [Registro do cenário no navegador](validation/live-01b4/b4-browser-integration.json)

## Validação executada

- `npm run check`: aprovado.
- `npm test`: **567 aprovados**, incluindo áudio, segurança, transporte, início coordenado, cancelamento, integridade e reconexão existentes; dez regressões adicionadas nesta etapa.
- `node scripts/check-integration.mjs`: aprovado.
- `git diff --check`: aprovado.
- Chromium remoto / dados fictícios / DataConnection **simulado**: quadro real com todas as folhas CSS; oito cores e seleção persistida; desktop e mobile; comparação de luz em 2 s; primeira apresentação simples; substituição por composição de câmera/camadas/WebM; encerramento e restauração da UI (`0` frames/overlays remanescentes).
- WebM nessa execução: `readyState=4`, `256×512`, `muted=true`, `paused=false`, erro nulo. Isso valida o decoder deste Chromium, não de Android.
- Ao reabrir o jogador no harness, a sala salva foi reconhecida e nenhuma apresentação encerrada reviveu, mas a reentrada ficou aguardando mesa nessa execução. Não foi registrada como reconexão bem-sucedida. Os testes automatizados de reconexão passaram; homologação real continua necessária.
- Não executados: Android físico/app instalado, Windows nativo, atualização de um PWA instalado real, WebRTC entre aparelhos independentes, a composição original do usuário ou alteração/publicação em produção. Modos browser/standalone e sinal antigo são simulados em testes de unidade. Não há nova prova de ICE desta etapa.

## Reprodução local sem produção

Na raiz de um checkout descartável:

```sh
npm --prefix campaign-director run check
npm --prefix campaign-director test
node campaign-director/scripts/check-integration.mjs
node campaign-director/tests/fixtures/live-visual-compat-demo.mjs /tmp/cris-b4-qa
```

O gerador cria um projeto descartável em `/tmp/cris-b4-qa/public`, com mock de identidade/storage backend e transporte simulado explicitamente identificado. Sirva essa pasta em localhost com seu servidor estático. Abra `room-qa.html?case=teste-unico` para as cores e WebM; abra `parity.html`, conecte a mesa fictícia, apresente e pause em 2 s. Não publique as fixtures.

Para a comparação anterior, execute o mesmo gerador com um terceiro argumento apontando para um checkout separado de `1d9d1e2`. Use contas/cases inéditos em cada rodada para que a vinculação persistida de uma fixture não direcione o jogador à campanha de outra rodada. Nenhum dado real precisa ser apagado.

## Homologação curta Windows + Android

1. Preparar uma origem HTTPS **de teste já isolada**, com este commit e as cópias sincronizadas; usar ambiente de dados/contas e campanha fictícios. Não apontar para campanhas reais nem publicar sobre produção. A implantação não foi realizada nesta tarefa.
2. No Windows, abrir o Director/quadros com mestre de teste. No Android, comparar navegador e app instalado no mesmo endereço de teste. Registrar versão Android/browser e se é PWA ou WebView. Não desinstalar, limpar dados nem sair da conta para “resolver” a falha.
3. Entrar pelo convite/código, conferir sala, escolher cada cor, fechar/reabrir e conferir a seleção/cursor remoto. Conferir apenas uma presença por jogador. No diagnóstico do mestre, comparar `build=live01b4`, `version=4`, `verified=true`, `boardSynced=true`, ambiente e ausência de `module-unavailable`. Build anterior/unknown orienta atualizar o CRIS e reabrir a mesa, sem apagar dados.
4. Apresentar uma imagem simples pela primeira vez e depois a composição com WebM. Verificar recebimento → preparo → pronto → apresentando; confirmar a rotação sugerida, enquadramento 16:9, mídia completa e motivo legível de qualquer falha. Testar fallback estático quando o decoder não suportar a mídia, sem confundir fallback com vídeo reproduzido.
5. Usar a mesma composição/configurações no Studio, quadro local e remoto, pausada no mesmo instante. Conferir câmera e iluminação nas bordas. Repetir em portrait e landscape; efeitos não devem desaparecer. Fullscreen/orientação dependem do suporte/permissão do navegador e não devem impedir o play.
6. Substituir, encerrar e retornar ao quadro. Derrubar/restaurar a rede e reabrir o app durante/depois da apresentação; conferir a sala, presença, quadro/imagem íntegros e que sessão encerrada não revive. Testar que jogador não inicia apresentação nem assume identidade de mestre.
7. Se Celine falhar novamente, obter imediatamente **Mesa compartilhada → Configurações da mesa → Diagnóstico avançado** no mestre e o aviso curto no cliente. Comparar seu `id`, build, capacidade, `verified`, `boardSynced`, phase/failurePhase/code/errorType e bytes/tempos com o participante que funcionou. Não enviar credenciais, URLs assinadas ou mídia privada.

Critérios pendentes para considerar a compatibilidade homologada: primeira reprodução no app Android real, WebM/fallback com registro correto, atualização preservando dados, reconexão real, comparação da composição original e causa identificada da falha específica quando os diagnósticos estiverem disponíveis.
