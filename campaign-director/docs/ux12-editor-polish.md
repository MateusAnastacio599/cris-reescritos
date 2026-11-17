# UX-12 · Refinamento do editor e do dock Spotify

Base `83fff164e5765ca0d1774d1492dcb37b2c4c00f6`. Branch `feature/ux-12-editor-polish`.

## Editor

- O trecho selecionado pode receber negrito, itálico, cor e destaque em vários blocos consecutivos do mesmo trecho editável. O editor mantém os tipos e números dos blocos, os links internos e a direção da seleção. A operação registra uma alteração na cena e aciona o autosave existente.
- Cada alteração é preparada fora do documento. Ela só é aplicada quando a sintaxe inline do CRIS mantém o mesmo conteúdo e os mesmos estilos após a conversão. No roteiro externo, o editor também confere se o Markdown mantém o tipo e o conteúdo de cada bloco. Por exemplo, retirar o negrito de um parágrafo que contém apenas `# título literal` exporia um marcador de título. Nesse caso, toda a operação é recusada.
- A alça permite reordenar ou transferir blocos entre colunas do mesmo layout, com indicação antes ou depois da linha. O botão **Adicionar bloco** também serve como destino ao final da coluna ou em uma coluna vazia. O menu continua oferecendo a transferência. O modelo move o bloco inteiro e o histórico restaura o endereço do bloco e, quando disponível, o cursor original, inclusive dentro de um Recolhível rico.
- Ctrl+A usa o trecho editável ativo. Os atalhos de transformação e link respeitam uma seleção protegida. As setas do menu também alcançam ações de movimentação e outros comandos.

## Spotify

A linha decorativa superior fica oculta durante uma faixa Spotify. Capa, título e artista usam a área disponível, com reticências e o texto completo no tooltip. Os botões anterior e próximo continuam visíveis em telas estreitas. O ajuste é localizado à apresentação do dock.

## Verificação

- `npm run check` aprovado e `npm test` com 312 testes aprovados, incluindo os 308 da base. Os testes de autenticação no Node continuam passando a URL explicitamente, conforme a interface existente.
- A cena em `tests/fixtures/ux12-editor.html` exercita formatação parcial em três blocos, direção da seleção, cores combinadas, links, histórico, teclas de edição, bloqueios entre colunas, transferência e ordenação, cue, reabertura e backup. O importador roda em um worker da cena fictícia com armazenamento isolado. Servir a pasta `campaign-director` por HTTP e usar **Testar UX-12**. A validação de largura estreita pode ser repetida com viewport de 390 px.
- Chrome desktop e largura simulada de 390 px aprovados. No desktop, também foram exercitados seleção e arraste com o mouse, seleção com Shift e setas, cópia com quebra entre blocos e reabertura após recarregar.
- Faixa Spotify simulada em 1180, 850, 680 e 390 px. Metadados extensos ficaram dentro do dock. O reflow também foi verificado com zoom simulado de 150% e 200%. Play/pause, anterior, próxima, volume, seek, repetição e parar acionaram os comandos esperados na simulação.

## Limitações

O arraste usa o suporte nativo do navegador. Em telas sensíveis ao toque, a transferência pelo menu é a opção disponível para validação física. A formatação em vários blocos continua restrita a um trecho consecutivo, respeita os limites de colunas e Recolhíveis e rejeita combinações sem representação fiel no Markdown existente. Tachado, código e inserção de links continuam com o escopo anterior. Zoom nativo do navegador, aparelhos físicos, autenticação Spotify real e reprodução pelo SDK ficaram fora da validação.
