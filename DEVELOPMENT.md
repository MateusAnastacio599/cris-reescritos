# CRIS — acompanhamento das correções

## 2026-11-09 — escopo delimitado

Base persistida: Sites `4915d46` (versão 45); GitHub main `bbf702e`.
As alterações anteriores desta rodada estavam no ambiente temporário e ainda não tinham sido publicadas. Foram conferidas e reaproveitadas. Não houve alteração nos dados da campanha.

### Navegação e interface
- `cris.js` e `case-archive.js`: distinguir navegação interna restaurada de links explícitos para conteúdo; limpar investigação/documento/evidência ao voltar ao briefing. Fechar documento mantém a identificação da navegação interna.
- `quadro/board-session.js`: ícone SVG no botão de menu existente.
- `quadro/board-integration.css`: dimensões explícitas do sino e alinhamento do menu; painel nativo responsivo.
- Testes direcionados de navegação e medidas móveis: resultados registrados ao finalizar.

### Objetos prioritários
- Reutilizar `#props` e os controles nativos; remover diálogo alternativo de áudio e legenda sobreposta.
- Manter os campos e botões de preparação do mestre fora do painel do jogador.
- Preservar legenda nativa e estado pessoal sem recriar itens excluídos na publicação.
- Auditoria anterior de renderização/permissões dos 210 tipos: aprovada; não implica validação de cada interação. Não repetir sem mudança relevante.

### Limites e próximos trabalhos
- Não foram validadas todas as combinações de objetos, enigmas, mídias externas ou todos os aparelhos físicos.
- Não houve envio de notificações, redefinição de senha ou alteração narrativa.
- Após as entregas desta rodada, parar. Demais módulos seguem em etapas separadas.
