# Validação CINEMATIC-01.6

Base `b7acecb01e86cbd7350361b18b7c316bb574472e`, main com a 01.5B integrada. Nenhuma campanha real foi usada. Capturas anteriores foram registradas antes das alterações, com dados fictícios e figuras técnicas.

## Automatizada

- `npm run check`: aprovado.
- `npm test`: **432/432**, sem falhas, skips ou cancelamentos; mantidos os 416 testes anteriores.
- **16 regressões novas** em `cinematic-studio-polish.test.js`: edição validada e imutável de FX; campos inválidos; identificação/ordem das faixas; legado sem conversão; mídia de fundo/camada; solo com metadados antigos; alças protegidas; confirmação; foco/caret/scroll; contain do editor versus cover padrão; isolamento da limpeza por instância; rolagem por categoria.
- Exportação/importação e formatos antigos continuam cobertos pelos testes reais do workspace existentes. Não foram repetidos manualmente todos os backups pela interface. A 01.6 não introduz campos persistidos.
- `git diff --check`: aprovado.

## Chrome real

`polish.html` usa o Director e o quadro reais em uma cópia descartável, com identidade e persistência fictícias. A fixture usa os controles de edição; pause/seek do player real são expostos apenas na cópia de QA para comparação em timestamps fixos.

| Largura CSS do app | Percurso base | Regressões de edição | Layout |
| --- | --- | --- | --- |
| 1440 px | aprovado | aprovado | cabeçalho/transporte acessíveis, sem overflow horizontal |
| 1024 px | aprovado | aprovado | três painéis legíveis e controles alcançáveis |
| 768 px | aprovado | aprovado | navegação adaptativa por painéis |
| 390 px | aprovado | aprovado | Camadas/Canvas/Propriedades acessíveis; ações e seek visíveis |

Em todas as larguras: oito camadas, câmera e luzes/FX independentes, intervalo final, três apagões, salvar/reabrir, histórico, exclusão confirmada/cancelada, duplicação, bloqueio, solo após mudar iluminação, correção conjunta de início/fim, prévia pausada conservando foco/seek/painel, navegação temporal, uma imagem simples e um item no contrato antigo. A cena complexa também recebeu um ponto intermediário de câmera, resultando em três enquadramentos.

O fluxo base compara prévia/quadro em seis instantes, verifica encerramento automático/manual, substituição e troca de cena, snapshot integral idêntico e áudio local ainda em reprodução com tempo crescente. O modo reduzido emulado e a cópia `campaign-director/dist/cris/quadro/` passaram; o aviso e a autorização local continuam funcionando.

## Interações nativas adicionais

- Ctrl+S salvou amplitude `0.023` e manteve o foco no campo numérico.
- Arraste de Íris alterou X de `50` para `52.507` e Y para `91.749`; Desfazer restaurou X `50`.
- O nome de uma faixa temporal abriu o intervalo correspondente no inspetor, sem alterar o contrato da cena.
- Fundo WebM opaco reproduziu com `muted: true`, foi pausado e liberado; uma falha controlada recuperou a imagem de fallback.
- O teatro também passou com as imagens originais recebidas de Íris e dos dois atores, copiadas somente para a demonstração descartável. Nenhuma arte nova foi gerada nesta sprint.

## Problemas reproduzidos e tratados

- **Antes:** um FX com duração zero mantinha Apresentar habilitado e o rótulo de salvo. **Depois:** Salvar/Apresentar bloqueados; categoria inválida protegida; correção não substitui o campo nem perde foco.
- **Histórico/contexto:** salvar antes reinicializava o histórico do Studio. Agora uma alteração salva pode ser desfeita/refeita e a seleção/categoria são preservadas.
- **Intervalos:** corrigir o fim após digitar um início temporariamente inválido podia perder o início digitado. Agora a validação lê o par completo do formulário sem gravar estados inválidos.
- **Solo/seleção:** a composição carregada contém cópias dos metadados. A visibilidade agora segue o modelo atual e é reaplicada após reconstrução; alças não aparecem em camadas fora do solo.
- **Durante a implementação:** a limpeza assíncrona de uma instância anterior removeu a classe do Studio recém-aberto. A reprodução revelou a reutilização do mesmo elemento do modal; token de propriedade e regressão impedem essa interferência. O elemento compartilhado de erro também permanece no seu local estrutural.
- **Categorias:** rolagem é independente por categoria/camada; não se herda arbitrariamente o offset de outro formulário.
- **Prévia:** uma atualização automática não muda mais o painel mobile para Canvas e não perde pausa/seek.

O primeiro ensaio de 1024 px encontrou um pixel de diferença causado pelo zoom externo do próprio fixture. O zoom foi removido do host e os quatro tamanhos foram executados com suas larguras CSS reais, sem tolerância para esconder overflow do app. As comparações de FX usam dimensões CSS fracionárias, evitando erro de arredondamento de offsetWidth ao comparar um preview pequeno com o quadro.

## Evidências e limites

O pacote contém logs de cada largura, movimento reduzido, vídeo, imagens originais e interações nativas; capturas antes/depois desktop e mobile. A comparação usa a mesma cena com figuras técnicas e a categoria Geral. Uma captura adicional mostra a versão com as artes originais; ela não é apresentada como comparação de layout idêntica.

Sem aparelho físico, Safari, Spotify conectado, conta real ou transmissão entre dispositivos. Este Chrome informa falta de aceleração/WebGL e não aprovou o probe de WebM alpha; o fallback foi validado, não se declara alpha funcional neste ambiente. Contraste e foco foram conferidos visualmente/por teclado; não houve auditoria WCAG automatizada nem teste com leitor de tela real.

Não foram adicionados redimensionamento de painéis por arraste, timeline profissional, efeitos ou novos tipos de mídia. Desfazer/refazer encerra a prévia; isso é deliberado para não executar uma composição anterior. O áudio da sessão continua independente.

Sem merge, deploy de produção ou alterações em snapshots/áudio/backend. O PR é para revisão.
