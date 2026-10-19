# C.R.I.S. — Campaign Director (Protótipo)

Protótipo isolado do módulo de mestragem para **Reescritos**. Não altera o CRIS principal.

## O que já funciona

- Página de campanha com estrutura tipo wiki/Notion.
- 3 cenas da Casa São Martinho: Quarto, Corredor e Escritório.
- Markdown simples renderizado no próprio CRIS.
- Editor de Markdown com autosave via localStorage.
- Audio Engine com camadas independentes em loop.
- Volumes por camada.
- Timeline com eventos automáticos.
- Triggers manuais e hotkeys.
- Cue composta da **Terceira Badalada**: fade da chuva + sino + riser.
- Botão **Silêncio Total**.
- Modo Sessão com interface limpa.
- Dock de áudio persistente.
- Campo experimental para YouTube + timestamp (requer internet e API oficial do player).

## Hotkeys do protótipo

- `SPACE`: iniciar/pausar cena
- `1`: sino
- `2`: trovão
- `3`: porta/fechadura
- `4`: Terceira Badalada (na cena Escritório)
- `S`: silêncio total

## Arquitetura proposta

### Campaign Wiki
Página -> cenas -> conteúdo Markdown. O texto e a direção sonora vivem juntos.

### Scene Director
Cada cena define:
- camadas que devem começar em loop;
- timeline de automações;
- triggers manuais;
- cues compostas.

### Audio Engine
Camadas separadas para música, ambiência e SFX. A troca de página não deve destruir o engine no CRIS final.

### Cue
Uma cue é um conjunto de ações disparado com um clique. Exemplo `TERCEIRA BADALADA`:
1. chuva faz fade para 0;
2. sino toca;
3. riser entra 800 ms depois;
4. room tone cai quase ao silêncio.

## Próxima etapa para integração real

1. Levar este módulo para a base CRIS atual como uma nova área MASTER.
2. Separar `campaign-data.js` do motor para as páginas poderem crescer sem virar um JS gigante.
3. Criar CRUD visual de páginas/cenas/cues.
4. Persistir campanha em JSON/IndexedDB ou backend em vez de apenas localStorage.
5. Biblioteca de áudio com upload, tags, busca e waveform.
6. Integrar o quadro investigativo e fichas com links internos da wiki.
7. Criar painel do jogador para handouts enviados pelo mestre.
