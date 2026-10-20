# CRIS — ponto de controle da integração

Atualizado em 20/10/2026. Etapa 1 concluída: base do Supabase.

Projeto: https://zumrguvsihtuahunxuyq.supabase.co
Migração remota aplicada: 20261020114201 — cris_director_foundation.
O arquivo foundation.sql é a cópia do SQL aplicado, para revisão e recuperação em um banco vazio; não executar novamente no projeto atual.

## O que está pronto

| Tabela | Função |
| --- | --- |
| campaigns | Campanhas e proprietário |
| campaign_members | Mestres adicionais e jogadores |
| director_pages | Texto em blocos e configurações |
| director_scenes | Cenas e configurações de entrada |
| media_assets | Catálogo e referências de arquivos, YouTube ou URLs externas |
| audio_playlists | Itens e regras das playlists |
| ambience_presets | Camadas e regras das ambientações |
| director_cues | Ações de áudio e outras ações dos cues |
| director_backups | Cópia JSON anterior à importação; sem alteração ou exclusão direta pelo cliente |

Armazenamento privado: cris-audio, cris-documents e cris-images.
Caminho de arquivo: <UUID da campanha>/<identificador do arquivo>/<nome>.
O limite efetivo de tamanho de arquivo continua sendo o padrão do projeto/plano; esta etapa não aumenta limites nem contrata serviços.
YouTube é armazenado como referência, sem baixar os vídeos ou extrair áudio.

## Permissões já implementadas

Todas as nove tabelas têm RLS. Proprietário e mestres adicionais podem trabalhar no conteúdo do Director. Somente o proprietário administra membros e exclui a campanha. A propriedade e o vínculo de um conteúdo com a campanha não podem ser alterados diretamente pelo cliente.
Jogadores podem consultar a campanha de que participam e sua própria associação; não recebem páginas do mestre, cues, catálogo privado ou backups. Sem login, não há acesso às tabelas da aplicação. Arquivos também exigem autorização de mestre da campanha, inclusive para substituição.
A função de consulta de permissões está em cris_private, com search_path fixo e execução negada a PUBLIC/anon. Ela usa auth.uid e tabelas de associação, nunca metadados editáveis do usuário.
As referências página/cena usam uma chave composta para impedir associação entre campanhas distintas. Os metadados de arquivos validam a pasta da campanha.

## Validação concluída

verify.sql passou em transação revertida, usando quatro identidades temporárias e dois casos de campanha. Verificou criação/edição pelo proprietário, leitura/edição por outro mestre, isolamento de jogador e pessoa externa, bloqueio sem login, prevenção de autopromoção, proteção de propriedade, referência entre campanhas, caminho de arquivo inválido, cópia imutável, RLS e buckets privados. Nenhum usuário ou conteúdo de teste foi mantido.
Auditor de segurança: nenhum alerta. Auditor de desempenho: apenas índices ainda sem uso, esperados em uma base recém-criada (https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
A autorização de arquivos foi revisada nas políticas e na função de associação; upload/download reais com sessão autenticada serão testados na etapa 2. Login por navegador, entrega de e-mail e sincronização ainda não foram testados nem implementados.

## Próximas etapas, na ordem

1. CONCLUÍDO — base e permissões no Supabase.
2. PRÓXIMA — login e conexão do Director, mantendo uso local disponível. Usar chave publicável no navegador; nenhuma chave secreta. Definir URL de retorno permitida para o site do Director. Não confundir o login privado do site hospedado com uma sessão do Supabase.
3. Migração pelo navegador do usuário: exportação local completa, cópia JSON remota, inventário de arquivos, upload com retomada, verificação de contagens e tamanhos, vínculo dos IDs antigos aos novos. Repetir uma importação não deve duplicar itens. Só marcar como sincronizado quando tudo estiver confirmado. Nunca apagar os dados locais automaticamente.
4. Sincronização de alterações e conflitos. O campo revision existe, mas o controle de concorrência ainda precisa ser implementado e testado; ele não se incrementa sozinho. Evitar que duas abas sobrescrevam silenciosamente o texto uma da outra.
5. Integração com CRIS principal: autenticação real preservando a interface, fichas personalizadas, campanhas e quadro existente. Esta etapa ainda não foi iniciada.
6. Documentos reveláveis do texto para o quadro: registros próprios de versão para jogadores e concessões explícitas, filtrando tanto metadados quanto arquivos. Só então permitir downloads de jogadores e canais privados Realtime. Operação de revelar deve ser idempotente.
7. Sessão com dois monitores: narração/mixer num, quadro no outro; uma única janela responsável pelo áudio para impedir reprodução duplicada.
8. Battlemap: aproveitar recursos do quadro, adicionando escala, grade, tokens com dono, régua e névoa manual. Não tratar o quadro atual como VTT já concluído.

## Preservação e limites atuais

Director atual: https://cris-campaign-director-v3.mateusfernando599.chatgpt.site
Versão de referência: 3.5.1, commit d54e4c79e277306025e8c7e1ceed4a5f7e1bbf1d.
Nenhuma modificação no Director ou no repositório principal nesta etapa.
As cenas da Casa São Martinho, cues, músicas, playlists, efeitos, fades, loops e ambientes continuam no armazenamento local do navegador. O banco remoto está pronto e vazio; não contém o trabalho do usuário ainda.
Chave local: cris-campaign-director:v3. Arquivos: IndexedDB cris-director-media, store blobs. Uma cópia JSON não inclui automaticamente esses arquivos; a migração deve tratá-los separadamente.
IDs antigos de páginas, músicas, playlists e cues precisam de mapeamento consistente para preservar links internos. Os campos JSON permitem preservar configurações existentes, mas o adaptador de migração ainda precisa conferir os formatos de cada módulo.
O CRIS principal é https://github.com/MateusAnastacio599/cris-reescritos e não foi alterado. O quadro ativo usa quadro/quadro-cris-v7.js. Ele possui armazenamento local e comunicação PeerJS; não substituir por arquivos de versões antigas. Antes de conectar documentos secretos, corrigir o envio inicial de binários de objetos ocultos. Preservar o LUME público e os sons dos objetos interativos.
As tabelas futuras de fichas, documentos compartilhados, quadros e sessão não foram criadas nesta etapa. O esquema atual é a fundação do Director e das permissões, não a implementação completa do hub.
