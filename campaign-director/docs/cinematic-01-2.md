# CINEMATIC-01.2 · Quadro vivo, acessibilidade e cues

Base de integração `a7db238c710b7e3d857b317cc634a6dddbd713d1`, contendo o PR #16 e a CINEMATIC-01.1. Branch de desenvolvimento `feature/cinematic-01-2-live-frame`.

## Uso em mesa

Prepare uma imagem em **Ferramentas → Cinemática**, escolha o preset e teste na **Prévia**. Salve para liberar **Apresentar**. A mensagem de atividade informa o nome da apresentação e o estado de movimento da janela do quadro. **Encerrar apresentação** permanece disponível no formulário e no roteiro durante a apresentação.

Os dez presets são Estático, Aproximação, Afastamento, Panorâmica, Ambiente vivo, Respiração, Revelação, Tensão, Memória e Aparição. Memória usa deslocamento cíclico, luz suave, vinheta e foco discreto. Aparição combina aproximação, clareamento e recuperação progressiva do foco. Os efeitos usam Web Animations API e CSS sobre a imagem original, com `object-fit:cover`.

Configure duração do movimento de 3 a 60 segundos, intensidade de 0 a 30%, permanência de 0 a 20 segundos e fades de 0 a 5 segundos. A entrada acontece dentro da duração do movimento. A duração total automática é movimento + permanência + saída, com até 30 ms adicionais para concluir a remoção após o fade. Ambiente vivo, Respiração, Tensão e Memória admitem repetição contínua. Os demais presets encerram automaticamente. Novas apresentações continuam usando encerramento automático por padrão.

## Acessibilidade

Cada janela detecta `prefers-reduced-motion` e mostra um aviso quando essa preferência está ativa. O fallback mantém a imagem estática e os fades suaves. O mestre pode escolher **Permitir movimentos nesta ferramenta**, ou voltar a **Respeitar movimento reduzido**. A escolha fica em `sessionStorage` da janela e se aplica exclusivamente à Cinematic.

A prévia e a janela do quadro possuem decisões locais independentes. Se o quadro continuar com movimento reduzido, o Director informa essa condição e orienta a liberar o movimento na janela do quadro. O protocolo confirma mudanças durante a apresentação. Alterar a preferência cancela ou restaura os efeitos preservando o prazo de encerramento e a posição temporal da câmera.

## Cues do roteiro

Em **Direção → Efeitos e cues → Criar cue**, adicione **Iniciar cinematic** e escolha uma apresentação salva da cena. A ação usa seu ID estável, aceita o atraso existente e permite escolher se substitui uma apresentação em andamento. **Encerrar cinematic** oferece saída com o fade configurado ou encerramento imediato.

As ações podem compartilhar a cue com música, efeitos, mixer e lembretes existentes. Elas também funcionam pelo bloco de cue do roteiro, por gatilho e pelo disparo de cue já existente. O agendador continua responsável pelos atrasos e seu cancelamento. `audio-engine.js` recebeu dois pontos de emissão de eventos, sem alteração de reprodução, volumes, fades de áudio ou instâncias do motor.

`CinematicCues` captura conta, campanha, cena e revisão de navegação ao agendar. A execução valida esse contexto novamente após carregar a imagem. Trocar de cena, retornar à mesma cena ou emitir um encerramento durante um carregamento impede a abertura tardia. Uma falha ao localizar o quadro produz aviso visível ao mestre. A substituição recusada encerra também a reprodução anterior conhecida, evitando uma imagem em loop sem controle no Director.

## Persistência e ciclo de vida

O esquema de apresentações permanece na versão 1. `fadeIn` e `fadeOut` são campos opcionais, com padrão de 0,3 segundo para conteúdos anteriores. IDs, imagens, campos antigos e Markdown permanecem compatíveis. As novas ações usam `cinematic-start` e `cinematic-stop` nas cues existentes.

Cada reprodução mantém seu próprio ID de sessão. Mensagens anteriores continuam sujeitas às validações de conta, campanha, cena, destinatário e sequência. O quadro confirma o encerramento depois de retirar a camada. O encerramento imediato pode antecipar um fade já em andamento. A troca de cena, recarga, substituição e perda de comunicação limpam a reprodução correspondente.

A camada permanece independente do snapshot. Os únicos ajustes no quadro são os callbacks de confirmação da preferência de movimento em `quadro/board-cinematic.js` e no espelho distribuído com o Director.

## Validação de 21/11/2026

`npm run check` aprovado. `npm test` aprovado com **341 testes**, incluindo os 331 existentes e dez regressões adicionais. A suíte de Cinematic contém 25 testes. Os casos novos abrangem permissão local e reversível de movimento, presets e fades, contexto de cue, cancelamento de carregamento, erro de quadro indisponível, backup completo com configurações antigas e novas, substituição recusada e antecipação de fade por parada imediata. Um teste isola seu grupo nativo BroadcastChannel no Node para evitar interferência de portas já encerradas.

O Chrome executou a demonstração com os componentes reais do Director, quadro e áudio local, usando identidade fictícia e persistência isolada. Cada aba de QA recebe uma campanha e chave de teste próprias.

| Verificação | Resultado observado |
| --- | --- |
| Prévia e quadro | Respiração com escala aproximada de 1,07 → 1,24 → 1,06. Mesma escala no meio do ciclo |
| Fechamento do ciclo | Escala aproximada de 1,0628 antes e 1,0635 depois da virada |
| Memória | Mudança de escala, iluminação, tonalidade e foco observada em instantes diferentes |
| Aparição | Aproximação e blur passando aproximadamente de 1,49 px a 0,27 px durante a revelação |
| Movimento reduzido | Preferência simulada antes do carregamento, aviso nas duas janelas, fallback estático, liberação explícita e confirmação no Director |
| Lifecycle | Fim automático, parada manual, parada imediata por cue, fade por cue e reapresentação aprovados |
| Cues | Criação pelo formulário original, início com atraso de 0,3 s, término imediato e com fade |
| Navegação e recarga | Troca de cena, recarga do quadro, recarga do Director e nova apresentação após restauração aprovadas |
| Quadro indisponível | Cue mostra aviso visível, seguida de apresentação bem-sucedida após restaurar a janela |
| Integridade | Snapshot idêntico antes e depois das apresentações e transições |
| Áudio local | Ambientes `rain` e `room` permaneceram ativos, com relógio avançando e volume geral em 0,8 |
| Responsividade | Sequência completa aprovada com janelas de 950 px e de 390 px |

### Reproduzir a demonstração

A partir de `campaign-director/`, execute `node tests/fixtures/cinematic-demo.mjs /caminho/novo/demo`. Sirva a pasta `public/` por HTTP local e abra `qa.html`. **Validar Quadro vivo e cues** executa o percurso com os controles existentes. Os links permitem testar 390 px e movimento reduzido simulado. Após a aprovação, **Demonstrar Respiração** mantém uma apresentação aberta para inspeção. **Validar recarga e quadro indisponível** verifica o encerramento na recarga e o aviso de falha de uma cue.

O gerador altera apenas a cópia descartável, substituindo identidade e persistência por dados demonstrativos. A simulação de acessibilidade existe somente nessa cópia. O player de produção utiliza a preferência real do dispositivo.

## Limites e CINEMATIC-02

A comunicação continua restrita à mesma origem e ao mesmo navegador. Os ensaios usam uma conta fictícia, janelas/frames locais e largura mobile simulada. Aparelhos físicos, alterações reais nas configurações do sistema operacional, sessão Spotify conectada e desempenho em equipamentos modestos aguardam validação de mesa.

As partículas opcionais ficaram para uma etapa posterior. Os presets desta entrega usam câmera, luz, vinheta e foco. A evolução sugerida para CINEMATIC-02 é transmissão remota autenticada, confirmação por cliente e distribuição privada das imagens, seguida de avaliação de partículas leves em dispositivos reais.

A branch e o patch desta entrega destinam-se à revisão e integração posterior.

## Arquivos alterados

```text
campaign-director/dist/app.js
campaign-director/dist/audio-engine.js
campaign-director/dist/cinematic-cues.js
campaign-director/dist/cinematic-editor.js
campaign-director/dist/cinematic-frame.js
campaign-director/dist/cinematic-link.js
campaign-director/dist/cinematic-model.js
campaign-director/dist/cinematic-motion.js
campaign-director/dist/cinematic-protocol.js
campaign-director/dist/cinematic.css
campaign-director/dist/cris/quadro/board-cinematic.js
campaign-director/dist/cue-editor.js
campaign-director/dist/storage.js
campaign-director/docs/cinematic-01-2.md
campaign-director/tests/cinematic-lifecycle.test.js
campaign-director/tests/cinematic-live.test.js
campaign-director/tests/fixtures/cinematic-demo.mjs
campaign-director/tests/fixtures/cinematic-qa.js
quadro/board-cinematic.js
```
