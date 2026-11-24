# CINEMATIC-01.6 — Studio Experience & Polish

Base verificada: `b7acecb01e86cbd7350361b18b7c316bb574472e`, main com PR #22 / CINEMATIC-01.5B integrado. Branch: `feature/cinematic-01-6-studio-experience-polish`.

## Escopo e decisões

Refinamento de interface e estabilidade da Cinematic existente. Sem efeitos novos, tipos de mídia, mudança de contrato persistido, migração de apresentações ou dependências adicionais. Não altera Audio Engine, Spotify, cues, backend ou snapshots do quadro. Não houve merge ou publicação.

O Studio continua usando o mesmo modal, modelo, armazenamento por hash, orçamento de mídia, relógio e player compartilhado. A interface foi separada em `cinematic-studio-ui.js` e `cinematic-studio.css`, evitando ampliar o arquivo de estilos do player com novas camadas de sobrescritas. Os estilos antigos específicos do Studio foram substituídos; o restante da Cinematic permanece separado.

## Área de trabalho

- Nome, apresentação, estado de salvamento e ações principais no cabeçalho. Salvar fica junto de Prévia e Apresentar; opções menos frequentes ficam em um menu secundário. Encerrar apresentação aparece quando há uma apresentação ativa.
- Lista visual de camadas com nome, ordem, mídia/FX, seleção, visibilidade, bloqueio e indicação de solo. Setas correspondem à posição na lista: subir é mover para trás; descer, para frente. Ações rápidas reutilizam as operações existentes.
- Propriedades distinguem **Apresentação** e **Camada**. Efeitos têm parâmetros principais e ajustes avançados recolhíveis, além de acesso direto a intervalo/fades. Categorias e camadas mantêm seus próprios estados de rolagem e expansão durante a sessão.
- Composição central flexível; painéis podem ser recolhidos ou ocultados com Área ampliada. Canvas, botões de visualização e controles de transporte têm lugares estáveis.
- Reprodução e direção temporal ficam em uma faixa inferior compacta. As faixas identificam câmera, luz, FX, mídia e visibilidade com cores discretas, início/fim e playhead. Clicar na faixa busca aquele instante da prévia e pausa; clicar no nome abre o intervalo existente no inspetor.
- O canvas usa enquadramento **contain**, mostrando a composição inteira com área neutra ao redor quando necessário. Zoom/pan continuam sendo apenas do visualizador. A opção `fit: 'contain'` é usada na prévia do Studio; o player do quadro mantém `cover` como padrão. Não é um novo player nem um campo salvo.
- Até 900 px, Camadas/Canvas/Propriedades usam uma área por vez. Selecionar uma linha de camada no mobile leva diretamente às suas propriedades. Arrastar no canvas continua no canvas.

Não foi adicionado redimensionamento por arraste dos painéis. Recolhimento, área ampliada e distribuição responsiva atenderam ao fluxo essencial sem um novo sistema de layout. Continua o limite de 12 camadas e os orçamentos da 01.5B.

## Edição e previsibilidade

Parâmetros numéricos inválidos mantêm o último modelo válido, mostram feedback e bloqueiam Salvar/Apresentar/Prévia. A mudança de categoria/seleção não descarta silenciosamente o campo inválido: primeiro é necessário corrigi-lo ou desfazer.

A edição de um FX usa cópia validada pelo validador existente; não altera diretamente um objeto persistido com valores incompletos. Câmera e intervalos não reconstroem o formulário numérico a cada alteração. A interface preserva foco/caret quando precisa reconstruí-lo. Campos de início/fim são validados em conjunto: digitar início 8 enquanto o fim ainda é 4 pode ficar temporariamente inválido; corrigir o fim para 12 preserva o início digitado.

Salvar mantém camada/categoria, contexto do inspetor, histórico e arquivos necessários para desfazer. A prévia pausada conserva sua posição. `Ctrl+S` usa o mesmo salvamento explícito; não salva no banco nem publica. `Ctrl+Z`/`Ctrl+Y` continuam usando o histórico do Studio. Desfazer/refazer encerra a prévia para evitar reproduzir uma composição anterior; o áudio da sessão não é afetado.

Excluir camada exige confirmação inline e pode ser desfeito. Fechar ou trocar de apresentação com alterações pendentes também pede confirmação, sem abrir outro modal sobre o Studio. Duplicação e reordenação continuam usando os IDs e arquivos compartilhados existentes.

## Estabilidade

- Instâncias do Studio têm um identificador temporário no DOM. Limpeza, callbacks e resultados assíncronos antigos não podem remover as classes nem atualizar os controles de uma nova abertura do mesmo modal.
- Restauração de contexto é feita por categoria e, para propriedades locais, por camada. Isso evita reaplicar a rolagem de um formulário longo a uma categoria diferente.
- Solo/visibilidade são reaplicados a partir do modelo atual após reconstruir a composição, sem depender das cópias de metadados carregadas anteriormente. Uma camada oculta pelo solo não ganha alças de transformação.
- Atualizar parâmetros durante a prévia preserva pausa/seek e o painel mobile atual; só um comando explícito de Prévia leva ao canvas. A intenção de atualização é vinculada à chamada, sem um booleano global sujeito a concorrência.
- O elemento de erro compartilhado do modal permanece fora da região de conteúdo substituída. O Studio continua podendo fechar e reabrir, sem danificar outros formulários.
- Carregamento usa o estado existente de mídia, feedback no cabeçalho e `aria-busy` no canvas. Não foram criados novos decodificadores, timers de efeitos ou instâncias de áudio.

## Como conferir

1. Abrir uma cena de teste → Ferramentas → Cinemática. Escolher fundo ou usar o teatro corrigido já disponível.
2. Adicionar/selecionar uma camada pela lista; ajustar posição e FX. Em mobile, tocar a linha para abrir propriedades; usar Canvas para manipular visualmente.
3. Testar um parâmetro inválido e corrigi-lo; conferir Salvar/Apresentar. Abrir Intervalo e fades ou a faixa temporal correspondente.
4. Prévia → pausar → buscar instante → ajustar FX sem perder foco. Salvar com Ctrl+S, desfazer/refazer e reabrir.
5. Apresentar no quadro local; substituir/encerrar ou trocar de cena. Conferir snapshot e continuidade do áudio.

Demonstração isolada: `node tests/fixtures/cinematic-demo.mjs <diretório-novo>`; servir a pasta `public/` e abrir `polish.html?width=1440`, `?width=1024`, `?width=768` ou `?mobile`. O botão executa o fluxo base e regressões da 01.6. A cópia de QA substitui somente identidade/persistência por dados fictícios e não deve ser publicada. `?width=1440&reduced&mirror` também exercita preferência reduzida e a cópia integrada do quadro.

## Limites conhecidos

Sem teste em aparelhos físicos, Safari, GPU de pouca memória, conta real ou Spotify conectado. O áudio conferido foi local. WebM opaco funcionou; suporte alpha permanece dependente do navegador, com fallback PNG e aviso. Não há transmissão remota nova, timeline profissional, multisseleção, novos efeitos ou recursos de pós-produção.

Alguns termos e unidades técnicas herdados permanecem nos ajustes avançados. Mídias maiores ainda exigem decodificação; a composição exibe carregamento e conserva os limites anteriores. O refinamento não promete remover toda espera de mídia.

Resultados e evidências estão em `cinematic-01-6-validation.md` e no pacote de revisão.
