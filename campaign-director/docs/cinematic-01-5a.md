# CINEMATIC-01.5A — câmera multiponto e instabilidade global

Base verificada: `34532c1a63c001385e21774adc29a76c2a2af831` (`main`, PR #19 / 01.4 integrado). Issue #20. Branch `feature/cinematic-01-5a-advanced-camera`. Não há migração automática, endpoints ou dependências novas.

## Uso do Studio

Ferramentas → Cinemática → Câmera. Ativar câmera personalizada mantém o fluxo atual. Inicial/Final e os pontos intermediários aparecem em uma lista e como marcadores A–H sobre o canvas. O retângulo destacado mostra o enquadramento selecionado. Arraste o marcador ou o retângulo; setas movem 0,5% e Shift + setas 0,05%. O zoom/pan do visualizador continua independente da câmera.

`+ Enquadramento` ocupa o maior intervalo livre, interpolando a pose inicial; até seis pontos intermediários. Os campos de X/Y/zoom editam o ponto selecionado. Em Ajustes avançados, Chegada e Permanência são mostradas em segundos. A curva pertence ao trecho que **sai** do ponto; no Final ela fica desativada. Tempos duplicados ou sem espaço para transição são recusados. Antes/Depois trocam poses entre instantes existentes e limitam a permanência ao intervalo disponível. Excluir remove somente o enquadramento. Focar camada copia X/Y: remover a camada depois não apaga a pose.

Presets de movimento: Aproximação central, Revelar personagem e Travessia suave. Aplicá-los substitui a trajetória; o histórico permite desfazer. O caminho de repetição volta pelos mesmos pontos, sem corte no reinício. Um ponto com permanência duplica a pose no tempo de saída para manter a câmera parada.

Instabilidade oferece Câmera sutil, Câmera na mão, Tensão crescente e Impacto. O preset preenche parâmetros editáveis, sem guardar nome obrigatório. Intensidade geral e ativação ficam no nível básico. Avançado expõe amplitudes horizontal/vertical, rotação, frequência, suavidade, irregularidade, intensidades inicial/final, intervalo ativo e entrada/saída. As amplitudes são percentuais da composição; a rotação é em graus.

Prévia usa o mesmo renderer do quadro. Pausar, retomar, buscar tempo e reiniciar usam o relógio existente. Ajustes durante a prévia aplicam-se com o debounce da 01.4, sem exigir salvar. Apresentar permanece bloqueado com rascunho ou parâmetros de câmera inválidos. Salvar, desfazer/refazer, duplicar e backups usam o modelo existente.

## Contrato aditivo (cinematic.version permanece 1)

O objeto antigo continua válido:

```json
{"from":{"x":0.5,"y":0.5,"zoom":1},"to":{"x":0.6,"y":0.6,"zoom":3},"easing":"ease-in-out","shake":0}
```

Campos opcionais novos:

```json
{
  "path":[
    {"id":"palco","at":0.3333333333333333,"pose":{"x":0.55,"y":0.55,"zoom":1.6},"hold":0.041666666666666664,"easing":"ease-in-out"},
    {"id":"iris","at":0.6666666666666666,"pose":{"x":0.55,"y":0.6,"zoom":2.3},"hold":0.05,"easing":"ease-out"}
  ],
  "instability":{
    "enabled":true,"amount":0.55,"horizontal":0.009,"vertical":0.006,"rotation":0.6,
    "frequency":1.4,"smoothness":0.8,"irregularity":0.45,"initial":0.08,"final":1,
    "start":0.08333333333333333,"end":0.9166666666666666,"fadeIn":0.08,"fadeOut":0.15,"seed":37
  }
}
```

- `path`: somente intermediários, ordenados por `at`; início/fim permanecem `from`/`to`. Máximo seis; IDs únicos seguros, distintos de `from` e `to`.
- `at` e `hold`: frações da **duração do movimento**, não da permanência final nem do fade-out. Chegadas entre 0,01 e 0,99; separação mínima 0,01. Após a permanência deve restar pelo menos 0,01 para o próximo ponto. Alterar a duração mantém a proporção temporal.
- `pose`: X/Y em [0,1], zoom em [1,12], mesmas regras antigas. Renderização aplica limites seguros ao centro conforme o zoom. Não existem referências persistidas a camadas.
- `easing`: enum compartilhado linear/ease/ease-in/ease-out/ease-in-out. Cada ponto controla seu segmento de saída; `camera.easing` controla a saída do enquadramento inicial.
- `instability`: todos os campos são obrigatórios **dentro** dessa estrutura opcional. Boolean de ativação; amount, suavidade, irregularidade e intensidades em [0,1]. Horizontal/vertical em [0,0.015], rotação [0,1.2] graus, frequência [0.1,4] Hz. Seed inteiro [0,65535].
- `start`/`end`: frações da duração, intervalo mínimo 0,01; `fadeIn`/`fadeOut`: frações do intervalo ativo, soma até 1. Há proteção mínima de 30 ms nas bordas, inclusive quando o fade explícito é zero.
- Chaves desconhecidas, HTML, easing arbitrário e valores não finitos são rejeitados, sem gravar uma restauração parcial.

`camera.shake` continua aceito e mantém a curva antiga de quatro segundos. Foi acrescentado somente overscan mínimo para cobrir as bordas desse movimento. A presença de `instability` substitui o shake antigo, inclusive quando `enabled:false`; o valor antigo permanece armazenado. Abrir o painel não converte os dados. Editar explicitamente um controle novo passa a guardar a configuração avançada.

## Execução e segurança de transformações

`cinematic-camera-model.js` concentra validação, presets e operações imutáveis. `cinematic-camera-player.js` calcula keyframes de caminho, parallax e instabilidade. `cinematic-camera-editor.js` monta somente o inspetor; não cria player, vídeo ou Audio Engine.

A hierarquia da 01.4 é preservada: world → jitter global → câmera → planos de profundidade → posição/âncora → efeitos locais → mídia. A trajetória e o parallax recebem os mesmos offsets, holds e easing. Respiração/tremor de personagem e luzes continuam em seus próprios nós.

A instabilidade é uma combinação limitada de seno e ruído interpolado determinístico. Não usa Math.random, callbacks por frame nem timer próprio. A frequência e a suavidade controlam a cadência/amortecimento; a irregularidade mistura a oscilação regular com ruído suave. A envoltória aplica rampa e fades. WAAPI recebe até 1801 amostras por apresentação (30 Hz, máximo 60 s). O relógio existente define currentTime, pausa/seek/reinício; loop usa alternate. Cancelar o frame cancela também essas animações.

O overscan é calculado pelo pior deslocamento e rotação configurados, considerando a proporção da composição. Ele cobre os cantos da imagem após a transformação inversa, inclusive em retrato. Pode haver um crop discreto a mais com instabilidade ativa; sem instabilidade ativa não há esse crop adicional. Os segmentos de câmera interpolam transforms seguros e não extrapolam. Redução de movimento cancela câmera/instabilidade/parallax, preserva a composição no enquadramento inicial e mantém avisos/fades/ciclo de vida existentes.

## Verificação e demonstração

`npm run check`, `npm test` e `node --test tests/cinematic-camera.test.js` são os comandos de validação. A fixture existente foi estendida: `node tests/fixtures/cinematic-demo.mjs /pasta/nova`, servir `public`, abrir `camera.html`. Cada execução usa identidade, campanha e armazenamento fictícios independentes.

O botão de QA prepara teatro, dois atores, Iris a 3,8% com respiração, primeiro plano oscilante, luz amarela e quatro enquadramentos. Mede os quatro presets e compara câmera/instabilidade em prévia e quadro nos tempos 0, 2,4, 4,25, 6,15, 8,3 e 10,2 s. Tolerância: 0,00002 nas componentes de matriz normalizadas pela largura/altura do world. Pausa, seek e restart são exercitados pelo próprio CinematicFrame do app/quadro, exposto apenas na cópia descartável da fixture.

`?mobile` usa viewport de 390 px. `?reduced&mirror` testa movimento reduzido e a cópia integrada do quadro. A fixture também confere salvar/reabrir, histórico, snapshot integral e áudio local. O botão Compatibilidade verifica o renderer de imagem antiga e camera.shake da 01.4. A prévia real usa o mesmo player; a fixture não substitui algoritmos de produção.

## Limites

Sem timeline geral 01.5B, controle de velocidade global novo, câmera remota autenticada ou sincronização entre dispositivos. A duração já existente altera a velocidade do percurso; não há relógio independente. A UI mobile foi testada por viewport no Chrome, não em aparelho físico. Safari, equipamento de pouca memória e Spotify conectado não foram validados. Campos de âncora/mídia/cores e regras de cues não foram alterados.

A lista de pontos e os marcadores são a edição visual desta fase; não há curvas Bézier desenhadas livremente. O foco é uma cópia de posição, sem acompanhamento automático de personagem. Deslocamentos de câmera no zoom mínimo podem ser limitados para manter a tela preenchida.
