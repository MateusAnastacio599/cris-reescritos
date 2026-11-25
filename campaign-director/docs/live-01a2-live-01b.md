# LIVE-01A.2 + LIVE-01B — entrada de mesa e Cinematics remotas

Base: `05e8863912834f673cc22f61cd08b0e2f09d0f8c` (main, merge do PR #24, CINEMATIC-01.6 preservada). Branch `feature/live-01a2-remote-cinematics`. O PR #24 já estava integrado ao iniciar esta etapa; esta entrega usa um PR novo e único para revisar entrada e transmissão conjuntamente. Não houve merge, deploy ou acesso de escrita a campanhas reais nesta sessão.

O usuário relatou recebimento de uma imagem no celular com outra conta. Esse relato é aceito como evidência de comunicação em seu ambiente, sem equivaler à homologação completa ou a um teste desta branch.

## Entrada de mesa

- A Central CRIS agora abre `quadro/` para o jogador. Foi removido o link fixo que sempre impunha `?sala=CASO26107` e anulava a escolha anterior.
- Sem convite ou preferência, o jogador encontra um formulário com link/código, nome e botão **Entrar nesta mesa**. Não começa uma conexão a uma sala arbitrária antes da escolha.
- Convites gerados pelo mestre incluem `sala` e `campanha`. O jogador pode abrir o link ou colá-lo no formulário do app. Códigos formatados com espaços/hífens são normalizados.
- Preferência: `cris:live:binding:<userId>` em localStorage, com sala e campanha. Contas diferentes não compartilham a preferência. Não é autorização nem diretório confiável de membros.
- Ao abrir sem convite, o jogador recupera a última mesa. A campanha é revalidada por consulta autenticada/RLS antes de mudar o contexto do quadro, fichas, arquivos e sincronização. Um convite explícito prevalece sobre a preferência, se autorizado. Erro/revogação volta ao formulário com mensagem, sem prender a tela no carregamento.
- Código sem campanha consulta o registro de sala entre campanhas acessíveis; código ambíguo exige link completo. Preferência restaurada e link explícito distinguem campanhas que usem o mesmo código legado.
- **Trocar mesa** permanece no quadro, inclusive sobre a Cinematic. Abre um diálogo para link/código; cancelar preserva a sessão atual. Aceitar navega internamente no app e reinicia a conexão na mesa escolhida. Não há edição manual do endereço nem exclusão de dados da mesa anterior.
- A confirmação inicial de uma nova escolha usa sessionStorage apenas para completar a navegação interna uma vez; reaberturas posteriores exibem a mesa lembrada para confirmação.
- `CASO26107` continua aceito em links antigos e aparece como opção explícita **Mesa do caso atual**. O mestre continua podendo abrir o modo de compatibilidade. Não houve migração ou descarte de dados do caso.

O app instalado continua sendo o mesmo site em modo standalone. Não foram adicionados intents nativos, associação de domínio do sistema operacional ou uma extensão nova. Se o SO abrir um convite fora do app instalado, colar o link ou usar o código dentro do CRIS resolve a entrada.

## Reprodução local e remota

O receptor do mestre conserva BroadcastChannel entre Director e quadro local. O jogador **não** monta esse receptor. As duas pontas usam o mesmo `CinematicFrame`, incluindo câmera, FX, luz, timeline, WebM/fallback, fades, movimento reduzido e limpeza.

O receptor local informa início/encerramento ao `RemoteCinematics`. O envio usa as DataConnections PeerJS da mesa; controles pequenos passam diretamente pelo canal e os arquivos passam por uma instância dedicada de LiveWire, com escopo e sessão próprios, **no mesmo DataChannel**. Não há BroadcastChannel como transporte remoto nem servidor novo.

Descoberta local coleta respostas por 120 ms e prioriza o quadro efetivamente compartilhado/conectado. Isso evita que uma janela antiga/offline da mesma campanha capture o comando antes da mesa que possui jogadores. Clientes locais antigos, sem prioridade, continuam compatíveis.

### Contrato e limites

1. Um manifesto contém sessão aleatória, revisão monotônica, item e lista exata de arquivos com ID SHA-256, tipo e tamanho. Camadas `visible:false` são removidas antes da coleta de referências. Arquivos que só pertencem a camadas ocultas ou outras apresentações não são enviados.
2. O jogador responde com IDs faltantes. Cache em memória contém apenas arquivos previamente validados, até 24 MiB; arquivo com tipo/tamanho divergente é solicitado novamente.
3. Cada arquivo solicitado usa fragmentação, SHA-256 do pacote e ACK de aplicação do LiveWire. O receptor confere tamanho, MIME, assinatura do arquivo e ID/hash dos bytes antes de aceitar. WebM também passa pelo validador existente. Limites: 12 MiB por imagem, 8 MiB por WebM, 24 MiB por composição; orçamento de pixels e quantidade de camadas/vídeos continuam os do modelo.
4. Depois dos ACKs, o mestre pede reprodução. O jogador valida a composição completa e chama `CinematicFrame.show()`. Só informa **apresentando** após sucesso do player. Falhas não são convertidas em sucesso local/global.
5. Cancelamento fecha apenas o wire da Cinematic, conserva o quadro, descarta a preparação e envia controle de encerramento sem aguardar a fila de mídia inteira. Cache é liberado em até 30 s após terminar, imediatamente ao fechar a ferramenta, ou por troca de referências ao preparar outra composição.
6. Revisão e sessão impedem mensagens antigas de substituir uma apresentação nova. Reconexão recebe apenas a apresentação ainda ativa; depois de encerrada, não há replay.
7. Tempo é aproximado: o relógio do anfitrião é estimado no handshake e o player busca o instante corrente. Loops usam o instante do ciclo. Uma apresentação automática já terminada não é revivida se o carregamento demorar além de sua duração. Não há promessa de alinhamento por frame, compensação contínua de relógio ou sincronização de áudio.
8. Prova de anfitrião aguarda até 15 s; ACK usa os limites existentes do LiveWire; preparação completa tem limite de 180 s, encerramento 8 s e lease de recepção 45 s sem heartbeat. Esses limites não homologam rede lenta sem teste físico.

Estados por participante: **conectado → recebendo → carregando → apresentando → encerrando → encerrado**, ou **falhou**. Encerrado exige confirmação do receptor depois de limpar o frame; apenas enviar stop não conta como sucesso. O mestre vê o painel sobre a apresentação e o Director recebe um resumo por participante pelo vínculo local.

## Fronteira de confiança

O anfitrião gera chave ECDSA P-256 temporária, com chave privada não exportável somente em memória. Ao abrir compartilhamento, registra apenas chave pública, sala e expiração de 24 horas em `campaigns.settings.liveRoom`, preservando os demais settings e usando `updated_at` para detectar concorrência. As políticas existentes permitem essa escrita somente a GM/proprietário. Não há tabela, migração, Edge Function, dependência ou segredo privilegiado novo.

O jogador lê a chave via sua sessão Supabase e as regras existentes da campanha. Exige assinatura de um nonce novo, vinculado à campanha, sala e sessão DataChannel. Não aceita uma chave enviada pelo próprio peer como prova de mestre. Nenhum access token, senha ou chave privada é transmitido ao outro participante. Jogador não aceita controles/mídia antes da prova; no mestre, mensagens de jogador não podem iniciar ou encerrar apresentações.

A escrita descrita é comportamento da implementação quando o mestre abre compartilhamento, depois de revisar/testar esta versão. **Não foi executada contra campanhas reais nesta entrega.** Nenhuma política de produção foi alterada. Os testes de criptografia e rejeição são automatizados; a integração autenticada/RLS precisa ser exercitada em uma campanha de teste.

O mestre precisa reabrir o compartilhamento na versão nova para registrar sua chave. Falha de registro/validação bloqueia Cinematics remotas com estado de erro, preservando imagem/quadro e apresentação local. Clientes antigos sem o protocolo não recebem biblioteca/mídia arbitrária.

**Limitação preservada:** a identidade individual do jogador PeerJS ainda é declarada, como na LIVE-01A. Esta entrega verifica o anfitrião e restringe a mídia à apresentação visível selecionada; não cria tickets individuais de participação ou autenticação completa de cada peer. Não declarar resolvida a segurança integral de conteúdos confidenciais ou de presença adversarial.

## Validação

Resultados e procedimento reproduzível: [live-01a2-live-01b-validation.md](live-01a2-live-01b-validation.md).

## Arquivos principais

- `quadro/board-entry.js`: parser, vínculo, autorização de campanha e diálogo de troca.
- `cris.js`, `integration-bridge.js`, `quadro/index.html`, `quadro/quadro-cris-v7.js`, `quadro/board-polish.css`: acesso integrado, contexto e UI. Cópias de raiz/kit/Director atualizadas, preservando os caminhos próprios da distribuição do Director.
- `campaign-director/dist/cinematic-remote.js`: protocolo remoto, prova de anfitrião, mídia, estados e ciclo de vida.
- `quadro/board-cinematic.js` e espelhos: mesmo frame para os dois papéis, receptor local exclusivo do mestre e painel de participantes.
- `campaign-director/dist/cinematic-protocol.js`, `cinematic-link.js`: eventos locais, estados remotos e seleção do quadro compartilhado.
- `quadro/board-live.js` e duas cópias: roteamento de controles e fechamento por conexão, preservando LiveWire, projeção pública e transporte da LIVE-01A.
- Testes: `board-entry.test.js`, `cinematic-remote.test.js`, `live-next-integration.test.js`; fixtures de entrada, PeerJS e player.

O renderer `cinematic-frame.js`, os módulos de efeitos/câmera/mídia e Audio Engine não foram modificados. As fixtures não devem ser publicadas em produção.
