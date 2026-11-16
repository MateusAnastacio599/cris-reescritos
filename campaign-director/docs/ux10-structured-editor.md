# UX-10 · Seleção e escrita no roteiro

## Como funciona

Parágrafos, títulos, listas simples ou numeradas, citações e notas consecutivos compartilham um espaço de seleção nativo. O modelo continua armazenando cada bloco separadamente. Ctrl+A seleciona somente o trecho textual atual. O arraste e Shift com as setas podem percorrer esse mesmo trecho. Tabelas, cues, pistas, divisórias, tarefas e Recolhíveis delimitam os trechos.

Cópia e recorte usam os blocos do modelo e os fragmentos selecionados das duas extremidades. A cópia oferece texto simples, HTML e um formato interno que conserva tipos, numeração e Markdown. Recorte, digitação sobre seleção, exclusão e colagem são registrados como operações no modelo, com um único passo no histórico. Enter divide blocos e Shift+Enter abre uma quebra no bloco atual. Backspace e Delete nas extremidades podem juntar blocos textuais sem consumir componentes vizinhos. O autosave e o backup usam o mesmo Markdown da cena.

Os Recolhíveis v1 e v2 continuam com campos próprios. Os filhos do v2 permanecem editáveis individualmente. A seleção pode cruzar visualmente uma barreira em alguns gestos nativos. Cópia, recorte e operações que alterariam esse intervalo são bloqueados.

## Limites

- Formatação inline e links podem ser aplicados dentro de um bloco. Para seleções entre blocos, a barra de formatação é ocultada.
- Arrastar texto selecionado para movê-lo fica desativado nesses trechos. Use recortar e colar. O controle existente para arrastar blocos continua disponível.
- Para entrada IME sobre seleção de vários blocos, a seleção é recolhida à âncora antes da composição. Testes com teclado virtual e gestos de seleção em aparelhos físicos ainda são necessários.
- A serialização existente pode normalizar espaços ou quebras vazias nas extremidades de parágrafos ao reabrir.

## Reprodução

Sirva `campaign-director/` via HTTP e abra `tests/fixtures/ux10-editor.html`. A cena é fictícia e persiste apenas no navegador. Use **Editar**, **390 px** e **Restaurar cena de teste** para repetir os cenários. **Testar limites** monta uma seleção que inclui todos os componentes especiais e verifica se digitação, exclusão, recorte e colagem foram bloqueados.

1. Arraste de “Alpha heading” até o parágrafo “Charlie italic ending”. Copie, recorte, digite sobre a seleção e desfaça. Repita com Shift e setas.
2. Cole um título, um parágrafo formatado e uma lista. Confira os tipos e a ordem após recarregar.
3. Divida um parágrafo com Enter, junte com Backspace e insira uma quebra com Shift+Enter. Use Delete no fim do campo anterior à tabela para conferir a barreira.
4. Use Ctrl+A no trecho longo após os componentes especiais. A cópia deve incluir a última linha sem incluir o título da cena.
5. Expanda o Recolhível v1 e confira o conteúdo literal. Edite um filho do v2, recolha, reabra e confira o fundo e o texto. Verifique a cue, a tabela e a pista.
