# LIVE-01A.2 + LIVE-01B — evidências e homologação

## Evidências desta sessão

| Verificação | Resultado | Limite |
|---|---|---|
| Entrada pelo código ABCD1234 | Formulário aceitou, navegou internamente e tentou a sala correta | Não prova conexão com sala inexistente |
| Reabrir `/quadro/` sem sala | Recuperou a mesa e campanha da conta de teste | Armazenamento do navegador, não vínculo autenticado de peer |
| Convite completo | Link colado no formulário selecionou sala e campanha do mestre | Contas fictícias na fixture |
| Trocar mesa em 390 px | Diálogo aceitou outra sala e reentrou sem editar URL | Iframe de 390 px no Chrome, não Android físico |
| Apresentação local | CinematicLink → BroadcastChannel → receptor → frame; imagem visível, opacidade 1, início e fim confirmados | Campanha fictícia isolada |
| Protocolo + player simples | LiveWire e RemoteCinematics reais, imagem renderizada, status apresentando | DataConnections simuladas |
| Câmera + luz + camada WebM | Player existente renderizou 2 imagens e um vídeo; vídeo `readyState=4`, `paused=false`, sem aviso de fallback | Conexão simulada; não prova WebRTC |
| Substituição, cache e reconexão de Cinematic | Apresentação atual restaurada; anterior não reviveu; arquivo validado reutilizado | Testes automatizados e fixture de navegador |
| Encerramento | Frame limpo e estado encerrado após confirmação; sem confirmação fica encerrando/falhou | Rede real pendente |
| PNG no quadro do mestre | Imagem local adicionada; sala, 2 pins e 1 fio preservados | Recebimento remoto desta branch não validado |
| PeerJS real | Oferta/resposta aplicadas; `ice-candidates-not-emitted`, 2 candidatos locais nas estatísticas e 0 remotos; DataChannel connecting | Bloqueio do navegador disponível, igual à investigação anterior |
| Desktop + celular de outro usuário | Usuário relatou sincronização real de imagem na versão anterior | Relato aceito; não teste nosso de Cinematic desta branch |

No teste local inicial havia outro receptor da mesma campanha respondendo primeiro. A descoberta passou a priorizar a mesa compartilhada; há regressão automatizada de seleção. No Node deste ambiente, multicast de Blob para mais de um BroadcastChannel falha até em reprodução nativa mínima; o teste com múltiplos receptores verifica a descoberta por metadados, enquanto o envio local de imagem e o player foram validados no Chrome.

Testes de protocolo usam o módulo LiveWire real, hashes e ACKs, mas conexões simuladas. Não representam quatro aparelhos nem homologação de rede. O navegador de QA não disponibiliza contextos realmente isolados por `sessionName`, como já demonstrado na LIVE-01A.1.

## Reproduzir verificações automatizadas

Resultado nesta branch: **516 testes aprovados, 0 falhas**, além de `check` e `check-integration` aprovados. A repetição final no Chrome confirmou WebM em reprodução e a sequência apresentando → encerrando → encerrado.

A partir de `campaign-director/`, com Node 24:

```sh
npm test
npm run check
node scripts/check-integration.mjs
```

Cobertura adicionada: parser/isolamento de conta/persistência, campanha revogada, código legado, prova criptográfica e replay entre salas/conexões, mídia simples/composta/WebM, integridade e cache, proibição de comandos do jogador, cancelamento, fim/substituição/reconexão, falha do player, ausência de confirmação, integração das cópias e prioridade de descoberta local.

## Prévia descartável sem campanhas reais

Crie um diretório novo:

```sh
node tests/fixtures/live-board-demo.mjs <diretorio-novo>
```

Sirva apenas a subpasta `public` numa origem de teste. As rotas são:

- `/quadro/?case=teste-unico`: mestre fictício, engine e PeerJS reais.
- `/quadro/?user=one&case=teste-unico`: jogador fictício que escolhe link/código pelo formulário.
- `/mobile-entry-qa.html`: entrada em 390 px.
- `/remote-player-qa.html`: demonstração explícita com conexão **SIMULADA**, mas módulos reais de prova, transmissão, validação e CinematicFrame.
- `/campaign-director/dist/?case=teste-unico`: Director fictício da mesma campanha.

A fixture do quadro substitui chamadas de conta/persistência por dados fictícios. Sua chave pública de QA fica em localStorage; isso permite verificar o fluxo dentro desse contexto, mas **não valida autenticação entre perfis distintos**. A demonstração de player usa um registro em memória próprio. Nunca publicar essas fixtures como aplicativo ou usá-las como prova de permissão Supabase.

A prévia interna desta sessão foi encerrada sem publicação. O gerador fica no repositório para reprodução.

## Homologação com computador e Android/PWA reais

Use um build desta branch em hospedagem HTTPS de teste separada e uma campanha/contas de teste no backend. Não substitua produção nem use dados reais. A entrega não criou esse ambiente nem realizou escritas de campanha. As políticas existentes da campanha precisam estar presentes; não há migração nova para executar.

1. Acesse com o mestre no computador e um jogador no celular/standalone. Abra o compartilhamento **na versão nova**, para registrar a chave pública temporária da sala. Use o mesmo build nas duas pontas. Se falhar a permissão de GM, corrija o acesso de teste; não desative a verificação.
2. Copie o link pelo mestre. No celular, abra-o ou use **Entrar na mesa** na Central e cole o link/código. Confira nome da campanha e sala. Saia/reabra o app pelo ícone e confirme a mesa lembrada. Use **Trocar mesa**, depois volte à primeira. Teste também `CASO26107` numa sala de teste configurada explicitamente para compatibilidade.
3. Exija DataChannel aberto, snapshot recebido e uma presença por conta. Adicione PNG no mestre e confira recepção no celular antes de avaliar Cinematics. Mova um objeto e cursor durante upload; interrompa/reconecte e confira sala, pins e fio. Sinalização aberta sozinha não aprova o teste.
4. Abra o Director da campanha de teste no computador. Com uma apresentação salva, clique **Apresentar**. Primeiro use imagem pequena com duração em loop. Exija estado **apresentando** do celular no painel do mestre/Director e imagem visível no aparelho. Confirmação local do mestre não basta.
5. Apresente outra composição com câmera, luz, efeitos, PNG e WebM com fallback. Confira movimento reduzido do aparelho e comportamento quando o navegador não decodificar o vídeo. Arquivos de camadas ocultas não podem constar no manifesto/cache transmitido.
6. Encerre no Director: o celular precisa limpar o frame e confirmar **encerrado**. Substitua por outra enquanto carrega; a antiga não pode voltar nem encerrar a nova. Desconecte/reconecte durante apresentação ativa e depois de encerrá-la. A primeira pode continuar no instante aproximado; a segunda não reaparece.
7. Interrompa transferência e faça um arquivo de teste falhar na integridade. A apresentação deve reportar falha e liberar recursos sem derrubar o quadro. Repetir o arquivo validado na mesma sessão deve aproveitar o cache quando disponível.
8. Verifique papéis com contas reais de teste: jogador não pode publicar `settings.liveRoom` sob RLS, nem iniciar/parar Cinematics no anfitrião. Prova com outra chave, nonce ou sessão deve falhar. Verifique acesso revogado e política de entrada de membros separadamente: identidade individual PeerJS continua uma pendência da LIVE-01A.
9. Repita com três jogadores, nomes iguais, segunda aba, redes distintas e suspensão/retorno do celular. Teste áudio, arquivos/fichas e Cinematics locais. Nenhum controle remoto novo deve acionar o Audio Engine.

Registre commit/build, navegador/aparelho, campanha fictícia, rede, ação e estados observados. Não envie tokens, SDP, IPs ou chaves privadas ao PR. Sem recebimento visível e confirmação real do celular, mantenha a homologação remota pendente, mesmo com testes automatizados aprovados.
