# CRIS · STUDIO-UX — backlog oficial UX-001 a UX-013

Registro: 28/11/2026. Repositório: `MateusAnastacio599/cris-reescritos`.

**Registro histórico da auditoria inicial (atualizações de implementação na seção 12): documentação e auditoria estática somente. Nenhuma melhoria deste backlog foi implementada nesta execução.** Este documento é a fonte de verdade para o escopo UX-001–UX-013; mantém a numeração e os critérios fornecidos pelo responsável do projeto. As prioridades, dependências, subdivisões e planos de validação abaixo são recomendações de planejamento, não resultados de homologação.

## 1. Objetivo e limites

O Cinematic Studio já possui composição avançada, mas ainda apresenta dificuldades de usabilidade, gerenciamento de arquivos, organização de propriedades e manipulação visual. A evolução deve oferecer a praticidade de um editor visual como o Canva, preservando os recursos cinematográficos desenvolvidos.

Preservar o renderer, CinematicFrame, Cinematics existentes, Audio Engine, cues, histórico, salvamento, mídia e integrações remotas. Reutilizar os modelos de camadas, luzes, câmera e janelas temporais; não criar um segundo player, transporte, sistema de disparo ou sistema de keyframes sem necessidade comprovada.

Nesta execução não alterar Studio, renderer, banco, políticas, campanhas reais ou PRs #33/#34. Não realizar merge nem publicação. Recursos existentes são registrados como base reaproveitável; a existência de botão, função, teste ou arquivo não equivale ao atendimento integral de um requisito.

## 2. Baseline e bloqueios de consolidação

| Referência | Estado considerado | Consequência |
| --- | --- | --- |
| `main` auditada | `277a8260a97f572fc7cc8ded9cdee0d0a3c70af1` | Base deste documento; merge do PR #33 presente |
| PR #33 — CLOUD-RELIABILITY-01 | Integrado; código em `51ba3f4bbb5a47abb88f3a66b2ecb3345a7b8a3a` | Migração SQL e sincronização real entre computadores **ainda precisam ser homologadas** |
| PR #34 — DIRECTOR-UX-03 | Rascunho; snapshot consultado `ce7faaecdb8d72d80ea9e2a7a76a485bf1734eda` | Alterações propostas não são tratadas como disponíveis na `main` nem como requisitos concluídos |

**G-33 (P0, externo aos 13 IDs):** homologar a migração SQL em ambiente isolado, acesso privado com contas distintas, sincronização PC A → notebook B, integridade, falhas e conflitos. Não declarar envio concluído ou disponibilidade em outro computador com base somente no seletor de arquivos ou nos testes simulados. Seguir [CLOUD-RELIABILITY-01](CLOUD-RELIABILITY-01.md). Este registro não aplica SQL nem homologa o backend.

**G-34 (P0, externo aos 13 IDs):** consolidar/revisar o destino do PR #34 e fixar a base de código antes da implementação do backlog. Ele altera `app.js`, `cinematic-editor.js`, `cinematic-layers-editor.js`, `cinematic-link.js`, `cinematic-scene-ui.js`, `cinematic-sequence.js`, `cinematic.css`, `index.html`, `markdown.js` e propõe `cinematic-import.js`. Rever o diff atualizado antes de qualquer PR futuro. Não copiar sua implementação para outra branch, criar uma otimização concorrente ou confundir conteúdo em rascunho com funcionalidade homologada.

A definição de prioridades/contratos e a documentação podem prosseguir enquanto os bloqueios permanecem abertos. A implementação das melhorias e sua liberação devem partir de uma baseline consolidada, com aprovação/homologação correspondente. Não há merge automático implícito neste planejamento.

## 3. Convenções de rastreabilidade

- **P1:** alta prioridade — operação de produção, segurança dos dados, clareza de estado ou enquadramento que afeta a apresentação.
- **P2:** evolução de produtividade/polimento, mantendo a prioridade funcional dos P1. A limpeza de demonstrações pode entrar num PR pequeno antes, se isolada e aprovada.
- **Pendente:** a capacidade solicitada não foi identificada no recorte auditado; pré-requisitos numéricos ou de modelo podem existir.
- **Parcial:** há implementação reaproveitável, mas falta escopo e/ou evidência de aceitação. **Não significa concluído.**
- **Concluído:** somente após todos os critérios, testes e evidências de uso exigidos, vinculados ao commit/PR aprovado. **Nenhum requisito está Concluído nesta auditoria.**

"Não identificado" descreve os arquivos e símbolos inspecionados, não prova ausência absoluta em qualquer parte do repositório. Erros relatados pelo usuário permanecem abertos sem reprodução. Testes e capturas históricos são referências, não execução de teste nesta etapa.

## 4. Matriz geral

| ID | Requisito | Prioridade | Estado auditado | Entrega oficial | Base / principal lacuna |
| --- | --- | --- | --- | --- | --- |
| UX-001 | Editor em tela ampla | P1 | Parcial | STUDIO-UX-01 | Diálogo amplo e painéis existem; workspace fora da experiência de popup e fullscreen do editor pendentes |
| UX-002 | CRUD completo das Cinematics | P1 | Parcial | STUDIO-UX-01 | CRUD/ordenação e exclusão com backup/reassociação implementados em STUDIO-UX-01A; recuperação pela UI e homologação final pendentes |
| UX-003 | Gerenciamento claro dos arquivos | P1 | Parcial | STUDIO-UX-01 | Cartões, nomes conhecidos/legados, substituir/remover e estados implementados em STUDIO-UX-01A; homologação cloud/dispositivos pendente |
| UX-004 | Campos e propriedades organizados | P1 | Parcial | STUDIO-UX-01 | Propriedades contextuais/CSS existem; consistência e usabilidade integral não homologadas |
| UX-005 | Valores compreensíveis | P1 | Parcial | STUDIO-UX-01 | Parte dos controles já usa %/graus/segundos; conversões e rótulos ainda não uniformes |
| UX-006 | Remover demonstrações do fluxo real | P2 | Pendente | STUDIO-UX-01 | Comandos de teatro de demonstração presentes no Fundo vivo |
| UX-007 | Erros e estados corretos | P1 | Parcial | STUDIO-UX-01 | Caixa de erro vazia corrigida e estados separados em STUDIO-UX-01A; homologação de falhas backend/dispositivos pendente |
| UX-008 | Separar edição de apresentação | P1 | Parcial | STUDIO-UX-01 | Cues já existem na main; Studio ainda apresenta; PR #34 propõe separar controles no Director |
| UX-009 | Manipulação visual das luzes | P2 | Pendente | STUDIO-UX-02 | Modelo e campos de luz existem; seleção/gizmos e arraste de luz não identificados |
| UX-010 | Transformações intuitivas | P2 | Parcial | STUDIO-UX-02 | Arraste/escala/seleção/histórico existem; rotação e âncora por alças pendentes |
| UX-011 | Reformular Tempo | P2 | Parcial | STUDIO-UX-02 | Trilhas/janelas e seek existem; edição temporal visual completa pendente |
| UX-012 | Prévia fiel e útil | P1 | Parcial | STUDIO-UX-02 | Mesmo player, prévia contain e apresentação cover; seletor dos três modos pendente |
| UX-013 | Corrigir o corte excessivo no celular | P1 | Parcial | MOBILE-FIT-01 | Medição local corrigida e nove viewports comparados no Chromium; homologação Android/PWA e fullscreen permitido pendentes |

A matriz tem **13 requisitos: 11 Parciais, 2 Pendentes, 0 Concluídos**. CRUD, gerenciamento de arquivos, luzes arrastáveis, timeline visual, fullscreen do editor e enquadramento mobile permanecem explicitamente abertos.

## 5. Auditoria de componentes reaproveitáveis

As linhas abaixo se referem à `main` fixada na seção 2; o nome do símbolo é a referência de manutenção quando as linhas mudarem.

| Evidência | Componente / símbolo | O que existe | O que não comprova |
| --- | --- | --- | --- |
| A01 | [cinematic-editor.js](../dist/cinematic-editor.js), `openCinematic`, `values`, `onSubmit`, `[data-duplicate]` | Seleção/criação, nome editável, salvar com validação/rollback e duplicação; estados de rascunho e carregamento | CRUD completo, exclusão de apresentação e análise de referências |
| A02 | [cinematic-model.js](../dist/cinematic-model.js), `withCinematic`, `duplicateCinematic`, `cinematicReferences` | IDs/validação, principal, revogação da autorização após edição, referências compartilhadas de imagem/WebM | Política de exclusão segura de composição/mídia/cues ou coleta de órfãos |
| A03 | [cinematic-studio-ui.js](../dist/cinematic-studio-ui.js), `arrangeStudio`, `captureContext`, `restoreContext`, `confirmStudio` | Cabeçalho, palco/dock, movimentação dos controles existentes, contexto/foco e confirmação | Workspace não modal ou fluxo de fullscreen do editor homologado |
| A04 | [cinematic-studio.css](../dist/cinematic-studio.css), `#appDialog.cinematic-studio-dialog`, `[data-expanded=true]` | Desktop até 98vw/96dvh, mobile 100dvh, três áreas, painéis recolhíveis e canvas ampliado por CSS | Saída da arquitetura de diálogo, fullscreen nativo ou ergonomia aprovada em aparelhos |
| A05 | [cinematic-layers-editor.js](../dist/cinematic-layers-editor.js), `add`, `addVideo`, `pool`, `updateControls`, pointer handlers | Adicionar/remover/duplicar/reordenar camadas; remover vídeo mantendo PNG; posição/escala por arraste; lock/solo/visibilidade e ajustes numéricos | Excluir Cinematic; gerenciamento completo dos arquivos; rotação/âncora visual; arrastar luz |
| A06 | [cinematic-layer-operations.js](../dist/cinematic-layer-operations.js), `duplicateCinematicLayer`; [cinematic-direction-model.js](../dist/cinematic-direction-model.js), `changeLayerAnchor` | Operações existentes de camada e âncora; evitar outra implementação matemática | Uma alça de âncora já pronta e validada |
| A07 | [cinematic-studio-history.js](../dist/cinematic-studio-history.js), `StudioHistory`; handlers do editor | Histórico do rascunho e restauração já usados pelo Studio | Que novos gestos, CRUD de apresentação ou remoção de mídia tenham undo correto automaticamente |
| A08 | [cinematic-studio-properties.js](../dist/cinematic-studio-properties.js), `StudioProperties`; [cinematic-camera-editor.js](../dist/cinematic-camera-editor.js), `CinematicCameraEditor` | Seções Geral/Fundo vivo/Câmera/Luzes/Tempo/Transformar/Efeitos; contexto por seção; vários controles com unidades e campos avançados | Padronização completa de unidades e ausência de problemas visuais/avisos persistentes |
| A09 | [cinematic-direction-editor.js](../dist/cinematic-direction-editor.js), `renderLights`; [cinematic-light-model.js](../dist/cinematic-light-model.js); [cinematic-light-player.js](../dist/cinematic-light-player.js) | Luzes/presets/feixes/campos numéricos/janelas e renderer de iluminação existente | Gizmos de luz no canvas. Os pointer handlers de A05 tratam view/camera/position/scale, não luzes |
| A10 | [cinematic-studio-ui.js](../dist/cinematic-studio-ui.js), `temporalTracks`, `renderTemporalDock` (linhas 23–34); [cinematic-direction-editor.js](../dist/cinematic-direction-editor.js), `renderWindows`; [cinematic-timing.js](../dist/cinematic-timing.js) | Trilhas de câmera/luz/FX/visibilidade/vídeo; barras start/end, playhead e clique para seek/inspeção; campos de janela/fades | Arrastar limites/mover trechos numa timeline visual completa ou novo modelo de keyframes |
| A11 | [cinematic-background-editor.js](../dist/cinematic-background-editor.js), `renderBackgroundMedia` (linhas 6–20) | Fundo WebM/fallback, estados locais, remoção de vídeo; botões `data-use-theater` / `data-use-theater-video` ainda ativos | Remoção das demonstrações em produção ou cartão completo de arquivo anexado |
| A12 | [cinematic-media.js](../dist/cinematic-media.js), `cinematicImages`, `imageKey`, validação/exportação; [cloud-cinematic-media.js](../dist/cloud-cinematic-media.js); [cloud-workspace.js](../dist/cloud-workspace.js) | IndexedDB, hashes, metadados cloud de tipo/tamanho/dimensões, backup e confirmação antes da revisão | Nome original sempre disponível; upload comprovado ao selecionar; backend homologado ou UX por arquivo concluída |
| A13 | [cinematic-cues.js](../dist/cinematic-cues.js), `sceneCinematicCue`, `CinematicCues.execute`; [app.js](../dist/app.js), `insertCinematicCue` | Reuso de blocos cue/triggers e ações cinematic-start/stop, com vínculos por IDs | Separação completa dos botões Studio/roteiro/lateral ou exclusão que já verifica todos os vínculos |
| A14 | [cinematic-editor.js](../dist/cinematic-editor.js), `new CinematicFrame(...,{fit:'contain'})`; [cinematic-frame.js](../dist/cinematic-frame.js); [cinematic-composition.js](../dist/cinematic-composition.js), `fitComposition` | Player compartilhado; enquadramento contain/cover, ResizeObserver e efeitos comuns | Seletor de modos de prévia desktop/mobile e equivalência visual homologada |
| A15 | [cinematic-presentation.js](../dist/cinematic-presentation.js), `begin`, `resize`, `requestMode`, `finish`; [cinematic.css](../dist/cinematic.css), `[data-landscape=true]` | Apresentação cover, viewport móvel, rotação CSS 90° com largura/altura trocadas, tentativa de fullscreen/orientação e restauração | Fullscreen do **editor**, orientação física garantida ou recorte mobile correto em todos os cenários |
| A16 | [cinematic-media-cache.js](../dist/cinematic-media-cache.js), `RemoteCinematicCache`; [cinematic-sequence.js](../dist/cinematic-sequence.js) | Cache temporário por hash/escopo e preparação progressiva; limites/expiração existentes | Cache permanente extra, preload de toda biblioteca ou nova autorização remota |

**PR #34, apenas referência de rascunho:** propõe levar controles de cena à Direção, dispensar vínculo do quadro para preload local, melhorar acessibilidade da cue, acrescentar diagnóstico e otimização PNG no import. Reaproveitar/reconciliar essas decisões após G-34; não implementá-las de novo. Não oferece CRUD completo, cartão de arquivos, luzes arrastáveis, alças de rotação/âncora, timeline editável, workspace fullscreen ou solução comprovada do corte mobile.

**Aviso de câmera (UX-007):** `CinematicCameraEditor.commit` já tenta limpar `cameraInvalid` e `[data-camera-error]` em valor válido; `error()` marca a condição. Isso é evidência de tratamento parcial, não causa confirmada do aviso persistente. Não foi reproduzido nesta execução. A investigação futura deve capturar valor, validity, estado do modelo e transições de seleção/salvamento.

## 6. STUDIO-UX-01 · Estrutura, CRUD e organização

### UX-001 · Editor em tela ampla

**Prioridade:** P1. **Estado:** Parcial. **Evidências:** A03–A04. **Dependências:** G-34; contrato de salvamento/rascunho de UX-002/UX-007. **Entrega:** STUDIO-UX-01B; desenho do workspace deve ser acordado antes dos gizmos/timeline.

**Requisitos oficiais:**

- Substituir a experiência de popup convencional por um workspace que ocupe a área útil da aplicação.
- Manter composição clara: camadas à esquerda, palco central, propriedades à direita e reprodução/tempo na região inferior.
- Oferecer recolhimento dos painéis.
- Preservar navegação, histórico, salvamento e retorno ao Director.
- Não quebrar responsividade nem contexto de edição.

**Critério de aceitação oficial:** o mestre consegue trabalhar na Cinematic utilizando a área disponível da aplicação, sem sentir que está editando dentro de uma janela pequena e limitada.

**Pendência e reaproveitamento:** reaproveitar `arrangeStudio`, painéis, contexto e histórico; não duplicar os controles. A janela atual é grande, mas continua `#appDialog`. Registrar separadamente fullscreen/ocupação da área útil do editor e fullscreen da apresentação; o segundo não encerra esta pendência. Definir se fullscreen nativo será uma ação opcional e seu fallback, sem prometer suporte irrestrito.

**Validação futura:** desktop 1366×768/1920×1080, zoom 125%/200%, viewport mobile portrait/landscape; abrir/recolher painéis sem distorcer o palco; editar, desfazer/refazer, salvar, sair e voltar; confirmação de alterações não salvas; restaurar foco e seleção. Capturas comparativas da área útil e retorno ao Director. Só aprovar após avaliação de uso, não apenas por dimensões CSS.

### UX-002 · CRUD completo das Cinematics

**Prioridade:** P1. **Estado:** Parcial. **Evidências:** A01–A02/A07/A13. **Dependências:** G-33/G-34; integração com UX-003/UX-007. **Entrega:** STUDIO-UX-01A.

**Requisitos oficiais:**

- Permitir criar, renomear, duplicar, excluir com confirmação, selecionar e organizar apresentações existentes.
- A exclusão deve verificar vínculos com cues e referências do roteiro, impedindo referências quebradas.
- Não excluir arquivos compartilhados com outras Cinematics sem verificar se continuam utilizados.

**Critério de aceitação oficial:** o mestre consegue gerenciar o ciclo de vida completo de uma apresentação sem recorrer a soluções alternativas ou manipulação manual de dados.

**Pendência e reaproveitamento:** criação/renomeação/salvamento/duplicação e IDs existentes são base parcial; exclusão de **camada** não é exclusão de **Cinematic**. Antes de excluir apresentação, inventariar ações de cues (inclusive compostas), triggers, blocos, timeline/início de cena quando referenciem a cue, principal e preload autorizado. Definir política explícita de bloqueio/reassociação/remoção consentida e possibilidade de recuperação. Organizar sem reatribuir IDs. Separar desassociação lógica da eventual limpeza de binários; a primeira entrega não deve coletar arquivos de outras composições por suposição.

**Validação futura:** CRUD completo após reabrir; excluir com e sem referências; cancelar confirmação sem mudança; apresentação principal e alternates; arquivo compartilhado por duas composições e/ou cenas; falha ao salvar/nuvem/conflito preserva versão anterior; backup/restauração. Comparar IDs, cues e hashes antes/depois. Evidenciar que nenhum roteiro ficou apontando para ID ausente.

### UX-003 · Gerenciamento claro dos arquivos

**Prioridade:** P1. **Estado:** Parcial. **Evidências:** A05/A11–A12. **Dependências:** G-33/G-34; UX-002 e contrato de estados de UX-007. **Entrega:** STUDIO-UX-01A.

**Requisitos oficiais:**

- O upload não deve permanecer permanentemente como “Escolher arquivo” após anexar um arquivo válido.
- Exibir nome quando conhecido; tipo/tamanho; miniatura quando aplicável; carregamento; confirmação de salvamento local; confirmação de sincronização na nuvem quando suportada.
- Oferecer **Substituir** e **Remover**. Após remover a associação, voltar ao seletor de arquivo.
- Não afirmar envio apenas porque um arquivo foi escolhido.
- Para arquivos antigos sem nome original armazenado, mostrar identificação alternativa sem inventar nome.

**Critério de aceitação oficial:** é possível identificar qual arquivo está vinculado à composição, se está disponível e como substituí-lo ou removê-lo.

**Pendência e reaproveitamento:** usar hash/IndexedDB/manifesto privado existentes; diferenciar rascunho escolhido, validado, salvo localmente, envio pendente/em curso/confirmado, disponível neste dispositivo e falha. “Salvo na nuvem” não equivale a offline/dispositivo preparado. Cuidar de fundo, camadas, fallback PNG e WebM. Definir metadado opcional compatível para nome original; identidade continua por hash. O PR #34 propõe variantes PNG e preservação local do original: reconciliar original/variante, sem duplicar seu pipeline ou afirmar que original sem referência está na nuvem.

**Validação futura:** anexar, aguardar validação, salvar/reabrir, substituir/remover/cancelar; nome legado desconhecido; mesmo hash usado em duas composições; falta local, falta cloud, hash divergente, rede/quota; mídia enviada mas revisão não confirmada; reload no notebook. Não limpar cache compartilhado ao remover só uma associação. Testar miniatura e estado de PNG/WebM/fallback sem decoder extra permanente.

### UX-004 · Campos e propriedades organizados

**Prioridade:** P1. **Estado:** Parcial. **Evidências:** A03–A04/A08. **Dependências:** UX-001; UX-003/UX-005/UX-007 para linguagem e estados. **Entrega:** STUDIO-UX-01B.

**Requisitos oficiais:**

- Corrigir desalinhamento de inputs e rótulos.
- Padronizar larguras, alturas, espaçamentos e unidades.
- Evitar pares de campos com rótulos quebrados e tamanhos incompatíveis.
- Organizar propriedades por finalidade.
- Controles simples inicialmente e opções avançadas progressivas.

**Critério de aceitação oficial:** os painéis ficam legíveis, consistentes e organizados, sem campos desalinhados ou configurações espalhadas.

**Pendência e reaproveitamento:** reutilizar seções contextuais `StudioProperties`, campos e captura/restauração de foco/scroll; não adicionar outro painel concorrente. A presença de CSS padronizado não comprova a ergonomia relatada pelo usuário.

**Validação futura:** matriz visual das abas Geral/Fundo vivo/Câmera/Luzes/Tempo/Transformar/Efeitos; rótulos longos, números com precisão, erros, controles desabilitados; desktop/mobile, zoom e teclado. Nenhuma unidade/rótulo importante cortado; troca de seção preserva contexto sem impedir correção de erro.

### UX-005 · Valores compreensíveis

**Prioridade:** P1. **Estado:** Parcial. **Evidências:** A05/A08. **Dependências:** UX-004 para organização final; contrato de conversão pode ser definido antes. **Entrega:** STUDIO-UX-01B.

**Requisitos oficiais:**

- Substituir números técnicos descontextualizados por controles legíveis.
- `0,08` → `8%` e `0,35` → `35%`, quando representarem porcentagem.
- Rotação em graus; tempo em segundos.
- Escala com slider e campo numérico opcional.
- Preservar precisão interna e compatibilidade com composições antigas.

**Critério de aceitação oficial:** o mestre entende o que cada valor representa sem precisar conhecer a estrutura matemática interna do renderer.

**Pendência e reaproveitamento:** posição/escala/âncora/câmera já têm algumas conversões e slider de escala; opacidade, parallax e propriedades de luz/FX ainda usam convenções diferentes. Mapear cada grandeza antes de apresentar porcentagem — não converter indiscriminadamente valores de naturezas distintas. Alterar a apresentação do valor sem arredondar ou regravar o modelo quando nada mudou.

**Validação futura:** round-trip UI ↔ modelo para %/graus/segundos/escala; limites, negativos permitidos, separador decimal e acessibilidade; reabrir dados legados e salvar sem alteração com precisão preservada. Comparar composição renderizada antes/depois e documentar unidades de cada controle.

### UX-006 · Remover demonstrações do fluxo real

**Prioridade:** P2. **Estado:** Pendente. **Evidência:** A11. **Dependências:** G-34; não depende da implementação de luzes/timeline. **Entrega:** STUDIO-UX-01B, podendo ser PR pequeno isolado após consolidação.

**Requisitos oficiais:**

- O editor de Fundo vivo ainda oferece carregar o teatro de demonstração.
- Retirar esses comandos da interface principal de produção.
- Preservar fundo vivo e arquivos WebM.
- Não eliminar recursos do renderer.

**Critério de aceitação oficial:** o editor apresenta ferramentas de produção reais, sem botões de demonstração misturados ao fluxo de criação.

**Pendência e reaproveitamento:** remover futuramente a exposição de ações de demonstração, sem apagar mídia já referenciada nem inutilizar fixtures/validação. Não confundir remover botão de exemplo com remover o upload de fundo vivo.

**Validação futura:** abrir Fundo vivo na distribuição real e verificar ausência dos comandos de teatro; anexar WebM próprio, salvar, reabrir, usar fallback e apresentar; composição antiga que utiliza os assets de exemplo continua legível. Nenhum renderer ou transporte alternativo.

### UX-007 · Erros e estados corretos

**Prioridade:** P1. **Estado:** Parcial. **Evidências:** A01/A08/A12 e observação de câmera na seção 5. **Dependências:** G-33/G-34; contrato compartilhado com UX-002/UX-003. **Entrega:** STUDIO-UX-01A, com revisão em 01B.

**Requisitos oficiais:**

- Investigar o aviso vermelho persistente das propriedades de câmera.
- Mostrar erro somente diante de condição inválida real; limpar imediatamente ao corrigir.
- Distinguir validação, arquivo indisponível, alterações não salvas, upload em andamento, arquivo sincronizado e prévia pronta.
- Evitar mensagens permanentes de erro sem problema ativo.

**Critério de aceitação oficial:** o Studio não exibe erros inexistentes e informa claramente o estado real de arquivos e alterações.

**Pendência e reaproveitamento:** usar validações/dirty/busy já existentes e resultados reais do fluxo cloud. Investigar sem presumir causa do aviso vermelho; registrar reprodução antes da correção. Estados de formulário, persistência, transporte e player têm escopos distintos, mesmo que apareçam no mesmo local. Não usar retry cego nem apagar silenciosamente valores inválidos para esconder o erro.

**Validação futura:** sequência inválido → válido sem trocar de aba; presets, câmera ativada/desativada, chegada/permanência/fades; troca de seleção e desfazer/refazer; importação lenta, mídia ausente, erro de decoder, upload/revisão parcial e conflito. Verificar texto, flags e botões; status pronto apenas após a etapa correspondente ter sucesso.

### UX-008 · Separar edição de apresentação

**Prioridade:** P1. **Estado:** Parcial. **Evidências:** A01/A13 e proposta do PR #34. **Dependências:** G-34; UX-002 para preservar referências; UX-001 para posicionamento final. **Entrega:** STUDIO-UX-01B.

**Requisitos oficiais:**

- Studio prioriza **Criar, Editar, Salvar e Prévia**.
- Apresentação real aos jogadores principalmente pelo roteiro e pelas cues existentes.
- Preservar mecanismo de teste sem criar segundo fluxo remoto.

**Critério de aceitação oficial:** o mestre prepara suas Cinematics no Studio e as apresenta de forma prática durante a narração, sem precisar interromper o roteiro para navegar pelo editor.

**Pendência e reaproveitamento:** `sceneCinematicCue`, triggers/blocos, `CinematicCues` e o fluxo coordenado já existem na main. Reconciliar o PR #34, que move controles à Direção e evita duplicações; não reimplementar suas cues. Definir a distinção entre prévia local e teste remoto explícito, sem remover compatibilidade manual existente antes de validar o fluxo substituto.

**Validação futura:** criar/salvar, inserir cue num ponto do texto, selecionar cena → preparar → ler → Disparar → pré-roll → apresentação coordenada → preparar próxima → continuar leitura. Testar encerramento/substituição/reentrada, imagem/WebM, mestre desktop/jogador mobile. Não abrir Studio para disparar algo já preparado; áudio e segurança mantidos.

## 7. STUDIO-UX-02 · Edição visual e timeline

### UX-009 · Manipulação visual das luzes

**Prioridade:** P2. **Estado:** Pendente. **Evidências de base:** A05/A09. **Dependências:** UX-001/UX-004/UX-005; reutilizar infraestrutura de gestos/histórico de UX-010 e validar paridade de UX-012. **Entrega:** STUDIO-UX-02A.

**Requisitos oficiais:**

- Selecionar luzes diretamente sobre a composição.
- Controles visuais para arrastar posição, ajustar alcance, girar direção/feixe, alterar intensidade, ajustar suavidade e mostrar/ocultar área de influência.
- Preservar campos numéricos avançados para precisão.
- Respeitar limites do motor e manter iluminação consistente entre Studio e apresentação remota.

**Critério de aceitação oficial:** o mestre consegue posicionar e orientar luzes arrastando controles sobre a própria cena, sem depender exclusivamente de campos numéricos.

**Pendência e reaproveitamento:** há presets, spots/feixes, posições/raios/ângulos/intensidade/softness numéricos e player de luz. Não foram identificados handles e seleção de luz nos pointer handlers auditados. Usar o mesmo modelo/validação; gizmos são ferramentas do editor, não overlays enviados aos jogadores ou um novo motor de luz.

**Validação futura:** seleção inequívoca, posição/raio/direção/intensidade/suavidade por gizmo e campo sincronizados, lock/modo editar, zoom/pan/câmera, teclado e toque; um gesto → histórico coerente; comparar mesmo instante e parâmetros no Studio/quadro local/remoto. Não deixar handles na apresentação e não duplicar iluminação.

### UX-010 · Transformações intuitivas

**Prioridade:** P2. **Estado:** Parcial. **Evidências:** A05–A08. **Dependências:** UX-001/UX-004/UX-005; servir de base de gestos para UX-009. **Entrega:** STUDIO-UX-02A, antes/com a manipulação de luz.

**Requisitos oficiais:**

- Aprimorar arraste, redimensionamento, rotação por alças visuais e ajuste de ponto de ancoragem.
- Desfazer/refazer; manter seleção visível e clara.
- Reutilizar operações de camada existentes.

**Critério de aceitação oficial:** posicionar, girar e redimensionar uma camada deve ser tão direto quanto manipular um elemento num editor visual moderno.

**Pendência e reaproveitamento:** já existem arraste, alça de escala, rotação numérica, presets/campos de âncora, teclado, lock/solo/visibilidade e histórico. Não equiparar rotação numérica a alça visual nem âncora numérica a manipulação direta. Usar `changeLayerAnchor`/operações existentes para não provocar saltos ao mudar a âncora.

**Validação futura:** camadas pequenas/grandes/rotacionadas/transparentes e com WebM; zoom/pan/câmera e âncora fora do centro; mouse/toque/teclado, cancelamento/perda de pointer capture, lock; múltiplas ações e undo/redo; salvar/reabrir sem alterar camadas não selecionadas. Um gesto não cria dezenas de snapshots de histórico.

### UX-011 · Reformular Tempo

**Prioridade:** P2. **Estado:** Parcial. **Evidências:** A10/A07. **Dependências:** UX-001/UX-004/UX-005 e contrato de validação de UX-007; não depende de novo sistema de keyframes. **Entrega:** STUDIO-UX-02B.

**Requisitos oficiais:**

- Tempo e Intervalos da cena devem formar uma timeline visual compreensível.
- Trilhas de movimento de câmera, luzes, efeitos, vídeos e camadas animadas quando aplicável.
- Mostrar início/fim, localizar playhead, pré-visualizar instante e, quando suportado pelo modelo, arrastar limites das janelas.
- Preservar controles avançados de duração/fades.
- Aproveitar o modelo temporal existente; não introduzir keyframes sem necessidade.

**Critério de aceitação oficial:** o mestre identifica visualmente quando cada acontecimento ocorre e ajusta intervalos sem precisar entender antecipadamente todas as janelas temporais.

**Pendência e reaproveitamento:** `temporalTracks`, barras, playhead, seek e `renderWindows` são base. Hoje o clique da barra salta ao início e a edição é feita nos campos; não há evidência de arraste/resize temporal completo. Definir a relação entre Tempo e o dock para evitar dois editores divergentes da mesma janela. Preservar valores legados/scene/interval, duração independente e limites de fades; não inventar suporte temporal que o modelo não tem.

**Validação futura:** trilhas de cada tipo com sobreposição/intervalo integral/legado; scrubbing pausado/tocando, limites por mouse/toque e alternativa numérica/teclado; clamp/erro claro quando start/end/fades inválidos; mudança de duração, zoom temporal, desfazer/refazer e reabertura. Comparar os mesmos instantes no player atual, incluindo WebM e redução de movimento.

### UX-012 · Prévia fiel e útil

**Prioridade:** P1. **Estado:** Parcial. **Evidências:** A09/A14–A15. **Dependências:** UX-001; contrato de viewport de UX-013 para modo mobile; UX-009/UX-011 para homologar luzes/tempo novos. Definir o contrato visual antes, validar integralmente ao final. **Entrega:** STUDIO-UX-02B.

**Requisitos oficiais:**

- Prévia fiel a iluminação, câmera, efeitos e vídeo.
- Modos: composição completa 16:9; apresentação desktop cover; apresentação mobile com palco rotacionado.
- Não distorcer composição para preencher o workspace.

**Critério de aceitação oficial:** o mestre verifica antecipadamente como a Cinematic será exibida em dispositivos diferentes, sem diferenças inesperadas de enquadramento ou iluminação.

**Pendência e reaproveitamento:** o mesmo CinematicFrame já é usado. Studio usa contain; apresentação usa cover e adaptação mobile. Não existe no recorte um seletor integrado que simule os três modos. Reutilizar fit e adaptação consolidados em UX-013; não manter uma cópia diferente da matemática de enquadramento. Não contar o teste com assunto centralizado como paridade visual completa.

**Validação futura:** composição idêntica no mesmo timestamp nos três modos e no quadro; marcadores/rostos nas bordas, câmera, vinheta/escuridão, luzes, camadas transparentes e WebM; alteração do viewport sem mudar dados ou reiniciar a timeline. Separar suporte real a alpha de fallback PNG; capturas e parâmetros vinculados ao commit/dispositivo.

## 8. MOBILE-FIT-01 · Enquadramento da apresentação

### UX-013 · Corrigir o corte excessivo no celular

**Prioridade:** P1. **Estado:** Parcial — correção implementada para revisão; homologação Android/PWA pendente. **Evidências:** A14–A15. **Dependências:** G-34 e baseline estabilizada do player; definir contrato de viewport para UX-012. Não deve esperar toda a reformulação do Studio. **Entrega:** MOBILE-FIT-01, independente.

**Requisitos oficiais:**

- Revisar o corte excessivo das laterais pelo cover.
- Considerar viewport efetivo em portrait 9:16, rotação artificial 90°, landscape físico, safe areas, barra do navegador e atualizações durante reprodução.
- Priorizar conteúdo importante visível, preservando proporção 16:9.
- Permitir recorte proporcional limitado quando necessário, sem distorcer personagens nem reiniciar a timeline.
- Validar personagens próximos às bordas, não somente assunto centralizado.
- Não prejudicar cover desktop.

**Critério de aceitação oficial:** no celular, o jogador consegue assistir com enquadramento adequado, sem perder grande parte da cena por recorte excessivo.

**Pendência e reaproveitamento:** cover, ResizeObserver e rotação CSS já existem; isso não comprova que o viewport efetivo é medido corretamente nem que o recorte é aceitável. Auditar dimensões antes/depois da rotação e interação com visual viewport/safe areas/barras. Não concluir que forçar fullscreen/orientação resolve o cálculo. Definir exemplos e limite de recorte aprovados com o responsável antes da correção; não inventar um percentual como requisito oficial. Preservar o player/tempo e isolar o ajuste de enquadramento; nenhuma alteração do renderer nesta execução documental.

**Validação futura:** Windows desktop cover como controle; Android físico navegador/PWA em portrait e landscape; iOS se ambiente disponível, com limitações declaradas; barra expandida/recolhida, fullscreen permitido/negado, rotação durante câmera/WebM, retorno ao quadro. Usar cena 16:9 com personagens/rostos e marcadores nos dois extremos e no centro, registrar retângulo efetivo, proporção e área perdida. Verificar posições importantes, ausência de distorção, mesmo timestamp após resize e nenhuma regressão desktop. Viewport emulado não substitui homologação física.

**Atualização MOBILE-FIT-01 (28/11/2026):** base `b151128`, após merge de #36. `fitComposition` usava o retângulo visual já rotacionado para dimensionar o mundo no frame horizontal. Correção usa `clientWidth/clientHeight` e `ResizeObserverEntry.contentRect`, preservando rotação 90°, cover, câmera e timeline. Na referência da mansão em 390 × 844, recorte X/Y passou de 50,60%/53,79% para 0%/6,47%; na fixture 16:9, de 43,75%/53,79% para 0%/17,85%. As três resoluções desktop mantiveram dimensões idênticas. **646/646 testes**, check e integração aprovados. Continuidade de câmera e dois WebM exercitada no Chromium com componentes reais; dados de teste e viewports em iframe, sem conta ou transporte real. Não houve Android/PWA físico nem fullscreen permitido real (API recusada no ensaio). [Relatório, capturas, medidas e roteiro de homologação](MOBILE-FIT-01.md). Branch `fix/mobile-fit-01-cinematic-framing`; PR será registrado após abertura. **UX-013 permanece Parcial**, sem implementação dos demais IDs.

## 9. Dependências e divisão das entregas futuras

A divisão oficial permanece intacta: **STUDIO-UX-01 = UX-001 a UX-008; STUDIO-UX-02 = UX-009 a UX-012; MOBILE-FIT-01 = UX-013**. As letras abaixo são subdivisões para PRs menores; não criam novos IDs nem removem escopo.

| Ordem / futura entrega | Requisitos preservados | Dependências / saída necessária |
| --- | --- | --- |
| 0 · Consolidação dos PRs atuais | G-33 e G-34 (externos ao backlog) | Homologação cloud real e decisão sobre a base de #34; não misturar rascunhos com main |
| 1 · STUDIO-UX-01A — ciclo de vida, arquivos e estados | UX-002, UX-003, UX-007 | Política de vínculos/exclusão, identidade de mídia, rascunho/local/cloud e recuperação; manter ações reutilizáveis pela futura UI |
| Independente, após ordem 0 · MOBILE-FIT-01 | UX-013 | PR próprio sobre player consolidado; pode avançar em paralelo ao 01A se alterações não se sobrepuserem. Define contrato mobile para UX-012 |
| 2 · STUDIO-UX-01B — workspace e organização | UX-001, UX-004, UX-005, UX-006, UX-008; revalidar UX-007 | Reutilizar ações/estados do 01A e cues consolidadas de #34; fechar toda a Entrega 1, inclusive CRUD e arquivos, antes de considerá-la aceita |
| 3 · STUDIO-UX-02A — manipulação no palco | UX-010 e UX-009 | Workspace/seleção/histórico/unidades estáveis; operações de camada antes/com gizmos de luz; nenhum motor novo |
| 4 · STUDIO-UX-02B — tempo e prévia por dispositivo | UX-011 e UX-012 | Modelo temporal atual; contrato de UX-013; paridade das novas interações, sem player/keyframes paralelos |
| 5 · Homologação integrada das entregas | Todos os 13 IDs, sem encerramento automático | Verificar critérios individuais, dados legados, cloud real, áudio/cues/remoto e dispositivos; anexar evidências por requisito |

**Sequência recomendada:** consolidar #33/#34 → garantir CRUD/arquivos/estados → corrigir mobile em PR independente, sem esperar toda a UX → workspace/propriedades/unidades/demonstrações/fluxo por cues → transformações e luzes visuais → timeline e prévias por dispositivo → homologação conjunta. Se houver equipes distintas, MOBILE-FIT-01 pode ocorrer em paralelo após a consolidação; não é autorização para implementações concorrentes nesta execução.

Dependências que não devem virar ciclos artificiais: UX-004 e UX-005 compartilham contrato de unidades, mas podem ser entregues no mesmo PR; UX-003 e UX-007 compartilham contrato de estados; UX-012 define exemplos visuais cedo e conclui homologação após UX-013/UX-009/UX-011. A avaliação final de paridade não bloqueia a especificação inicial desses recursos.

## 10. Critérios transversais de aceite e evidências

Antes de mudar um ID para Concluído, registrar: PR/commit integrado, critérios oficiais cobertos, testes relevantes executados com resultado, capturas ou gravação de uso real, ambiente/navegador/dispositivo e limitações. Cada ID deve possuir evidência própria; um teste de importação não comprova fullscreen nem um snapshot do centro comprova enquadramento nas bordas.

Matriz mínima das futuras entregas:

- **Dados/CRUD:** IDs e referências estáveis; cues compostas/roteiro/principal; mídias compartilhadas, cancelamento, falhas, backup e recuperação.
- **Arquivos/cloud:** seleção ≠ validação ≠ salvo local ≠ upload confirmado ≠ revisão confirmada ≠ pronto neste dispositivo; integridade, quotas, contas distintas e PC A/notebook B.
- **Editor:** teclado/toque/mouse, foco/scroll/seleção, atalhos, undo/redo, campos/unidades e layout sem perda de precisão.
- **Tempo/renderer:** mesma composição e timestamp, imagem/WebM/alpha/fallback, câmera/luz/FX, encerramento/substituição/reconexão e reduced motion.
- **Dispositivos:** capturas desktop/mobile reais quando disponíveis; orientação/safe areas/barras; subjects nas bordas; limites de CPU/memória/decoder documentados.
- **Preservação:** Audio Engine/cues/quadro/transporte e conteúdo privado sem regressão; não migrar campanhas reais para testar UX.

Reexecutar `npm --prefix campaign-director run check`, `npm --prefix campaign-director test` e `node campaign-director/scripts/check-integration.mjs` nas futuras alterações de aplicação, além dos testes específicos de cada entrega. Esse checklist é planejamento; **não foi executada nova homologação funcional, visual, de banco ou de dispositivo nesta auditoria documental**.

## 11. Registro desta execução

- Fonte do escopo: lista oficial UX-001–UX-013 fornecida pelo responsável nesta conversa, incorporada sem exclusão ou renumeração.
- Método: inspeção estática dos componentes/símbolos da seção 5 e diff somente de leitura main ↔ snapshot do PR #34.
- Artefato: somente este arquivo de documentação, em branch documental independente da main e dos PRs #33/#34.
- Não implementados: novo layout, CRUD, cartões de arquivo, conversões, correção de câmera, remoção de demos, gizmos, timeline, modos de prévia e correção de enquadramento.
- Não realizados: mudanças no renderer/Studio/banco/campanhas, aplicação SQL, rebase ou alteração de #33/#34, merge/publicação e declaração de funcionalidades concluídas.

## 12. Atualização STUDIO-UX-01A · 28/11/2026

Base de implementação: `f4958ba5045d2ae47a2be628efda089e62c7e9e7`, após os merges de #33, #34 e #35. A auditoria inicial e seus snapshots acima permanecem históricos. G-34 está consolidado na base; **G-33 continua aberto para SQL/RLS e sincronização real entre computadores**. Nenhum SQL foi aplicado nesta entrega.

Branch: `feature/studio-ux-01a-crud-media-status`. PR: [#36 — STUDIO-UX-01A, em rascunho](https://github.com/MateusAnastacio599/cris-reescritos/pull/36). Commit de implementação: `86d70cb1a8b175ea63ce24c4a97b2d451b9428cb`. Evidências, capturas, limitações e roteiro de homologação: [STUDIO-UX-01A.md](STUDIO-UX-01A.md).

| ID | Evidência nova | Estado e aceitação restante |
| --- | --- | --- |
| UX-002 | `cinematic-crud.js`: confirmação, inventário/reassociação de ações, principal, ordenação, backup completo verificado, rollback; regressões em `cinematic-crud.test.js`; CRUD e exclusão exercitados no Chrome com dados fictícios | **Parcial**: exportação/restauração completa pela UI de recuperação e homologação em dispositivos ainda necessárias. Nenhum blob físico é excluído; última apresentação vinculada exige retirar vínculos antes |
| UX-003 | `cinematic-file-card.js` integrado a fundo/camadas/PNG/WebM; nome opcional, MIME/tamanho, miniatura, substituir/remover, hash e disponibilidade; reabertura PNG/WebM verificada no Chrome; testes de status/nomes | **Parcial**: sincronização real entre computadores e homologação Windows/Android pendentes; manifesto da última revisão confirmada não é consulta contínua ao Storage |
| UX-007 | `.cinematic-studio .form-error:empty` remove caixa vermelha vazia (24 px → 0 px); erro verdadeiro de câmera limpa ao corrigir; estados local/rascunho/cloud separados e confirmação por conta/caminho/hash/tipo/tamanho | **Parcial**: falhas reais de backend, conflitos e dispositivos ainda precisam de homologação. Sem falso “Salvo na nuvem” pelo simples upload escolhido |

Validação automatizada: **641/641 testes**, check e integração aprovados. Base antes das mudanças: 624 testes. UI real do Studio testada em Chrome, conta/armazenamento remoto/rede simulados; não equivale a Supabase real, WebRTC independente ou celular físico. O evento de download do backup não foi obtido na automação. O seletor final de versões de recuperação tem testes de helpers, mas não um novo ensaio completo pela UI.

Os 13 IDs e seus critérios oficiais permanecem preservados: **11 Parciais, 2 Pendentes, 0 Concluídos**. UX-001/004/005/006/008/009/010/011/012/013 continuam abertos. Renderer, Audio Engine, enquadramento mobile e campanhas reais não foram modificados.
