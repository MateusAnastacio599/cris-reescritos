# LIVE-01 — auditoria inicial (24/11/2026)

Base: `main` 9bfacc78afc374732ceb8a5b9fea57f16a8b751c (PR #23 integrado). Checkout limpo; CINEMATIC-01.6 preservada. Não há DEVELOPMENT.md neste checkout.

## Fluxo observado antes da correção

1. `quadro/index.html` obtém identidade autenticada por CRISBridge/Supabase, carrega BoardSession e o motor `quadro-cris-v7.js`.
2. CRISBridge resolve a primeira campanha acessível por RLS; não há seletor de campanha no link ao vivo. Mestre sem `sala` é anfitrião; jogador utiliza `sala` ou CASO26107. Arquivo tem caminho independente e não deve conectar PeerJS.
3. `yr()` ignora o código salvo, substitui por CASO26107, abre `qimesa-CASO26107`. `unavailable-id` tenta tomar outra aba pelo BroadcastChannel qi-host, sem escopo.
4. Jogador usa `Os.me` aleatório por carregamento; nome do personagem é apenas `hello.name`. Participantes são enumerados por DataConnection, sem identidade lógica. O acesso ao link não autentica a identidade apresentada ao peer; autenticação do aplicativo não é uma prova de identidade para o anfitrião.
5. `Mr()` pode conectar repetidamente com o mesmo Peer. Timers de erro/close não são cancelados; callbacks não conferem conexão ou geração atual. `close` antigo coloca a nova sessão em not-ready. Peer host desconectado agenda reconnect sem conferir se foi substituído.
6. `full` inclui snapshot e todas as imagens/áudios dos itens visíveis; `ops` inclui alterações e bytes desconhecidos por conexão. `_imgs` é preenchido ANTES do envio; não há ACK de aplicação ou hash. PeerJS fragmenta internamente, mas não há orçamento/controle de fluxo da aplicação.
7. `mr()` aceita pacotes sem campanha, sessão ou sequência e aplica full/ops em fila. `full` não tem catch: falha deixa a fila rejeitada. Snapshots não incluem câmera, preservando a vista local; board pessoal de Arquivos segue outro fluxo.
8. BoardSession persiste o mestre na conta; jogadores ao vivo não gravam o snapshot do mestre. Armazenamento de imagens privadas (`board-assets.js`) é separado do transporte PeerJS; upload de Storage não troca a sala no código observado.
9. Cinematic: Director usa CinematicLink → BroadcastChannel local → receptor do mestre em board-cinematic.js → mesmo CinematicFrame. Guard isMaster é intencional. Não existe transporte remoto nem ACK de jogador. IndexedDB local não é acessível em outro computador.

## Evidência e hipóteses

Harness Node executando literalmente Mr original reproduziu: três chamadas abrem três conexões; close da primeira invalida ready da segunda. Código fixo, contagem por conexão e marcação prematura de mídia são confirmados por inspeção. A causa exata da sessão com Matias e a relação causal com upload NÃO foram reproduzidas; não há logs dessa sessão. Nomes iguais não provam duplicação de usuário.

## Fontes e deploy

GitHub Pages publica raiz do repositório. `quadro/` é o quadro principal. `campaign-director/dist/cris/quadro/` é a cópia integrada efetiva do Sites/Director. `campaign-director/integration-main/quadro/` mantém o kit de integração, não é um deploy independente. Os três motores têm SHA-256 idêntico na base. Correções compartilhadas precisam acompanhar os três; os caminhos de import da Cinematic são diferentes e não devem ser sobrescritos cegamente.

## Plano limitado e gates

LIVE-01A: isolar ciclo de vida PeerJS em módulo testável; sala aleatória por campanha com compatibilidade explícita para link antigo; um único dial/retry; callbacks/filas vinculados à geração/conexão; presença lógica separada de conexões; mídia com limites, fragmentos, integridade, ACK e retransmissão limitada; diagnóstico sem payloads/identificadores secretos. Exercitar clientes independentes e registrar limites de infraestrutura.

LIVE-01B só começa após estabilidade verificada da 01A. Não basta remover isMaster: precisa transporte autorizado mestre→clientes, mídia referenciada, ACK por cliente, cancelamento e início coordenado. Autenticação de participante (além do link-capacidade), sinalização/ICE/TURN e teste entre máquinas são limites a revisar antes de afirmar segurança remota integral. A identidade declarada pelo peer nunca deverá conceder poderes de mestre.
