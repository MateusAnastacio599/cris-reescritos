# LIVE-01A.1 — investigação e validação, 25/11/2026

Continuação da branch `fix/live-01a-board-multiplayer-stability`, PR #24, sobre `dde353d4e0b004c5344579871efeede42c5755e0`. O checkout anterior foi encontrado com trabalho não commitado e aproveitado. A LIVE-01A não foi refeita. **Ainda não homologada para mesa real; LIVE-01B bloqueada.** Sem merge, publicação ou alteração de campanha real.

## Conclusão sobre o bloqueio WebRTC

O bloqueio foi reproduzido no navegador disponível **antes de qualquer pacote LiveWire**. O problema também ocorre com duas `RTCPeerConnection` nativas na mesma página, sem CRIS, PeerJS ou servidor de sinalização. Isso demonstra que este ambiente tem uma limitação reproduzível; não demonstra a causa do incidente original com Matias nem elimina outros defeitos em redes externas.

Uma conclusão anterior, “zero candidatos”, era incompleta: há candidatos nas estatísticas internas, mas não são disponibilizados para troca. Não houve correção de rota ICE comprovada. Não foi instalado TURN, mudada a rede ou introduzida infraestrutura adicional.

| Evidência no Chrome disponível | Nativo sem STUN | Nativo com STUN público | Quadro com PeerJS 1.5.4 |
|---|---|---|---|
| Oferta e resposta aplicadas | Sim | Sim | Sim |
| Signaling final | stable | stable | stable |
| Gathering final | complete | complete | complete |
| Eventos com candidato não nulo | 0 | 0 | 0 nos dois lados |
| Eventos de fim de coleta | 2, um por PC | 2, um por PC | 1 por PC |
| Candidatos locais em getStats | 2 por PC | 2 por PC | 2 host por PC |
| Candidatos no SDP local/remoto | 0 / 0 | 0 / 0 | 0 / 0 |
| Candidatos remotos em getStats | 0 | 0 | 0 |
| ICE / PeerConnection | new / new | new / new | new / new |
| Canal / timeout | não abriu, 8 s | não abriu, 8 s | connecting, encerrado aos 20 s |

O teste nativo instala listeners antes de criar a oferta e enfileira candidatos até a descrição remota estar pronta. O observador do quadro usa `addEventListener`, preservando os handlers de negociação do PeerJS. A inspeção do código distribuído de PeerJS 1.5.4 confirmou que sua PC é criada antes de a conexão ser devolvida e que `onicecandidate` encaminha candidatos não vazios à sinalização. O mesmo sintoma na API nativa afasta a hipótese de que somente a fila LiveWire ou o handler do CRIS causaria esse bloqueio.

A configuração efetiva herdada de PeerJS já contém STUN e URLs TURN padrão do fornecedor: resumo observado de 2 entradas, 1 URL STUN, 2 URLs TURN, política `all`, pool 0. Credenciais, endereços e URLs não entram no diagnóstico. Isso **não prova disponibilidade, autenticação ou funcionamento desses servidores**, nem recomenda suas credenciais padrão como infraestrutura própria.

Permanecem abertas: políticas/restrições do navegador automatizado, acesso às interfaces de rede e entrega de candidatos pelo ambiente. Em outras redes ainda precisam ser avaliados firewall, NAT, disponibilidade STUN/TURN e sinalização. Sem evidência externa, não se atribui a causa a nenhuma delas.

## Correções implementadas

- Observador separado registra signaling, gathering, ICE, PeerConnection, DataChannel, duração, erros tipados/códigos numéricos e resumo da configuração **real** de `getConfiguration()`.
- Contagens provenientes de eventos, SDP e `getStats()` ficam distintas. Observação tardia ou PC criada depois não vira automaticamente “sem candidatos”. Classificação específica `ice-candidates-not-emitted` cobre a discrepância observada. Sem SDP bruto, IPs, fingerprints, tokens, nomes ou IDs de conta nos eventos.
- Listeners e polling são removidos no fechamento; eventos limitados a 120 e traces recentes a 8. Timeout conserva o último diagnóstico.
- Corrigido o retry quando PeerJS já marcou `destroyed` antes do evento `close`. Callback de encerramento intencional/geração antiga continua sem reiniciar a sala.
- Heartbeat de sessão errada não renova presença. Participante moderno só fica online depois do snapshot aplicado/confirmado; desconexão ICE deixa a presença offline. Um `full` rejeitado do jogador não torna sua presença sincronizada.
- Transporte durável mantém fragmentação, limites, SHA-256, cache confirmado, ACK após aplicação, retries e ordem FIFO. A fila também tem orçamento de caracteres (64 Mi) e a fila de fragmentos recebidos é limitada.
- Quando os dois lados negociam `wire:3`, `cur`, `fx` e `pose` usam via lógica independente, no mesmo DataChannel. Agregação a cada 32 ms; coalescência por ator, tipo e barreira durável; últimas posições por objeto. Lotes grandes são divididos para respeitar 12.000 caracteres, sem truncar as posições finais.
- Campo `after` vincula poses à sequência durável precedente. Pose que ultrapassa um snapshot pode aparecer imediatamente e ser reaplicada após esse snapshot; não sobrescreve operação durável posterior.
- Backpressure consulta `bufferedAmount` (limiar de 256 KiB) e fila interna PeerJS. Fila transitória limitada a 256 entradas, até 1.024 posições por entrada e 8 envios por ciclo. Saturação que perderia movimentos finais causa falha explícita/resincronização; não confirma duráveis descartados.
- Aplicação global serializa mutações de todas as conexões e consolida poses durante render assíncrono. Cursores/lanternas não aguardam esse render. Isso protege a aplicação assíncrona de uma imagem enquanto outro jogador se move.
- Cliente sem `wire:3` mantém o caminho ACK compatível da versão 2, com coalescência por ator; não recebe pacotes novos. O modo legado explícito mantém suas limitações anteriores.
- As três cópias do motor, transporte e novo diagnóstico são idênticas. Os módulos de CINEMATIC-01.6, Audio Engine, dados e manifestos de produção não foram alterados.

A via transitória continua usando um DataChannel confiável/ordenado: não elimina bloqueio SCTP causado pela rede, nem evita pausa de thread durante serialização/hash de um arquivo enorme. Ela remove a espera artificial pelo ACK da imagem inteira. Não é um segundo transporte nem uma promessa de baixa latência em qualquer rede.

## Medição antes e depois

Reprodução a partir de `campaign-director/`:

```sh
node tests/fixtures/live-wire-benchmark.mjs
```

O benchmark importa a implementação remota original de `dde353d` com `git show` e a compara com a atual. São DataConnections **simuladas**, atraso de 4 ms por direção, SHA-256 real em Node 24; não são clientes WebRTC nem redes independentes. Arquivo sintético base64, não medição de decodificação PNG. Saída completa: [validation/live-01a1-benchmark.json](validation/live-01a1-benchmark.json).

| Medida | Antes, wire 2 | Depois, wire 3 |
|---|---:|---:|
| 3 destinatários simultâneos, 1.200.000 caracteres de mídia por cliente | mesmo cenário | mesmo cenário |
| Espera do cursor desde enfileiramento até aplicação | 968 / 951 / 951 ms | 38 / 38 / 38 ms |
| Imagem aplicada desde início do cenário | 958 / 970 / 982 ms | 903 / 908 / 915 ms |
| ACK máximo por destinatário | sem contador anterior | 21,4 / 25,6 / 22,6 ms |
| Retransmissões nesse cenário | sem contador anterior | 0 |
| Pico de heap do processo observado | 24 MiB | 24 MiB |

Limite próximo do máximo: 25.165.760 caracteres sintéticos, um destinatário, cursor em 173 ms, imagem aplicada em 18.584 ms, ACK máximo 217,4 ms, hashing acumulado 155,7 ms, pico de heap do processo 157 MiB, zero retries. O custo de serialização/cópia de arquivo grande continua material. Heap é o pico observado por amostragem de um processo que executa os cenários sequencialmente, não memória isolada de cada jogador nem de um navegador. Os valores de tempo variam com agendamento/carga; não constituem SLA.

## Validação executada

- `npm test`: **490/490**, incluindo 40 regressões novas nesta continuação e os 450 testes anteriores.
- `npm run check`: aprovado.
- `node scripts/check-integration.mjs`: aprovado.
- `git diff --check`: aprovado.
- Regressões cobrem diagnósticos sem dados sensíveis, candidatos anteriores ao observer, PC tardia, canal, prioridade negociada, três atores, barreiras, posição final de 200 objetos, backpressure, ACK perdido, FIFO, buffers/fechamento, aplicação entre conexões, presença/heartbeat e compatibilidade. Igualdade das três cópias inclui o novo módulo de diagnóstico.
- Chrome real: entrada no quadro fictício; sinalização real; SDP/ICE/timeout; teste nativo com/sem STUN; PNG adicionado pelo fluxo nativo preservando sala, 2 pins e 1 fio. Imagem local passou de 1 para 2; esse quadro descartável já tinha um PNG de execução anterior, não foi limpo para mascarar isso.
- Última versão do diagnóstico exibiu `ice-candidates-not-emitted`, 2 candidatos locais nas estatísticas e 0 eventos/SDP/candidatos remotos. O participante não apareceu online.
- `sessionName` diferente produziu os mesmos marcadores de cookie, localStorage e IndexedDB; somente sessionStorage diferiu. **Não foram classificados como clientes independentes.**

Não foi estabelecido DataChannel real, aplicada imagem remotamente, medida latência WebRTC, nem homologado mestre + três jogadores isolados. Windows/Android físicos, redes diferentes, OBS, kick/lotação e recuperação de edições pessoais não confirmadas continuam pendentes em rede real. O roteiro para executar esses testes está em [live-01a1-manual.md](live-01a1-manual.md).

## Segurança e liberação de LIVE-01B

`metadata.userId` continua sendo identidade declarada, sem prova autenticada de associação à campanha. O diagnóstico diz `declared-unverified`; ter rota ICE, receber ACK e aparecer online não autentica ninguém. A limitação já existente não foi declarada resolvida.

Antes da LIVE-01B: mestre e três jogadores realmente isolados precisam abrir canais, receber uma imagem, mover objetos e cursores durante uploads, reconectar mantendo sala/presença/itens/pins/fios e passar pelos controles de conteúdo oculto, dados antigos, áudio e Cinematics locais. É necessário validar a identidade/associação à campanha antes de distribuir conteúdo privado; resolver também a recuperação de operações pessoais ainda não confirmadas. Falha ou ausência de evidência mantém o gate fechado.

## Arquivos e preservação

Produção preparada para revisão apenas: `quadro/board-live.js`, `quadro/board-live-diagnostics.js`, `quadro/quadro-cris-v7.js`, e suas cópias em `campaign-director/integration-main/quadro/` e `campaign-director/dist/cris/quadro/`.

Testes/fixtures: `tests/board-live-reliability.test.js`, `tests/board-live.test.js`, `tests/fixtures/live-board-demo.mjs`, `live-board-qa.js`, `live-rtc-probe.js`, `live-wire-benchmark.mjs`. Documentos e benchmark ficam em `docs/`. Nenhuma migração, dependência ou configuração de infraestrutura foi adicionada. As fixtures usam somente identidades fictícias e não devem entrar no site de produção.
