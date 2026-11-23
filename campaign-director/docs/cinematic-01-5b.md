# CINEMATIC-01.5B — Direção temporal e teatro vivo

Base de integração: `d90b3d380cbd7143ba60ea090a1212d98c074e13` (main, PR #21 / 01.5A).
Branch: `feature/cinematic-01-5b-direction-fx-timeline`.
Mudanças limitadas à Cinematic, assets, testes e demonstrações. Sem banco, Audio Engine, Markdown ou alteração de snapshot.

## Contrato aditivo

A cena continua `cinematic.version: 1`; apresentações antigas não são migradas. `camera.shake`, `camera.path`, `camera.instability`, vídeos alpha e os dez presets continuam aceitos.

Uma apresentação pode incluir:

```json
{
  "seconds": 4,
  "hold": 0,
  "sceneDuration": 14,
  "camera": {
    "from": {"x": 0.5, "y": 0.5, "zoom": 1},
    "to": {"x": 0.5, "y": 0.5, "zoom": 1.25},
    "easing": "ease-in-out",
    "shake": 0,
    "window": {"mode": "range", "start": 0, "end": 4, "fadeIn": 0, "fadeOut": 0}
  }
}
```

`sceneDuration`, quando presente, é o tempo da cena **antes do fade de saída**, entre 3 e 180 s. Substitui `seconds + hold` como prazo de encerramento. Não soma outra permanência. Sem esse campo, continua a regra anterior. `seconds` ainda controla a duração original do movimento/preset e não é regravado ao mudar a duração da cena.

### Janelas

Objeto opcional `window: {mode, start, end, fadeIn, fadeOut}` em câmera, instabilidade, camada, FX, iluminação global, luz individual e vídeo (inclusive fundo).

- `mode: 'scene'`: acompanha toda a duração atual da cena.
- `mode: 'range'`: intervalo em segundos. `0 <= start < end <= 180`; a reprodução é limitada ao fim real da cena. Um trecho inteiramente posterior à cena fica inativo.
- Fades não negativos, cuja soma cabe no intervalo configurado; valores não finitos e chaves desconhecidas são recusados.
- Câmera remapeia toda a trajetória para o trecho e mantém o enquadramento final. Sua suavização vem das curvas do caminho; seus campos de fade não alteram opacidade. A interface não oferece fades de câmera.
- Instabilidade usa um envelope próprio. A janela permite que ela ocorra após o movimento. Ao ativá-la, a interface converte os fades normalizados anteriores para segundos, sem alterar apresentações já salvas.
- Janela da camada controla sua visibilidade; janela do FX controla sua contribuição. Desativar um efeito restaura a aparência neutra, sem apagar a camada. Para fazer o elemento inteiro desaparecer, use a janela de visibilidade.
- Atraso de FX/vídeo é relativo ao início da sua janela.
- `scene` acompanha mudanças de duração; `range` preserva os segundos escolhidos. Uma faixa fora da duração continua nos dados para poder ser reutilizada após ampliar a cena.

O relógio é o mesmo de `CinematicFrame`: pause, seek, reinício e encerramento. Não há temporizadores por efeito. Curvas temporais são amostradas em até 1.801 keyframes e executadas pela Web Animations API. Em repetição indefinida, os FX temporais retornam pelo mesmo percurso para evitar um corte de pose no limite da cena. Os FX antigos sem janelas mantêm seu player anterior.

### Efeitos locais

Continuam disponíveis respiração, balanço, tremor, opacidade e movimento. Foram adicionados `flicker`, `pulse`, `drift` e `reveal`, com controles próprios. Até oito efeitos por camada e **32 por composição**. Cada efeito pode ter `anchor: {x,y}`, normalizada entre 0 e 1. Sem âncora explícita, herda a da camada.

Os novos tipos incluem `amount`, `frequency`, `opacity`, além dos campos comuns `id/type/enabled/start/duration/repeat/easing`. A interface mostra frequência somente quando ela governa o efeito; respiração/pulso usam o período, reveal usa a duração. Reveal sem repetição mantém a opacidade final até o fim de sua janela. Fades podem retirar o efeito. Intensidades e flicker são limitados; não há animação de pixel por JavaScript a cada frame.

### Iluminação

Até **quatro luzes**; `kind` opcional: `spot`, `beam`, `global`. Campos anteriores preservados. `rotation` de −180 a 180 graus aplica-se ao feixe. `window` e `flicker: {amount, frequency, seed}` opcionais em iluminação ou luz. Flicker até 0,3 / 2 Hz.

`lighting.events` admite até oito eventos de estrutura validada:

```json
{"id":"falha-palco","type":"blackout","start":7,"duration":0.3,"count":3,"gap":1,"amount":0.9,"color":"#ffe3a0"}
```

Tipos `blackout` e `flash`. Duração 0,2–0,5 s, uma a três repetições, distância entre inícios de pelo menos 0,6 s. Flash limitado a intensidade 0,25. Pequenos fades internos evitam cortes secos. Não é um gerador estroboscópico livre.

### Mídia e orçamento

- **12 camadas adicionais**, mais fundo. Ordem/IDs preservados.
- 24 MB por composição; 24 milhões de pixels estimados, contando cada camada e três buffers por vídeo; camada estática até 8 MP. O aumento de camadas não aumentou esses limites.
- Até **dois WebMs no total**, somando fundo e camadas, inclusive quando desativados. VP9, sem faixa de áudio, até 8 MB / 12 s / 30 fps / 921.600 pixels e 1.280 px por lado.
- Novo `backgroundVideo` usa a mesma configuração validada dos vídeos de camada. `transparent: false` permite VP9 opaco; omissão mantém a exigência anterior de alpha. A imagem principal é o fallback e deve ter a mesma proporção.
- Upload de camada continua exigindo VP9 alpha e fallback PNG. Fundo aceita opaco ou alpha. O protocolo transfere os bytes locais por hash; nenhuma URL externa é persistida.
- Janelas de vídeo fazem crossfade com o fallback estático. Fora do trecho, com movimento reduzido ou em falha, o fallback permanece visível. Para ocultar também o fallback de um overlay, configure a janela da camada.
- Backups completos incluem fundo/vídeos/overlays referenciados. Hashes, formato real, dimensões e orçamento são validados antes de importar. IDs e arquivos compartilhados não são duplicados por duplicar uma camada/apresentação.
- Descarte cancela animações, timers centrais, loads, src e object URLs. A escolha de solo e o zoom do visualizador não são persistidos.

## Studio

As abas **Direção**, **Luz**, **Efeitos** e **Fundo vivo** reusam o Studio e o mesmo player do quadro. Direção apresenta intervalos por elemento, sem timeline profissional. O mestre pode recolher os painéis laterais no desktop, ampliar o canvas, usar Ctrl + roda para zoom, enquadrar seleção, bloquear transformações, duplicar, ocultar e reordenar. Solo temporário atua no visualizador e na prévia, sem modificar a apresentação salva. Bloqueio não impede excluir/reordenar explicitamente; protege posição, escala, âncora e ajustes de transformação.

Números inválidos bloqueiam salvar/apresentar e preservam o último modelo válido. Ao editar um intervalo, amplie o fim antes de mover o início para além dele. Salvar permanece explícito; Apresentar envia somente a versão salva.

Em 390 px continuam as três abas Camadas/Canvas/Propriedades; os controles novos ficam dentro delas, sem impor três colunas desktop.

## Biblioteca e teatro

Oito overlays técnicos originais: névoa, fumaça, poeira, feixe quente, flicker quente, luz instável, sangue no chão e sombra. Mais névoa animada VP9 alpha. São assets iniciais simples, não uma biblioteca artística completa.

`assets/cinematic/theater-corrected.png` foi editado a partir da arte original fornecida, reduzindo as cadeiras da plateia e preservando palco, cortinas vermelhas e atmosfera sombria. **Não substitui campanhas existentes automaticamente**. Os botões em Fundo vivo aplicam imagem ou WebM ao rascunho, exigindo Salvar. `theater-living.webm` é um loop técnico de quatro segundos, sem áudio, com variação suave de luz; não é uma animação final de personagens. Fumaça e efeitos podem ser compostos separadamente.

`python scripts/generate-cinematic-assets.py` reproduz os overlays e loops técnicos usando Pillow/ffmpeg, apenas no desenvolvimento. A arte corrigida é um arquivo de entrada preservado, não regenerado pelo script. Sem dependências novas na aplicação.

## Movimento reduzido e limites

Mantém aviso e autorização local reversível existentes. Câmera, instabilidade, FX de movimento, pulsos/flicker e eventos de apagão/flash ficam desativados; imagens e luzes estáticas permanecem, com fades/janelas de visibilidade. Vídeo usa fallback. Acessibilidade não remove configurações salvas.

Não incluídos: 16 camadas, multisseleção, timeline gráfica por keyframes de FX, edição/retiming de vídeo, transmissão remota ou mudança do Audio Engine. O limite de 12 depende dos mesmos orçamentos; não promete 12 imagens enormes ou 12 vídeos. Hardware fraco pode exigir composições menores. O loop técnico usa imagens de resolução reduzida para decodificação leve.

## Teste manual rápido

1. Abrir cena de teste → Ferramentas → Cinemática → Fundo vivo → Usar teatro corrigido. Dar um nome.
2. Adicionar Iris/corpos e overlays pela lista. Em Efeitos, configurar respiração de Iris e balanço da cortina, cada um com seu período/âncora.
3. Em Direção, duração independente de 14 s; câmera em intervalo 0–4; instabilidade 8–13 com fades; camada de névoa 8–14 ou cena inteira. Em Luz, escolher feixe quente e adicionar apagão de 0,3 s, três repetições.
4. Prévia, pausar e usar o seek depois de 4 s: enquadramento estável, luzes e FX continuam. Salvar, fechar/reabrir e Apresentar ao quadro local da mesma conta/campanha. Encerrar e conferir quadro/áudio.
5. Experimentar Fundo vivo e névoa WebM; manter fallback. Exportar backup completo para levar os arquivos a outro navegador.

Para Chrome QA isolado: `node tests/fixtures/cinematic-demo.mjs <diretório-novo>`; servir o `public/` criado e abrir `direction.html`. Os fixtures não acessam dados de campanha reais. A demonstração padrão usa figuras técnicas; as capturas desta entrega também usam as três imagens originais recebidas do teatro, copiadas apenas para o ambiente descartável.
