# CINEMATIC-01.3 · Composição em camadas e parallax

Base obrigatória `34fd358e9258f02070fc6c117c43c6512647f3fe`. Branch `feature/cinematic-01-3-layered-parallax`.

## Preparação e apresentação

Em **Ferramentas → Cinemática**, selecione o fundo e abra **Camadas**. Adicione até quatro arquivos PNG ou WebP estáticos. Selecione uma camada na lista ou na composição e arraste-a com o mouse. Em uma tela de toque, a mesma região usa eventos de ponteiro. Os campos X e Y e as setas do teclado oferecem alternativas ao arraste. Shift + seta desloca em passos maiores.

A escala representa uma fração da largura do fundo. X e Y representam a posição do centro da camada no fundo. A lista organiza do fundo para a frente. **Para trás**, **Para frente**, **Camada visível** e **Excluir camada** atualizam o rascunho. A exclusão remove a camada selecionada do rascunho e mantém o fundo. Os arquivos compartilhados permanecem disponíveis para outras apresentações.

A posição, escala, ordem e visibilidade integram o modelo antes do salvamento. A prévia animada e a apresentação usam o mesmo player. Alterações pendentes continuam bloqueando **Apresentar**. **Duplicar apresentação salva** cria outro ID e IDs próprios para suas camadas, compartilhando as referências dos arquivos. As cues anteriores continuam apontando para a apresentação original.

## Modelo compatível

O esquema `scene.cinematic.version` permanece em 1. Cada item pode receber uma propriedade opcional `layers`. Apresentações antigas, inclusive com nomes de arquivos antigos sem extensão, continuam usando o caminho de imagem única. Nenhuma migração automática é executada.

```json
{
  "id": "apresentacao",
  "imageId": "image-<sha256 do fundo>",
  "layers": [
    {
      "id": "personagem",
      "name": "Personagem central",
      "imageId": "image-<sha256 da camada>",
      "x": 0.5,
      "y": 0.59,
      "scale": 0.23,
      "visible": true,
      "parallax": 1.1
    }
  ]
}
```

O exemplo mostra os campos da composição. Os campos de preset, intensidade, duração, encerramento e fades da CINEMATIC-01.2 continuam no mesmo item.

A ordem do array determina a ordem visual. X e Y ficam entre 0 e 1, a escala entre 0,1 e 2 e a intensidade individual de parallax entre 0 e 2. Os IDs de camada são únicos dentro da apresentação. O identificador reservado `background` é rejeitado.

## Movimento e proporções

A composição usa um plano de referência com a proporção real do fundo decodificado. O editor mostra esse plano completo. No quadro e na prévia, o plano preenche a área disponível com recorte central quando a proporção da janela for diferente. As imagens conservam suas proporções. Coordenadas e escalas persistidas permanecem independentes da resolução da janela.

Cada plano recebe sua própria animação Web Animations API, com o mesmo relógio, duração e preset. O fundo usa fator 0,35. As camadas usam a profundidade escolhida. Um valor 0 mantém o plano estático. O overscan do fundo cobre os extremos do deslocamento. Os dez presets existentes continuam disponíveis. Filtros comuns são aplicados ao conjunto e a atmosfera permanece sobre a composição.

A preferência local de movimento reduzido cancela as animações de todos os planos e conserva seus elementos e posições. A liberação explícita e reversível continua na janela. Os fades e o prazo de encerramento seguem o player existente.

## Mídia e limites

Os arquivos continuam no IndexedDB cinematográfico existente, identificados por SHA-256. Fundo e camadas entram na coleta de referências dos backups, inclusive camadas ocultas. Uma imagem compartilhada é exportada uma vez por hash.

Os limites desta entrega são quatro camadas adicionais, 12 MB por arquivo, 24 MB de arquivos únicos por composição e 24 megapixels somando as referências renderizadas. Cada camada adicional pode ter até 8 megapixels. Os lados das imagens de uma composição ficam limitados a 8192 px. A apresentação antiga de imagem única conserva seu limite de 40 megapixels.

Novos uploads verificam extensão, MIME e assinatura. A composição verifica hashes e dimensões antes de alocar imagens decodificadas. O navegador verifica a decodificação antes de salvar ou restaurar composições. JPEG com orientação que troca largura e altura é reconhecido ao conferir as dimensões decodificadas. PNG e WebP animados são recusados nas composições para manter o controle de movimento e do custo de reprodução.

A restauração resolve e valida todas as referências antes de escrever no armazenamento. Uma composição incompleta, corrompida ou acima dos limites impede a restauração. A suíte verifica que isso preserva o workspace e os arquivos já existentes. Imagens seguem separadas do Markdown e dos metadados da cena.

## Protocolo e cues

O canal local e as validações de conta, campanha, cena, sessão, destino, sequência e validade temporal continuam em vigor. O campo `image` transporta um Blob para apresentações convencionais ou um mapa restrito de hashes para Blobs em composições. O mapa deve conter exatamente os arquivos referenciados e respeitar o limite total. O quadro recebe os bytes locais e confirma o início depois de validar e decodificar a composição completa.

Carregamentos substituídos usam AbortController, invalidação por geração e liberação de URLs locais. Animações anteriores e observadores de tamanho são liberados na troca e no encerramento. As ações **Iniciar cinematic** e **Encerrar cinematic** continuam usando os IDs das apresentações. O carregamento de mídia da cue agora resolve o pacote completo antes de enviar o comando.

As duas distribuições do quadro usam os mesmos módulos compartilhados. Um teste compara seus adaptadores e a demonstração também executa a cópia em `campaign-director/dist/cris/quadro/`.

## Validação de 23/11/2026

`npm run check` aprovado. `npm test` aprovado com **355 testes**, preservando os 341 anteriores e acrescentando 14 regressões de camadas.

As regressões cobrem compatibilidade de metadados antigos, validação do modelo, limite de camadas, coordenadas, duplicação, referências compartilhadas, arquivos ocultos e ausentes, formatos e dimensões, limites de bytes e pixels, overscan, payload local, backup completo, rejeição antes de escrita, cancelamento de carregamento e os dois adaptadores do quadro. Os codecs de teste incluem PNG, JPEG e WebP transparente.

No Chrome, a cena demonstrativa tem um fundo de palco, plateia em primeiro plano e três personagens em imagens separadas. Os recursos são figuras geométricas originais de teste, incluídas nas fixtures.

| Verificação no navegador | Resultado |
| --- | --- |
| Desktop de 950 px | Preparação, edição, reordenação, ocultação, remoção na cópia, duplicação e cues aprovados |
| Viewport de 390 px | Percurso completo aprovado, com edição em uma coluna |
| Arraste real por mouse | Movimento observado em desktop e no viewport mobile. No mobile, X 56,94% e Y 65,17% permaneceram iguais depois de salvar e reabrir |
| Alternativa ao arraste | Setas e campos X/Y aplicaram a posição ao modelo |
| Parallax real | Entre aproximadamente 200 e 1500 ms, no quadro integrado, o deslocamento Y do fundo passou de 5,19 a -11,76 px, o dos atores intermediários de 8,90 a -20,16 px e o da plateia de 26,70 a -60,47 px |
| Prévia e apresentação | Mesma escala do fundo no mesmo instante da animação |
| Trocas por cue | Alternância rápida entre a composição original de quatro camadas e a variação de três camadas |
| Lifecycle | Encerramento manual, encerramento automático e reapresentação aprovados |
| Movimento reduzido simulado | Cinco planos estáticos, composição preservada e liberação explícita funcionando no quadro integrado |
| Imagem única antiga | Caminho v1 de uma imagem apresentado e encerrado no navegador |
| Snapshot investigativo | Igualdade integral antes e depois das operações do percurso |
| Áudio local | Ambientes `rain` e `room` continuaram ativos com o relógio avançando e volume geral 0,8 |

Os backups foram exercitados pelos testes automatizados usando as funções reais de exportação/importação. A detecção de falha do decodificador do navegador antes da escrita tem teste próprio. O percurso visual de backup pelo formulário geral aguarda conferência em mesa.

### Reproduzir a demonstração

A partir de `campaign-director/`, execute `node tests/fixtures/cinematic-demo.mjs /caminho/novo/demo` e sirva `public/` por HTTP local. Abra `layers.html` e use **Validar teatro em camadas**. Os links alternam desktop, 390 px e movimento reduzido com a cópia integrada do quadro. Depois da aprovação, **Apresentar composição** permite inspecionar o resultado.

A fixture utiliza conta fictícia, campanha de teste própria por aba e armazenamento demonstrativo. As ações continuam passando pelos componentes e controles reais do Director e do quadro. O arraste real por mouse foi conferido separadamente pelo navegador.

## Limites da validação

Os testes usam Chrome com conta fictícia e viewports simulados. Toque em aparelho físico, desempenho em celulares modestos, preferências reais do sistema operacional e Spotify conectado aguardam validação em mesa. A troca de orientação EXIF de JPEG tem teste automatizado, sem conferência em aparelho fotográfico. A comunicação continua local ao mesmo navegador e origem.

O posicionamento permanece relativo ao fundo. Janelas com proporções diferentes podem recortar as laterais da composição pelo modo de preenchimento. Não há troca individual de camadas durante uma apresentação ativa.

## Integração

O pacote contém um patch binário incremental sobre a base obrigatória, com as imagens de teste e os arquivos listados abaixo. Em uma cópia limpa da base, confira `git apply --check cris-cinematic-01-3.patch` antes de aplicar. A entrega aguarda revisão e integração.

## Arquivos alterados

```text
campaign-director/dist/cinematic-composition.js
campaign-director/dist/cinematic-cues.js
campaign-director/dist/cinematic-editor.js
campaign-director/dist/cinematic-frame.js
campaign-director/dist/cinematic-layers-editor.js
campaign-director/dist/cinematic-media.js
campaign-director/dist/cinematic-model.js
campaign-director/dist/cinematic-protocol.js
campaign-director/dist/cinematic.css
campaign-director/docs/cinematic-01-3.md
campaign-director/tests/cinematic-layers.test.js
campaign-director/tests/fixtures/cinematic-demo.mjs
campaign-director/tests/fixtures/cinematic-layers-qa.js
campaign-director/tests/fixtures/cinematic-theater/ator-direita.png
campaign-director/tests/fixtures/cinematic-theater/ator-esquerda.png
campaign-director/tests/fixtures/cinematic-theater/central.png
campaign-director/tests/fixtures/cinematic-theater/central.webp
campaign-director/tests/fixtures/cinematic-theater/palco.jpg
campaign-director/tests/fixtures/cinematic-theater/palco.png
campaign-director/tests/fixtures/cinematic-theater/plateia.png
```
