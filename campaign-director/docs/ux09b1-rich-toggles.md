# Recolhíveis ricos · UX-09B1

O roteiro continua salvo em Markdown. Um Recolhível antigo usa `<!--cris:toggle:v1 …-->` com `title`, `text` literal e `background` opcional. Abrir ou editar a cena mantém essa versão.

O marcador `<!--cris:toggle:v2 …-->` guarda o JSON abaixo em uma única linha. O serializador existente escapa os caracteres que poderiam fechar o comentário.

```json
{
  "title": "Entrada na Mansão",
  "background": "purple",
  "blocks": [
    {"type": "h1", "text": "O corredor"},
    {"type": "paragraph", "text": "O chão está **frio**."},
    {"type": "paragraph", "text": "*Há passos no andar de cima.*"},
    {"type": "paragraph", "text": "# exemplo"}
  ]
}
```

Os tipos internos aceitos são `h1`, `h2`, `h3` e `paragraph`. O `type` determina a estrutura. Só o Markdown inline do CRIS é processado dentro de `text`, então `# exemplo` em um parágrafo continua literal. O fundo usa a paleta da UX-09A. Fundos desconhecidos são omitidos e HTML bruto é escapado. Quando o marcador v2 tem JSON inválido ou estrutura incompatível, a linha inteira fica disponível como texto para recuperação.

## Disponível nesta etapa

- A leitura e a prévia interna do editor mostram os blocos em ordem, com negrito, itálico, cores e destaques. O Recolhível pode ser aberto e fechado nos dois modos.
- O editor mantém os controles externos do bloco. É possível alterar o título e o fundo, mover, duplicar ou excluir o Recolhível. Os blocos internos são somente leitura. A transformação para outro tipo fica indisponível para evitar perder os filhos.
- Alterar a cena e exportar ou importar um backup mantém o marcador e os blocos internos. Builds anteriores à UX-09B1 precisam da atualização para renderizar o v2 como Recolhível.

## Operações para a UX-09B2

1. Endereçar cada filho no modelo e implementar nele inserção, divisão, remoção e troca de tipo. Um filho editável deve ser sincronizado no seu próprio endereço, sem sobrescrever `title`, `background` ou blocos vizinhos.
2. Reaproveitar a formatação inline e o tratamento de colagem apropriado para um filho. Guardar a atualização no histórico da cena e enviar o Markdown resultante ao autosave. Validar foco, desfazer/refazer e colagem de vários parágrafos sem atravessar indevidamente os limites do Recolhível.
3. Caso seja oferecida uma conversão de v1, iniciá-la por ação explícita. Copiar o texto literal, suas quebras e seu fundo. Criar parágrafos com tipo explícito, sem interpretar `# exemplo` como título. Antes de oferecer a conversão, validar também a preservação de marcadores inline que eram literais no v1, como `**texto**`.

## Edição disponível a partir da UX-09B2

Crie um novo bloco pelo menu **Adicionar bloco → Recolhível rico**. Dentro dele, use **Adicionar parágrafo** ou pressione Enter para dividir o bloco na posição do cursor. O menu ao lado de cada bloco interno permite escolher Texto, Título 1, Título 2 ou Título 3, ou excluir o bloco. Backspace no início une blocos do mesmo tipo e remove blocos vazios, mantendo a edição dentro do Recolhível. Entre blocos não vazios de tipos diferentes, Backspace leva o cursor ao bloco anterior e preserva os dois tipos.

A formatação usa a barra de seleção existente. Os blocos internos usam o mesmo histórico e autosave da cena. A seleção pode ser formatada ou substituída dentro de um bloco interno. Operações que atravessam blocos de um Recolhível rico são bloqueadas. Para colar dentro dele, use títulos e parágrafos. Uma colagem que contenha blocos especiais é recusada por inteiro.

A sintaxe `cris:toggle:v2` permanece a mesma. A criação de um novo Recolhível rico é explícita. Recolhíveis `v1` continuam disponíveis pelo comando **Recolhível** e preservam seu texto literal.
