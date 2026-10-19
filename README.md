# CRIS Campaign Director V3

Aplicativo web funcional e independente para preparação e direção de RPG. Parte do código e dos dados de **CRIS-Campaign-Director-Prototype.zip**, preservando integralmente os roteiros da Casa São Martinho e os seis arquivos WAV originais. O CRIS principal não é alterado.

## Usar

Abra o site publicado em um navegador moderno, no computador ou no celular. As três cenas iniciais estão em **Reescritos → Sessão 01 → Casa São Martinho**.

- **Editar página:** editor visual com blocos de texto, títulos, citações, listas, tarefas, notas e cues. Digite `/` em um bloco vazio. Os blocos podem ser reordenados pelas opções da alça ou arrastados no desktop.
- **Links internos:** use o botão de link no editor ou `[[Nome da página]]` no Markdown. As referências criam backlinks nas páginas de destino.
- **Campanhas, páginas e cenas:** adicione pela navegação; renomeie, organize e exclua nas respectivas opções. As cenas podem ser duplicadas com sua configuração sonora.
- **Biblioteca:** upload de áudio para IndexedDB; nomes, categorias e tags; URLs e playlists do YouTube; playlists com ordem definida ou aleatória.
- **Direção:** camadas em loop, gatilhos, cues compostas e timeline. Configure usando os botões `+` ou o ícone ao lado de Direção da cena.
- **Player persistente:** navegação troca somente o workspace. A transição sonora acontece ao iniciar outra cena, com crossfade dos arquivos locais.
- **Celular:** alterne entre Roteiro e Direção da cena; o player fica no rodapé. O primeiro áudio exige um gesto de reprodução.
- **Backup e dados:** exportação JSON completa, incluindo arquivos enviados. Restauração validada, com cópia do estado textual anterior mantida no navegador.

As edições são locais a cada navegador/origem, sem sincronização automática entre aparelhos. Exportar/importar é o caminho para transferi-las. A continuidade com tela bloqueada depende do navegador/sistema. O YouTube usa seu player oficial visível; a disponibilidade de vídeos e a permissão de reprodução dependem do provedor. A transição de dois vídeos do YouTube usa um único player; o crossfade simultâneo é fornecido para áudio local.

## Organização

| Arquivo | Responsabilidade |
| --- | --- |
| `dist/index.html` | Shell persistente: navegação, player e host do YouTube |
| `dist/app.js` | Controle da interface e CRUD de campanhas, páginas e cenas |
| `dist/campaign-data.js` | Conteúdo e definições originais do protótipo |
| `dist/storage.js` | Modelo V3, persistência, mídia e backup |
| `dist/markdown.js` | Conversão de blocos e renderização segura de texto |
| `dist/editor.js` | Editor visual e ordenação de blocos |
| `dist/audio-engine.js` | Motor de áudio independente da navegação |
| `dist/scene-config.js` | Editor visual da direção sonora |
| `dist/library-ui.js` | Biblioteca, upload, YouTube e playlists |
| `dist/director.css` | Layout responsivo e tema |
| `reference/prototype-original` | Código original e hashes dos áudios, para rastreabilidade |

Não há dependências de execução, build ou servidor de aplicação. `dist/` contém o site completo. Um servidor HTTP(S) é necessário para carregar os módulos JavaScript; abrir `index.html` diretamente como `file://` não é suportado.

## Integração futura

O `AudioEngine` recebe um getter para o estado e não consulta a página atualmente aberta. Uma instância deve pertencer ao shell do CRIS principal, com injeção dos repositórios de estado/mídia quando houver backend. Eventos `change`, `tick`, `cue` e `error` permitem conectar outra interface. A cena ativa é um snapshot independente da cena em edição; mudanças na direção são aplicadas ao parar e iniciar a cena novamente.

O modelo exportado tem `schemaVersion: 3`, `campaigns`, `audioAssets`, `playlists`, `settings` e `ui`. Áudios enviados são identificados por ID; URLs `blob:` são resolvidas em tempo de execução, não gravadas como fonte permanente. Cues contêm ações `play`, `fade` e `stop`, cada uma com atraso em segundos. A Terceira Badalada foi convertida em quatro ações editáveis mantendo a sequência original.

## Atualização 3.1 — direção musical e ambientes

- **Biblioteca → Transições:** fades padrão de entrada/saída e crossfade automático de playlists de arquivos locais, com pré-carregamento da próxima faixa.
- **Playlist do YouTube → ícone de lista:** mostra a sequência disponibilizada por `getPlaylist()`, com capas clicáveis, nomes de referência e opção de trazer as faixas individualmente para a biblioteca. O player fornece IDs; os títulos são completados pelo vídeo em reprodução. Não há chave da YouTube Data API configurada, portanto não é prometida uma lista com todos os títulos preenchidos de imediato. Playlists privadas ou indisponíveis podem não ser listadas.
- **Direção da cena → Música:** manter, iniciar/trocar ou encerrar a música; faixa/playlist e primeira faixa; timestamp, volume e fades específicos; ambiente salvo opcional. A primeira faixa é 1 na interface.
- **Ambientes:** presets com loops contínuos, efeitos ocasionais com intervalo mínimo/máximo, volumes independentes, disparos manuais e fades de entrada/saída. São persistentes e independentes das camadas da cena.
- **Cues ampliadas:** música, ambientes, mixer, lembretes e navegação entre roteiros, além dos efeitos originais.

O YouTube usa um único player oficial visível, com tamanho compacto de 248 × 200 px para o vídeo, sem cobrir os controles ou substituir a reprodução por uma capa. O fade de saída antecede a troca; o fade de entrada aguarda `PLAYING` e é suspenso em `BUFFERING`. Rede, anúncios, vídeos indisponíveis e restrições do navegador continuam podendo causar intervalos. Um ambiente local em execução permanece durante a troca. Não há extração de áudio, player oculto ou promessa de crossfade simultâneo entre vídeos do YouTube.

As mudanças são aditivas, preservam a chave de armazenamento e a versão 3 do formato de backup. A migração adiciona `ambiences` e os novos padrões de música quando ausentes, sem substituir textos, cenas ou áudio enviado.

Novos módulos: `music-methods.js` (direção musical e YouTube), `volume-envelope.js` (fades canceláveis), `music-ui.js` (configuração), `youtube-library.js` (lista de faixas), `ambience-engine.js` / `ambience-ui.js` (SoundPad), `cue-editor.js` (ações compostas) e `audio-tools.css` (layout responsivo).

## Atualização 3.2 — exclusão e surpresa nas playlists

- Lixeira permanente em cada áudio/música adicionado, no desktop e no celular, com confirmação. A exclusão remove o arquivo enviado e suas referências em playlists, camadas, gatilhos, cues, timeline e ambientes; preserva os textos. Somente o áudio excluído é interrompido, sem parar os outros canais. Os seis sons originais continuam protegidos.
- Botão **Aleatório** no cabeçalho das playlists do CRIS. A escolha fica salva; novas playlists começam com o modo ativo. Cada rodada toca todas as faixas uma vez, evita repetir a última na virada e mantém histórico para Anterior/Próxima. O pré-carregamento consulta a mesma próxima faixa e os fades continuam ativos.
- Playlists nativas do YouTube têm **Aleatório** na lista de capas e na edição do áudio. O player oficial executa `setShuffle` e `setLoop`; a seleção de capas identifica o vídeo por ID para funcionar mesmo após reordenar. Novos links de playlists usam aleatório por padrão. A garantia da rodada sem repetição do CRIS se aplica às playlists criadas/importadas na biblioteca; a ordem da playlist nativa é gerida pelo YouTube.
- Cenas e cues que iniciam uma playlist com aleatório ativo sorteiam a faixa inicial. A primeira faixa configurada é usada no modo sequencial. Tocar diretamente uma faixa da lista continua permitindo escolhê-la antes do restante da rodada.

Novos módulos: `playlist-order.js` (fila, rodadas e histórico) e `audio-assets.js` (remoção das referências). O formato de backup permanece V3; `shuffle` é opcional em arquivos antigos.

## Verificação

```sh
node scripts/check.mjs
node --test tests/director.test.js
```

Os testes verificam preservação integral das cenas e hashes dos WAVs, persistência, backup, renderização/links, URLs do YouTube, independência da navegação, crossfade, timeline/pausa, mixer e cancelamento de eventos. O AudioEngine é exercitado com uma interface de mídia simulada; isso não confirma saída sonora real, codecs ou autoplay em um aparelho físico.

Nesta entrega, o preview supervisionado do Work não iniciou por falha de infraestrutura (`bwrap` sem permissão de montagem). A validação visual no navegador e a reprodução real no celular ficaram pendentes. Os testes de código e a publicação são independentes dessa limitação.
