# Validação CINEMATIC-01.5A

Base: `34532c1a63c001385e21774adc29a76c2a2af831`, main integrada com a 01.4. Dados reais de campanhas não foram usados nem alterados.

## Automatizada

- `npm run check`: aprovado.
- `npm test`: **392/392**, sem falhas, skips ou cancelamentos; os 375 casos da base foram mantidos.
- `node --test tests/cinematic-camera.test.js`: **17/17** novos casos. Contrato, limites, inserção/ordem/exclusão, poses/holds/easing, presets e todos os parâmetros, envelopes, determinismo, cobertura de bordas por transformação inversa em proporções de 0,25 a 3,5, wrappers independentes, loop, legado, movimento reduzido e backup real de workspace.
- Backup de workspace preservou Markdown, configurações, IDs, caminho e instabilidade. Importação de trajetória inválida foi recusada sem alterar o estado anterior.
- `git diff --check`: aprovado. Mudanças limitadas a Cinematic, documentação e fixtures/testes.

## Chrome real

Fixture descartável `camera.html`, com identidade fictícia, armazenamento por demoSession, engine local real e quadro com pistas/conexões.

| Cenário | Resultado |
| --- | --- |
| Desktop 1440 px | quatro enquadramentos criados, salvos e reabertos; histórico e controles aprovados |
| Viewport 390 px | mesmo percurso aprovado; painéis alternáveis; corpo sem overflow horizontal (375 px úteis dentro do viewport com scrollbar) |
| Movimento reduzido + quadro integrado | câmera/instabilidade estáticas, aviso visível, permissão local explícita ativa os movimentos; aprovado |
| Presets | os quatro produziram matrizes diferentes; nenhum depende apenas da existência de keyframes |
| Prévia versus quadro | matrizes comparadas em 0, 2,4, 4,25, 6,15, 8,3 e 10,2 segundos; tolerância 0,00002 nas componentes normalizadas; aprovado |
| Pausar, retomar, seek, reiniciar | pausa exata e retorno ao mesmo timestamp; retomada avançou e reinício voltou ao começo |
| Composição | câmera, instabilidade global, respiração, oscilação de primeiro plano, parallax e luz pulsante funcionaram simultaneamente |
| Legado antes da 01.4 | imagem única reproduzida no caminho original do player |
| Legado da 01.4 | camera.shake com ciclo de quatro segundos e seek idêntico; aprovado |
| Substituição durante apresentação | permaneceu exatamente uma camada; encerrar removeu a composição |
| Troca para O Corredor durante apresentação | camada removida; snapshot permaneceu igual |
| Snapshot e áudio local | snapshot integral idêntico; mesma cena de áudio, reprodução ativa e tempo crescente |

As poses em timestamps fixos foram exercitadas pelos métodos públicos do CinematicFrame real, expostos **somente na cópia de QA**. A edição persistida foi feita pelos controles do Studio. Não há hooks extras na produção.

## Edição visual manual

Arraste nativo do enquadramento B: centro de 55%/55% para 59,015896%/50,673044%; Apresentar ficou desativado. Desfazer restaurou 55%/55%. Shift + seta para direita alterou X para 55,05%; desfazer restaurou o valor. Zoom de visualizador a 150% manteve a câmera em 55% e o documento salvo, demonstrando independência entre visualizador e apresentação.

Uma entrada de 40 Hz bloqueou Apresentar. Corrigir para o valor salvo, 1,4 Hz, reabilitou-o imediatamente, inclusive antes de sair do campo. A inspeção encontrou e corrigiu a dependência indevida do evento change: quando o valor final voltava ao original antes do blur, esse evento não disparava e o bloqueio ficava preso. Agora números válidos atualizam o modelo no input, preservando o campo durante a digitação. A fixture contém essa regressão.

Outra correção foi limitar a representação decimal do campo para eliminar 56,99999999999999 após Refazer. O modelo não é arredondado automaticamente. O primeiro teste auxiliar de legado passou um Blob de outro iframe e foi recusado corretamente; a fixture foi corrigida para usar o Blob do documento do player, sem afrouxar a validação de produção.

## Limitações explícitas

Sem teste em Safari, aparelho físico, hardware de pouca memória ou Spotify conectado. O áudio validado foi local. O novo pacote não altera mídia ou transmissão entre dispositivos. Recarregar durante apresentação e cancelamento de carregamentos continuam cobertos pelas suites de lifecycle/protocolo existentes; a nova validação visual verificou encerramento, substituição e troca de cena. Exportação/importação foi testada automaticamente pelo fluxo real de workspace; não foi repetida manualmente pela interface.

Não há controle global de playback rate novo; velocidade do percurso usa a duração existente. Movimentos repetidos retornam pelo mesmo caminho, em vez de realizar um corte. As curvas são as já disponíveis, não curvas livres. O overscan pode recortar discretamente a imagem para manter bordas cobertas.

Capturas e logs completos acompanham o pacote de revisão. Não houve merge nem publicação em produção.
