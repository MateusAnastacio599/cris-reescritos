# Validação CINEMATIC-01.5B

Base: main `d90b3d380cbd7143ba60ea090a1212d98c074e13`, PR #21 / 01.5A. Sem alteração de dados reais, merge ou publicação. Reaproveitados Studio, IndexedDB, protocolo, player compartilhado e fixtures existentes.

## Automatizada

- `npm run check`: aprovado (módulos/imports, shell, CSS, manifesto e arquivos de áudio).
- `npm test`: **416/416**, sem falhas, skips ou cancelamentos. Os 392 casos da base foram mantidos; o teste do limite antigo foi atualizado de cinco para treze camadas inválidas.
- **24 regressões adicionadas**: 23 em `cinematic-direction-timeline.test.js` e um caso do lifecycle com movimento de 4 s / duração de cena de 14 s.
- Contrato estrito, janelas, fades, atraso, determinismo, câmera e instabilidade independentes, novos FX, estado final, quatro luzes, três apagões, limites de flash, movimento reduzido, 12 camadas, 32 FX, duplicação com hash compartilhado, vídeos alpha/opacos, fallback, limite conjunto de dois vídeos e leitura dos assets reais.
- Exportação/importação pelo fluxo real de workspace preservou janelas, câmera, FX, luzes/eventos, bloqueio, vídeo de fundo, IDs e Markdown. Um backup com janela corrompida foi recusado antes de alterar o estado anterior.
- `git diff --check`: aprovado. Nenhum arquivo do Audio Engine, backend, Markdown, Spotify ou snapshots foi alterado.

## Chrome real — cena isolada

Demonstração `direction.html`, com conta fictícia, dados isolados por demoSession, quadro real com pistas/conexão e engine local real. A fixture monta e salva a cena pelos controles reais do Studio; pause/seek do player são expostos somente na cópia descartável para comparar timestamps.

| Cenário | Resultado observado |
| --- | --- |
| Desktop, iframe de 1440 px | oito camadas com FX, câmera e luzes simultâneos; edição, salvar/reabrir e histórico aprovados |
| Viewport de 390 px | mesmo percurso aprovado; navegação Camadas/Canvas/Propriedades acessível; body com 375 px úteis/375 px de scrollWidth, sem overflow horizontal |
| Segunda cópia do quadro, movimento reduzido emulado | `campaign-director/dist/cris/quadro/` aprovado; câmera, FX locais e apagões sem animação, aviso visível; permissão local ativou movimentos |
| Câmera 0–4 s, cena de 14 s | mesma matriz depois de 4 s; respiração de Iris e intensidades de luz diferentes em 5,2 e 6,3 s |
| Overlay final | invisível antes de 8 s, fade com opacidade 0,06075 em 8,15 s, visível em 10,4 s |
| Instabilidade no clímax | matriz neutra no início; deslocamento/rotação presentes em 10,4 s |
| Prévia versus quadro | poses/FX/luzes comparados em 2,2 / 5,2 / 7,15 / 8,15 / 9,15 / 10,4 s; FX normalizados pela dimensão do elemento, tolerância 0,00002 |
| Três apagões | opacidade 0,9 em 7,15 / 8,15 / 9,15 s; fora dos eventos, opacidade zero |
| Encerramento automático | apresentação terminou ao alcançar 14 s mais saída; animações antigas canceladas |
| Reapresentar/substituir, encerrar manualmente e trocar de cena | composição anterior removida sem resíduo; troca para O Corredor encerrou e permitiu voltar ao Quarto |
| Snapshot/áudio | JSON integral do quadro idêntico; engine permaneceu em reprodução, com tempo crescente |
| Fundo WebM opaco real | VP9 640×360, readyState 4, muted, reprodução avançando, pausa sincronizada; falha controlada recuperou a imagem |
| Névoa WebM alpha da biblioteca | este Chrome recusou o probe de transparência; fallback PNG manteve a névoa e exibiu aviso claro |

## Conferência direta da interface

Além do botão da fixture, controles foram usados por interação nativa do navegador:

- Studio reaberto com **12 camadas**; tentativa de 13ª recusada com mensagem, input de nova imagem desativado.
- Duplicação, ocultação, solo temporário (somente fundo + camada visíveis), reordenação com desfazer e salvamento/reabertura preservados.
- Shift + seta direita moveu X de 50% para **50,05%**; desfazer restaurou a posição. Bloquear transformação desativou também os campos da âncora.
- Recolher os dois painéis aumentou a largura do canvas. O estado desktop não impede as abas mobile ao reduzir a largura.
- Conferidas a arte corrigida com as figuras originais recebidas e a biblioteca técnica. O overlay de sangue passou a iniciar no chão, em vez do centro da cena; alterações em composições já salvas continuam explícitas.

As capturas e logs do pacote são evidências de um ambiente demonstrativo; não representam autenticação real nem alteração de campanha.

## Limitações e validações não realizadas

- **Não foi validada reprodução de WebM com alpha neste Chrome**, que também informa WebGL/aceleração indisponível. O fallback foi validado efetivamente. Confirmar alpha em Chrome com decodificação compatível antes de depender dessa mídia numa mesa; o fundo opaco e os PNGs funcionaram.
- Sem teste em aparelho físico, Safari, GPU móvel ou benchmark prolongado de 12 camadas animadas. Doze camadas foram criadas/salvas/reabertas; a comparação temporal automatizada em Chrome usa oito.
- Movimento reduzido foi emulado via matchMedia na cópia de QA, sem alterar configuração global do sistema. A autorização local foi exercitada nos dois players.
- Não há arte separada de cortina pronta neste pacote: o FX de balanço com janela foi testado no modelo e pode ser aplicado a uma camada de cortina fornecida pelo mestre. As cortinas pintadas no fundo permanecem parte da imagem.
- Recarga e carregamentos obsoletos mantêm os testes automatizados existentes; não se repetiu visualmente toda a matriz de recarga da entrega anterior. Novo descarte de vídeo foi conferido ao voltar à composição.
- Exportação/importação foi validada automaticamente pelo fluxo real de workspace, não repetida manualmente pela interface.
- Sem Spotify conectado, conta real, transmissão remota, multisseleção, timeline profissional ou vídeo final de personagens. Áudio conferido: local.
- O WebM do teatro é um asset técnico curto de variação de luz. Não substitui uma animação artística final; PNG, composição e parâmetros são utilizáveis independentemente dele.

Sem publicação ou merge automático. O novo contrato e os passos manuais estão em `cinematic-01-5b.md`.
