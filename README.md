# CRIS Campaign Director V3

Aplicativo web funcional e independente para preparação e direção de RPG. Parte do código e dos dados de **CRIS-Campaign-Director-Prototype.zip**, preservando integralmente os roteiros da Casa São Martinho e os seis arquivos WAV originais. O CRIS principal não é alterado.

## Usar

Abra o site publicado em um navegador moderno, no computador ou no celular. As três cenas iniciais estão em **Reescritos → Sessão 01 → Casa São Martinho**.

- **Editar página:** editor visual com blocos de texto, títulos, citações, listas, tarefas, notas e cues. Digite `/` em um bloco vazio. Os blocos podem ser reordenados pelas opções da alça ou arrastados no desktop.
- **Links internos:** use o botão de link no editor ou `[[Nome da página]]` no Markdown. As referências criam backlinks nas páginas de destino.
- **Campanhas, páginas e cenas:** adicione pela navegação; renomeie, organize e exclua nas respectivas opções. As cenas podem ser duplicadas com sua configuração sonora.
- **Biblioteca:** upload de áudio para IndexedDB; nomes, categorias e tags; URLs e playlists do YouTube; playlists locais ordenadas.
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

## Verificação

```sh
node scripts/check.mjs
node --test tests/director.test.js
```

Os testes verificam preservação integral das cenas e hashes dos WAVs, persistência, backup, renderização/links, URLs do YouTube, independência da navegação, crossfade, timeline/pausa, mixer e cancelamento de eventos. O AudioEngine é exercitado com uma interface de mídia simulada; isso não confirma saída sonora real, codecs ou autoplay em um aparelho físico.

Nesta entrega, o preview supervisionado do Work não iniciou por falha de infraestrutura (`bwrap` sem permissão de montagem). A validação visual no navegador e a reprodução real no celular ficaram pendentes. Os testes de código e a publicação são independentes dessa limitação.
