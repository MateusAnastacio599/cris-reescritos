# UX-11 · Colunas editáveis

## Uso

- Abra **Adicionar bloco → Colunas** e escolha duas ou três colunas. O botão **Adicionar bloco** de cada coluna insere conteúdo no seu próprio trecho do roteiro.
- Use o menu de um bloco para movê-lo para outra coluna ou reordená-lo dentro da mesma. O arraste pelo controle do bloco permanece restrito à sua própria área editável.
- **Transferir para coluna … e remover** preserva todos os blocos na coluna vizinha. **Desagrupar colunas** devolve os blocos ao roteiro em ordem, quando o Markdown externo consegue representá-los sem alterar sua estrutura. A ação é bloqueada com uma mensagem nos outros casos.
- Em uma área suficientemente larga, arraste a divisória ou ajuste com as setas. Shift + seta muda cinco pontos percentuais. O menu **Larguras** oferece sliders mesmo com as colunas empilhadas.
- Cada coluna tem sua própria entrada **Fundo da coluna**, com a paleta existente. Recolhíveis mantêm seus fundos próprios.

## Formato e compatibilidade

O marcador `<!--cris:columns:v1 …-->` contém JSON em uma linha, com `columns` de comprimento dois ou três. Cada coluna possui `width` em pontos percentuais inteiros, `background` opcional e um array `blocks` no modelo do editor. As larguras somam 100 e cada coluna tem pelo menos 20. Três colunas começam em 33/33/34. Alterar uma divisória redistribui somente a largura do par vizinho.

O leitor valida o layout antes de renderizá-lo. Um marcador inválido é mantido como texto recuperável. Markdown inline usa o sanitizador existente. A leitura renderiza os mesmos tipos de bloco e mantém a ordem quando a largura disponível manda empilhar. Documentos sem o marcador não passam por migração.

São aceitos parágrafos, H1–H3, listas simples e numeradas, citações, notas, divisórias, Recolhíveis v1/v2, tabelas e cues. Pistas, caixas de tarefa e colunas aninhadas ficam fora do layout. Os controles de pistas e caixas de tarefa ainda usam endereços do roteiro externo. Tabelas mantêm rolagem própria dentro da coluna. Notas internas permanecem no layout, inclusive no modo **Roteiro + Notas**.

## Endereçamento e histórico

Cada coluna reutiliza o `BlockEditor` e recebe seu próprio array de blocos. O editor da cena é dono dos observadores globais, do autosave e do histórico. Uma entrada de histórico pode identificar layout, coluna, bloco, célula, filho de Recolhível e seleção textual. Os campos de seleção e eventos fazem parte de uma única área editável por vez. Movimentação, adição, remoção e ajuste de largura alteram o modelo antes do salvamento.

## Validação

Sirva `campaign-director/` por HTTP e abra `tests/fixtures/ux11-columns.html`. A cena fictícia persiste localmente no navegador. **390 px** carrega a mesma cena com largura simulada. **Testar limites** monta uma seleção entre duas colunas e verifica se digitação, exclusão, recorte e colagem são impedidos.

No Chrome, foram verificados a criação dos dois layouts, arraste da divisória, ajuste por teclado, fundos, reordenação por menu, transferência entre colunas, remoção com transferência, desagrupamento, histórico, alternância leitura/edição e reabertura. Na largura simulada foram verificados o empilhamento, a ausência de rolagem horizontal da página, os sliders, o recorte local com restauração da seleção e os Recolhíveis v1/v2. A tabela, a cue e a pista externas ficaram intactas. O teste automatizado cobre exportação e importação do workspace. `npm run check` passou e a suíte aprovou 308 testes.

Gestos de toque, teclado virtual e arraste físico em celular ficam pendentes. A cue interna foi verificada pelo callback do editor na cena fictícia. A validação local não acionou uma integração de áudio em produção.
