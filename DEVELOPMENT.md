# CRIS — acompanhamento das correções

## 2026-11-10 — escopo delimitado

Base persistida: Sites `4915d46` (versão 45); GitHub main `bbf702e`.
As alterações anteriores desta rodada estavam no ambiente temporário e ainda não tinham sido publicadas. Foram conferidas e reaproveitadas. Não houve alteração nos dados da campanha.

### Navegação e interface
- `cris.js` e `case-archive.js`: distinguir navegação interna restaurada de links explícitos para conteúdo; limpar investigação/documento/evidência ao voltar ao briefing. Fechar documento mantém a identificação da navegação interna.
- `quadro/board-session.js`: ícone SVG no botão de menu existente.
- `quadro/board-integration.css`: dimensões explícitas do sino e alinhamento do menu; painel nativo responsivo.
- Commit `3f91b16`: navegação inicial e controles mobile. Testes de navegação: 2 aprovados; preservam links explícitos e descartam restauração interna do acervo.

### Objetos prioritários
- Reutilizar `#props` e os controles nativos; remover diálogo alternativo de áudio e legenda sobreposta.
- Manter os campos e botões de preparação do mestre fora do painel do jogador.
- Preservar legenda nativa e estado pessoal sem recriar itens excluídos na publicação.
- Auditoria anterior de renderização/permissões dos 210 tipos: aprovada; não implica validação de cada interação. Não repetir sem mudança relevante.

### Limites e próximos trabalhos
- Não foram validadas todas as combinações de objetos, enigmas, mídias externas ou todos os aparelhos físicos.
- Não houve envio de notificações, redefinição de senha ou alteração narrativa.
- Após as entregas desta rodada, parar. Demais módulos seguem em etapas separadas.

### Entrega dos controles nativos
- `quadro/board-interactions.js`: política de controles do jogador aplicada ao inspector existente; remove o painel alternativo. Transporte do gravador e legenda nativa da fotografia preservados, sem configuração exclusiva do mestre.
- `quadro/quadro-cris-v7.js`: reprodução, pausa com retomada, rebobinar e parada pelos controles existentes; parada zera a posição. Fechamento continua nativo.
- `quadro/board-rules.js`: deltas pessoais condicionais; exclusão pelo mestre não ressuscita itens, edição posterior do mestre prevalece sobre a legenda antiga.
- `quadro/index.html`: integração da política. Imports relacionados atualizados para cache 338. Arquivos espelhados em `dist/cris`; caminhos distintos do integration-bridge preservados.
- Fixtures reutilizáveis em `tests/fixtures` e gerador `tests/generate-native-fixture.py`; artefatos QA gerados não integram a distribuição.

### Evidências de validação e limites
- Última execução direcionada: `node --test tests/initial-navigation.test.js tests/native-inspector.test.js tests/tape-transport.test.js` — 5/5 aprovados. Executa a lógica real de navegação e transporte, verifica permissões, legenda serializada, prevalência das mudanças e exclusões do mestre.
- Resultado anterior reutilizado: suite 284/284 aprovada antes do ajuste final de pausa/parada; não repetida. Verificação de sintaxe/assets aprovada após o ajuste.
- Inspeções anteriores reutilizadas: legenda nativa editável e visível na foto; transporte invertido e retorno à direção normal; inspector em 390/820/1280 px; sintonizadores nativos de TV e rádio abrem. Isso não certifica todas as interações de todos os objetos.
- A retomada da prévia no navegador foi bloqueada após interrupção. Investigação encerrada para evitar reconstruções repetidas.
- PENDENTE: validação visual final de menu/sino mobile e teste real dos botões físicos de pausa/retomada/parada após a última mudança. Login autenticado até briefing e sincronização entre dispositivos também não foram retestados.
- Não publicar nesta rodada. Preservar os commits e a versão de revisão; próxima ação limitada à validação acima antes de qualquer publicação. Não iniciar outra auditoria ampla.
