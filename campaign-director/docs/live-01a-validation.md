# LIVE-01A — implementação para revisão

**NÃO homologada para sessão real. LIVE-01B suspensa. Sem merge ou publicação.**

Base `main`: 9bfacc78afc374732ceb8a5b9fea57f16a8b751c, incluindo CINEMATIC-01.6 / PR #23. Causa exata da sessão original com Matias e a suposta relação com upload não foram reproduzidas; faltam registros daquela sessão.

## Evidências e correções

- Harness executou Mr original: 3 chamadas criam 3 conexões; close da primeira invalida ready da nova. Agora há dial único, retry com backoff e callbacks/fila vinculados à conexão e geração.
- Código fixo CASO26107 confirmado por inspeção. Salas novas têm 12 caracteres aleatórios criptográficos, persistidos por campanha. Link novo altera só a sala atual. Conflito nunca toma outra aba.
- Presença separada de nome/conexão. Política explícita: **primeira sessão ativa da conta é mantida; segunda aba é recusada e precisa reconectar depois que a primeira fechar**. Contas com mesmo nome não são agrupadas. Não há disputa automática entre abas.
- Entrada aceita códigos de 6–32 caracteres. `Link antigo` reabre explicitamente CASO26107, com confirmação e aviso. qi-sala não é apagada. Sem diretório de salas no servidor não se pode redirecionar link antigo entre computadores; compartilhar novo link é recomendado.
- Novo transporte: fragmentos de 12.000 caracteres, SHA-256 do pacote e do arquivo, ACK após aplicação, 10 s por ACK, até 2 retransmissões, fila limitada, cancelamento e reconexão com snapshot. Limites: 32 Mi caracteres por pacote, 24 Mi caracteres por data URL (não são MiB binários). Imagem raster/áudio base64; URL externa/SVG bloqueados.
- Hash/ID só entram no cache confirmado depois do ACK. Mesmo ID com bytes novos reenvia; repetição/reconexão reutiliza cache existente. Recarga completa não presume mídia ainda disponível. Cliente antigo usa protocolo legado, **sem garantias novas de ACK/integridade**.
- Projeção pública compartilhada entre snapshot e updates remove itens ocultos, descendentes, pins e fios relacionados. Mudanças pessoais preservam pins/fios ocultos no mestre, que são filtrados novamente na redistribuição. Jogador não envia full/glob, mídia arbitrária ou comando Cinematic, nem apaga objeto do mestre. Regras nativas por objeto permanecem responsáveis pelas interações.
- Hooks posteriores (OBS/cor/heartbeat/kick/lotação) passam pelo mesmo canal. Watchdog antigo só atua no legado. Falha não deixa fila permanentemente rejeitada.
- Diagnóstico discreto do mestre: eventos limitados, contagem, ICE e bytes/mídia; sem tokens, códigos de sala, IDs de usuário ou payloads nos eventos registrados.

## Segurança e recuperação ainda pendentes

Login Supabase protege o aplicativo; `metadata.userId` do PeerJS é uma **declaração, não uma prova autenticada para o anfitrião**. Presença não concede autorização. Link aleatório é uma capacidade de entrada, não autenticação de membro. Revisar identidade autenticada antes de homologar cenário adversarial/distribuição remota confidencial. Este PR não promete autenticação multiplayer integral nem auditoria de todos os campos de preparação.

Edições pessoais ainda não confirmadas antes de desconectar precisam de teste/estratégia de recuperação; o snapshot do mestre continua autoritativo. Não foi criada migração de dados nem limpo armazenamento de campanhas.

## Testes automatizados

18 regressões em `tests/board-live.test.js`: salas; 3 contas e nomes iguais; aba duplicada; dial; callbacks antigos; reinício; campanha errada; conflito; lease; fragmentos; ACK perdido; falha de aplicação; hash/tamanho/URL inválidos; cancelamento; cache; substituição com mesmo ID; projeção pública; contribuições pessoais; pins ocultos; igualdade das três cópias.

DataConnections desses testes são **simuladas deterministicamente**. Não são prova de WebRTC entre máquinas. Logs finais de npm test/check acompanham o pacote.

## Chrome real: bloqueio concreto

Fixture `tests/fixtures/live-board-demo.mjs`, somente em diretório descartável, sem contas/campanhas reais. Motor e PeerJS 1.5.4 reais; sem iframes de teste.

- Mestre abriu com 2 post-its, 2 pins, 1 fio. PNG adicionado pelo input/handler nativo apareceu, sem mudar sala/ligação: validação **local** apenas.
- Sinalização abriu (`peer-open`); DataChannel permaneceu `connectionState=new`/`iceConnectionState=new`, seguido de `connect-timeout`.
- Erro exato: `ERROR PeerJS: Error: Could not connect to peer qimesa-H6TRMDFTCT74`.
- Marcador de localStorage comprovou que `sessionName` no navegador disponível NÃO isolou contextos. Duas abas não foram classificadas como clientes independentes.
- Tentativa de janela anônima no desktop disponível não produziu contexto utilizável. Uma recarga controlada obteve diagnóstico atualizado. Não foram instalados navegadores, trocada rede, criado servidor Peer/TURN ou reconstruída infraestrutura. Jogador de teste fechado ao concluir.

| Critério | Evidência | Estado |
|---|---|---|
| Conexões concorrentes/callbacks antigos | Harness original e regressões | Automatizado aprovado |
| 3 contas, nomes iguais, segunda aba, duas salas | DataConnections simuladas | Automatizado aprovado; rede real pendente |
| Fragmentos, integridade, ACK, falha e cache | Testes com perda controlada | Automatizado aprovado; rede real pendente |
| Adição de imagem sem mudar sala/pins/fio | Chrome, handler nativo | Local aprovado |
| Receber/mover/substituir/excluir imagem remotamente | DataChannel não abriu | Não validado |
| Recarga/suspensão, OBS, kick/lotação em rede | Infra indisponível | Não homologado |
| Arquivos antigos/fichas/áudio/Cinematic | Suíte existente; fontes fora do escopo preservadas | Sem mudança intencional; sessão real pendente |
| Clientes isolados, 390 px e aparelhos físicos | Sem contextos isolados utilizáveis | Não homologado |
| Cinematic remota | Gate 01A não cumprido | Não implementada |

Exportação de campanhas, áudio contínuo durante transferência real e dispositivos físicos não foram validados manualmente. Não há medição de tolerância temporal remota.

## LIVE-01B e próximo caminho

Não implementada; nenhum PR 01B. isMaster do receptor local, player, imagens e CINEMATIC-01.6 intactos. Não foi exposta biblioteca Cinematic a jogadores.

Revisar este PR draft; validar 01A com perfis/contas realmente separados e sinalização/ICE disponíveis; revisar prova de membro da campanha. Só então iniciar comandos/mídia Cinematic, confirmação individual e início coordenado.

## Roteiro manual (campanha demonstrativa)

1. Mestre + 3 jogadores em perfis separados; dois computadores quando disponíveis. Use novo link e confira 1 presença por conta. Nomes iguais em contas distintas devem continuar distintos. Segunda aba deve receber aviso.
2. Adicione PNG/JPEG, mova, substitua e exclua com clientes conectados. Confira hashes/bytes, sala, pins/fios. Repita sem retransmitir mídia já confirmada.
3. Interrompa upload, reconecte, recarregue, feche sem sair e reinicie o compartilhamento. Teste duas mesas e link antigo explicitamente. Pacotes antigos não devem ressuscitar estado.
4. Itens ocultos e seus pins/fios não devem aparecer nem ser apagados por contribuição pessoal. Confira post-it, marcação, fita, pin/fio e interação nativa.
5. Confira OBS, cor, limite/kick, áudio local contínuo, arquivos salvos e backup. Registre falhas antes de avançar à 01B.

## Fontes e integração

GitHub Pages publica a raiz; quadro principal em `quadro/`. Cópia efetiva do Director em `campaign-director/dist/cris/quadro/`, kit em `campaign-director/integration-main/quadro/`. Três motores e módulos sincronizados e comparados por teste. Caminhos específicos do receptor Cinematic não foram sobrescritos. Lista exata de arquivos e commits no pacote/PR.
