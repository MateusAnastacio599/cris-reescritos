# CINEMATIC-01.4 — Studio de Direção

Base: `5435dbafd90699b5865b15f264958c35b6464d7b`. Branch: `feature/cinematic-01-4-direction-studio`. Sem merge, publicação ou migração automática de cenas.

## Uso

Ferramentas → Cinemática abre o Studio no diálogo existente, ampliado. A lista fica à esquerda, a composição no centro e as propriedades à direita. No mobile, Camadas / Canvas / Propriedades alternam os painéis. A seção Apresentação reúne nome, fundo, preset, duração, permanência, fades e apresentação salva.

1. Anexe o fundo e até quatro imagens. Selecione a camada na lista ou no canvas.
2. Arraste para posicionar; a alça circular permanece clicável mesmo em escalas pequenas. Arraste a alça lateral para escalar. Escala numérica: **0,1%–300%**, preservando a referência de largura antiga; slider logarítmico para valores pequenos. Setas movem 0,5% da composição; Shift + setas, 0,05%.
3. Centro, Pés, Topo, Esquerda, Direita e coordenadas de âncora personalizadas preservam a posição visual ao trocar a âncora. Operações que colocariam a âncora fora da composição são recusadas com explicação. Rotação e opacidade são independentes.
4. Ajustar, zoom, Enquadrar seleção e Espaço + arraste alteram somente o visualizador. Não são salvos como câmera. Enquadrar considera largura **e altura** da mídia.
5. Câmera: habilite a câmera independente, edite centros/zooms inicial e final e suavização. Editar início/fim mostra um retângulo arrastável no canvas. Focar camada usa sua posição no enquadramento final. Centros são limitados pelo zoom para evitar bordas vazias. A câmera independente substitui o deslocamento do preset, preservando sua atmosfera. O preset Câmera controlável também funciona sem metadata explícita, com enquadramento padrão. Loops de câmera fazem ida e volta, sem reinício abrupto.
6. Efeitos: adicione até oito efeitos por camada, edite, desative ou exclua individualmente. Respiração pelos pés configura âncora e efeito. Respiração, Balanço e Instabilidade fecham suas trajetórias; Opacidade e Movimento repetidos alternam ida/volta. Atrasos, duração, suavização e parâmetros têm limites validados. Sem efeito próprio, não há animação local.
7. Luz: perfis Vela, Foco de teatro, Amarelo instável, Sala escura e Janela fria. Ambiente, escurecimento e vinheta; até dois focos com posição, cor, intensidade, raio, suavidade e pulsação lenta. Todos editáveis, sem estroboscopia.
8. Prévia usa `CinematicFrame`, o mesmo renderer do quadro. Pausar, Reiniciar e a barra de tempo controlam um único relógio. Alterações durante a prévia atualizam-na após breve debounce, mantendo tempo/pausa. Repetir prévia não modifica o comportamento salvo. Voltar à composição encerra a prévia.
9. Salvar valida e persiste metadados e arquivos; Apresentar fica bloqueado enquanto há rascunho. Desfazer/refazer usa snapshots do modelo do Studio; não grava bytes no histórico. O histórico é reiniciado ao salvar ou trocar de apresentação. Duplicar preserva os hashes compartilhados e cria IDs próprios.

## Dados e transformações

Campos opcionais adicionados ao formato existente `cinematic.version = 1`. Nenhuma conversão em leitura; apresentações antigas continuam válidas.

- Apresentação: `camera: {from:{x,y,zoom},to:{x,y,zoom},easing,shake}` e `lighting:{enabled,color,intensity,darkness,vignette,spots:[]}`.
- Camada: `anchor:{x,y}`, `rotation`, `opacity`, `effects:[]`, `video:{mediaId,enabled,loop,rate,delay,end}`. `imageId` continua sendo imagem estática obrigatória, inclusive para vídeo.
- Todos os objetos têm lista explícita de campos, tipos e limites; cores somente hexadecimal; easing somente enum conhecido. Não há HTML persistido, URLs externas ou código fornecido pelo usuário.
- Hierarquia: world centrado → instabilidade global → câmera → plano de profundidade → posição/âncora/rotação → wrappers de efeitos → PNG/vídeo. Luzes pontuais acompanham a câmera. Escurecimento e vinheta cobrem a composição.
- Câmera customizada é global; parallax acrescenta um diferencial discreto de profundidade. Apresentações antigas mantêm o caminho anterior. Ambiente vivo foi centralizado, removendo seu deslocamento arbitrário para a direita.
- `cinematic-direction-model.js`: validação e operações geométricas. `cinematic-direction-player.js`: keyframes e iluminação. `cinematic-studio-history.js` e `cinematic-studio-properties.js`: histórico/inspeção sem segundo player.

## Vídeo e fallback

`cinematic-video.js` isola mídia animada. WebM **VP9 com AlphaMode e uma única faixa, sem áudio**. Extensão, assinatura EBML, codec, dimensões, Duration/TimecodeScale e DefaultDuration são verificados antes do decoder. Limites: duas camadas de vídeo, 8 MB/arquivo, 12 segundos, 30 fps, até 921.600 pixels e 1280 px por lado. Recomenda-se 2–8 s e 12–24 fps para loops. Velocidade 0,25×–2×; atraso 0–60 s; término Manter último quadro / Mostrar PNG / Ocultar. Áudio do vídeo é sempre mudo e não há Audio Engine adicional.

O usuário primeiro adiciona um **PNG de fallback com a mesma proporção**, depois anexa o WebM em Camada → Mídia animada. O PNG continua no modelo e no backup. O detector de suporte decodifica uma pequena fixture VP9 original, desenha um frame em canvas e verifica alpha transparente e opaco. Não usa apenas `canPlayType`. Falha de suporte ou de `play()` mantém o PNG e exibe aviso no próprio player/quadro. Movimento reduzido mantém PNG estático, avisos e permissão local reversível existentes.

O quadro confirma a composição após carregar as imagens indispensáveis. O WebM opcional prepara-se em segundo plano, sem bloquear a confirmação nem o fallback; ao ficar pronto, entra na posição do relógio atual. Dimensões e duração decodificadas também são conferidas. Uma composição substituída descarta players, `src`, URLs de objeto, timers, seeks e animações; promessas antigas não retomam vídeo após pausa/encerramento. Probes compartilhados são limitados a uma tentativa de 3,5 s por documento.

IndexedDB existente, mesmo object store. Hash `image-SHA256` para imagens e `video-SHA256` para vídeos; nenhuma URL blob persistida. Exportação/importação inclui ambas as referências, inclusive camadas ocultas/desativadas, com deduplicação de bytes e verificação antes de gravar uma restauração. O formato de backup permanece o mesmo contêiner `cinematicMedia`. Recursos ausentes bloqueiam iniciar/exportar com erro claro, em vez de salvar um pacote incompleto.

Orçamento de composição preservado: 24 MB e 24 MP; vídeo custa três buffers de pixels além do PNG. Camadas estáticas até 8 MP. Pool temporário do Studio até 64 MB; salve e reabra para liberar arquivos que só restaram no histórico. Não há publicação de arquivos privados nem endpoints novos.

APNG e WebP animado continuam recusados; sua adoção requer validação/relógio/fallback próprios em entrega futura. Safari não é anunciado como compatível: deve usar PNG quando a decodificação de alpha não passar.

## Demonstração reproduzível e verificação

`node tests/fixtures/cinematic-demo.mjs /caminho/novo` prepara uma cópia isolada com identidade fictícia e persistência de teste. Abra `studio.html`; não use contas ou campanhas reais. Cada execução usa seu próprio `demoSession`. O áudio local é do engine real e o quadro usa seus objetos e conexões reais de teste. `?mobile` usa iframe de **390 px**; `?reduced&mirror` aplica movimento reduzido e testa a cópia integrada do quadro.

O botão Validar Studio de Direção monta palco e plateia originais da fixture anterior, dois atores estáticos e Iris a **3,8%**, com respiração pelos pés, WebM transparente, câmera 1×→2,2× e foco amarelo pulsante. Mede matrizes em instantes diferentes, alpha real, pausa/reinício/seek, cues de iniciar/encerrar, autoencerramento, snapshot integral e continuidade do áudio. Botões adicionais exercitam recarga e `play()` bloqueado (simulação explícita que deve mostrar PNG). Vídeos originais podem ser recriados por `python tests/fixtures/cinematic-studio/generate.py` com Pillow e ffmpeg/libvpx-vp9; nenhuma arte externa ou geração por IA.

Validações concluídas: ver relatório de aceitação e logs no pacote. Os 355 casos antigos permanecem; duas expectativas antigas foram ampliadas para o novo limite de escala e preset de câmera. O mock WAAPI recebeu pause/play para representar as novas APIs do relógio.

## Limites e revisão

- Sem transmissão remota, timeline profissional, áudio de vídeo, máscaras, edição de recorte ou camadas por cue em tempo real.
- WebM pode ser recusado pelo decoder/autoplay/dispositivo; PNG é parte obrigatória da experiência. Não foi testado Safari, iOS/Android físico, equipamento com pouca memória ou Spotify conectado. Áudio local foi testado no Chrome.
- Canvas e luzes usam proporções do cenário; saída cobre a tela com crop. Não existe composição alternativa específica para retrato.
- Redimensionamento mantém proporção; não há skew, deformação ou rotação por gesto. Rotação e âncora usam campos. Efeitos são somados em wrappers, não em keyframes editáveis.
- O Studio continua no diálogo existente, sem rota ou aplicativo separado. Preferências de visualizador não são persistidas; metadados de apresentação são.
- As duas distribuições de `board-cinematic.js` importam o mesmo renderer atualizado; não foi necessário editar estado ou armazenamento do quadro.
