# LIVE-01B.5A — cover, pré-roll e countdown

Base `c509f0d` (`main`, após merge do PR #29 / LIVE-01B.4). Branch `feature/live-01b5a-cinematic-ux-cover-preroll`. Sem publicação, merge, alteração de campanha, backend ou Audio Engine.

## Fluxo

1. O mestre apresenta pelo Director. A prova, manifesto, transferência, integridade e preparo seguem o fluxo v4 existente.
2. Enquanto a mídia é preparada, o quadro continua disponível. Só quando o mestre e os participantes elegíveis estão prontos é definido o horário comum de início.
3. A antecedência padrão passa de 800 ms para **1.800 ms**. A compensação existente de RTT pode elevá-la até **2.000 ms**. Esse intervalo é o próprio pré-roll; não há outra espera de 1,8 s em cada cliente.
4. O primeiro frame do mesmo CinematicFrame aparece pausado, com desfoque temporário, véu e brilho dourado discreto nas bordas. O mestre vê **Avisando jogadores** e a contagem em décimos; o jogador em portrait vê **Vire o celular**. Em landscape/desktop, vê **A cena vai começar**.
5. No horário coordenado, o aviso some e o conteúdo inicia automaticamente. A timeline principal não consome sua duração durante o pré-roll. No Director, os estados coordenados são preparar → avisar → iniciar → apresentar.
6. Cancelamento, troca de apresentação e término liberam intervalo de contagem, overlay, montagem temporária e classes da interface. Uma entrada tardia usa a timeline ativa e não recebe outro pré-roll artificial.

O countdown calcula o tempo restante a partir de um deadline, atualizado a cada 50 ms; não inicia o player nem compete com o timer do coordenador. Nos últimos 0,5 s ganha ênfase luminosa, sem flash rápido. O contador é ocultado ao iniciar, inclusive quando há recuperação de autoplay. O aviso não exige confirmação nem rotação. Somente uma rejeição real de autoplay mantém a recuperação manual existente da B.4.

## Cover e iluminação

| Contexto | Comportamento |
| --- | --- |
| Quadro local do mestre | Cover na área inteira de apresentação |
| Quadro remoto desktop | Cover na área inteira de apresentação |
| Quadro remoto mobile portrait/landscape | Cover; redimensionamento acompanha a orientação |
| Prévia do Studio | Mantém o contain existente para inspecionar a composição inteira |

O Frame do quadro passa a `fit:'cover'`. O viewport de apresentação ocupa 100% da largura e altura disponíveis, em vez de uma caixa 16:9 contida dentro da tela. Imagem simples usa `object-fit:cover`; composições usam o `fitComposition` já existente, escalando uniformemente a maior dimensão necessária.

A proporção original não muda. Em portrait, o recorte lateral de uma composição 16:9 será grande; isso é consequência esperada do cover. Não é adicionada mídia para preencher margens, não há esticamento e não há segundo player.

O recorte de `.cinematic-world` e a atmosfera dentro do mesmo espaço das luzes, corrigidos na B.4, permanecem intactos. Câmera, luzes, vinheta, efeitos, camada WebM e integridade não foram reimplementados. O desfoque/escurecimento adicional só pertence ao pré-roll e desaparece no início; a medição durante a reprodução confirmou `filter:none` no frame. A escala e o ResizeObserver existentes acompanham as mudanças de viewport.

A animação de borda/rotação respeita `prefers-reduced-motion` e a preferência de movimentos do Frame. Não há vibração nem áudio novo.

## Validação

- `npm run check`: aprovado.
- `npm test`: **572 aprovados**, cinco regressões novas, mais a atualização das expectativas de build e do prazo do teste de integração para abranger o pré-roll real.
- `node scripts/check-integration.mjs`: aprovado.
- `git diff --check`: aprovado.
- Regressões: cover sem distorção nas duas orientações e desktop; clipping de luz mantido; pré-roll ligado ao horário comum e limitado a 2 s; countdown visível do mestre; contagem não dispara play por conta própria; troca/cancelamento e restauração; nenhum pré-roll extra na entrada tardia; recuperação de autoplay preservada.
- Chromium / quadro e CSS reais / campanha fictícia / **DataConnection simulado**: primeira imagem simples, câmera/luz, composição com WebM, troca durante apresentação, rotação do viewport sem reiniciar o player, encerramento e cancelamento durante a contagem. Capturas usam apenas mídia fictícia.
- WebM: `readyState=4`, reproduzindo, sem erro de mídia, sem fallback nessa execução.
- Cancelamento: `active=false`, `preparing=false`, `frames=0`, `overlays=0`.

### Medições de início (rede simulada)

Valores relativos ao horário compartilhado, não uma homologação de latência entre dispositivos:

| Cena / viewport | Mestre | Jogador | Diferença |
| --- | ---: | ---: | ---: |
| Câmera/luz, jogador portrait | 0 ms | +1 ms | 1 ms |
| WebM, landscape | +1 ms | +2 ms | 1 ms |
| Câmera/luz, desktop | 0 ms | +1 ms | 1 ms |

Geometria medida do jogador:

- Portrait: frame **390×844**, world **1500,44×844**, com recorte lateral centralizado.
- Landscape: frame aproximadamente **844×390**, world aproximadamente **844×474,91**, com recorte vertical centralizado. Pequenas frações de pixel decorrem do zoom do harness de QA.
- Em ambos, o world cobre o frame inteiro; sua proporção permanece 16:9. O vídeo continuou reproduzindo ao mudar de orientação.

Evidências: [métricas](validation/live-01b5a/browser-metrics.json), [pré-roll mobile](validation/live-01b5a/b5a-preroll-portrait.jpg), [countdown desktop](validation/live-01b5a/b5a-preroll-desktop.jpg), [cover portrait](validation/live-01b5a/b5a-cover-portrait.jpg), [cover landscape/WebM](validation/live-01b5a/b5a-cover-landscape-webm.jpg), [cover desktop](validation/live-01b5a/b5a-cover-desktop.jpg).

## Arquivos e distribuição

Mudanças de comportamento:

- `quadro/board-cinematic.js`: cover e identificação da apresentação local do mestre.
- `campaign-director/dist/cinematic-presentation.js`: wrapper comum a desktop/mobile, pré-roll, contador, mensagens e limpeza.
- `campaign-director/dist/cinematic-remote.js`: antecedência padrão 1,8 s e fases avisando/iniciando, mantendo readiness e relógio compartilhado.
- `campaign-director/dist/cinematic-link.js`: estados coordenados legíveis no Director.
- `campaign-director/dist/cinematic.css`: viewport cover, primeiro frame pausado e transição dourada.

A identidade de publicação passa para `live01b5a` em entradas, CSS, stamps e imports Cinematic, conservando o controle de versões da B.4 e a capacidade de protocolo **v4**. Os demais módulos do grafo mudam apenas essas referências; não foram refatorados. `integration-main` e `dist/cris` foram sincronizados pelo script existente. Testes, fixtures e este relatório completam o diff. Nenhum arquivo do Audio Engine foi alterado.

## Limites por navegador

“Fullscreen” nesta entrega significa apresentação que preenche o viewport do quadro, com a UI do quadro oculta. O site não pode prometer remover a barra do navegador por um comando remoto: a API nativa `requestFullscreen()` exige ativação do usuário. Não foi criado um botão obrigatório, uma tentativa cega ou uma espera por permissão. A gestão opcional de fullscreen/orientação existente continua preservada. Em app standalone, a área disponível depende do modo de instalação e do sistema.

O bloqueio de orientação tem suporte e condições diferentes entre navegadores; a apresentação continua tanto em portrait como landscape, sem aguardar lock. Restrições de autoplay/decoder e suspensão de abas continuam sendo condições reais e reportadas, não sucesso simulado.

Referências consultadas: [MDN requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen), [MDN ScreenOrientation.lock](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock).

Não houve Android físico, PWA instalado real, Windows nativo ou WebRTC entre aparelhos independentes nesta tarefa. Os resultados reais PC+celular descritos pelo usuário antecedem esta implementação; não são homologação deste commit.

## Reproduzir e homologar

```sh
npm --prefix campaign-director run check
npm --prefix campaign-director test
node campaign-director/scripts/check-integration.mjs
node campaign-director/tests/fixtures/live-cover-preroll-demo.mjs /tmp/cris-b5a-qa
```

Sirva a pasta `/tmp/cris-b5a-qa/public` em localhost com o servidor estático disponível. Abra `room-qa.html?case=rodada-unica`, conecte mestre/jogador com o código mostrado e use as opções de largura/altura para conferir o layout. As identidades, persistência backend e rede da fixture são simuladas; ela não deve ser publicada.

Para homologação física, usar implantação HTTPS de teste isolada e campanha fictícia:

1. Mestre no PC e jogador no Android, primeiro pelo navegador e depois pelo app instalado. Confirmar build `live01b5a`, capacidade v4, prova e quadro sincronizado.
2. Apresentar primeiro uma imagem simples, sem girar nem tocar no jogador. Conferir aviso curto, countdown do mestre e início automático próximo nos dois aparelhos.
3. Repetir com câmera/luz e WebM; girar durante o aviso e durante o conteúdo. Conferir cover, recorte esperado, ausência de faixas e iluminação contínua até as bordas.
4. Substituir, cancelar durante a contagem, encerrar manualmente e deixar uma cena encerrar automaticamente. Conferir que a UI retorna e nenhum contador/aviso fica preso.
5. Reconectar durante e após a apresentação: manter a sala, entrar na timeline atual sem reiniciar quem já assistia e não reviver cena encerrada. Guardar diagnóstico em qualquer falha, sem credenciais ou mídia privada.
