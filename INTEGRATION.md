# CRIS — ponto de controle da integração (20/10/2026)

Versão 3.7.0. Login por usuário confirmado pelo mestre. Conta de administrador mateus preservada. Contas dos agentes iris, andre, matias, celine e convidado criadas com perfis e associação à campanha. Definir as senhas dos amigos na área administrativa.

## Concluído

- Backup importado no Supabase, com original preservado e comparação do estado JSON confirmada no banco.
- 1 campanha, 2 páginas, 6 cenas, 33 itens de áudio, 3 playlists, 4 ambientes, 5 cues, 23 arquivos privados (51.555.008 bytes). Todos os arquivos foram lidos de volta e conferidos por SHA-256.
- Director abre/salva versões do workspace e arquivos na nuvem com verificação e controle de revisão. Salvamento é manual. Não apaga a versão local automaticamente.
- CRIS principal conectado ao mesmo login, identidade dos agentes e fichas individuais via banco. Cópia completa para testes em /cris/ no Site; arquivos portáveis para a raiz em integration-main/.
- Quadro mantém motor v7 e P2P, com snapshot privado manual no banco e ficha em janela interna. Preferência para quadro local existente.
- Credenciais antigas removidas dos arquivos alterados. Senhas novas não são públicas nem retornadas pelo servidor.

## Fontes de dados

A edição corrente do Director usa director_workspaces (payload/media/revision). director_backups é a cópia original imutável no cliente. As tabelas normalizadas de páginas/cenas/biblioteca refletem a importação inicial e ainda não são a fonte de leitura do editor após novas edições.
Fichas: character_sheets, por usuário e campanha. Perfis: agent_profiles. Associação e permissões: campaigns, campaign_members e director_accounts. Arquivos privados: buckets cris-audio, cris-documents, cris-images. O estado local original do quadro/fichas que existe somente no navegador do mestre ou dos amigos não estava no backup anexado e não pode ser importado remotamente sem a ação no navegador correspondente.

## Testes e limites

150 testes automatizados, verificações de sintaxe e integridade de assets, RLS e conflitos exercitados em transação revertida. Não houve teste visual em navegador neste ambiente. Auditoria mantém as observações já documentadas: tabela privada de rate-limit sem política pública e configuração opcional de senhas vazadas desativada no projeto; ver README.

## Próximos passos

1. Testar login, abrir cópia da nuvem e salvamento, em desktop e celular.
2. Nas origens originais, importar a ficha antiga para a conta certa e salvar o quadro local na nuvem. Não limpar armazenamento dos navegadores.
3. Evoluir documentos reveláveis: versão para jogadores, concessões explícitas, registro idempotente no quadro e arquivos filtrados por autorização.
4. Migrar transporte do quadro para Realtime autenticado e organizar múltiplos quadros/cenas com permissões; o compartilhamento atual continua PeerJS.
5. Duas telas, com um só proprietário do áudio; depois grade, escala, tokens, régua e névoa para battlemap.
