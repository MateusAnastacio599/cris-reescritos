# CINEMATIC-01 · Apresentação local de imagens

## Uso

1. No Director, abra uma cena, entre em **Ferramentas → Cinemática** e escolha **Nova apresentação**.
2. Anexe um PNG, JPEG ou WebP com até 12 MB e 40 megapixels. Defina nome, movimento, duração de 3–60 segundos e intensidade de 0–30%. **Prévia** testa os ajustes atuais. **Salvar** atualiza a apresentação vinculada à cena.
3. Abra o quadro ao vivo da mesma campanha e conta de mestre em outra aba ou janela da mesma origem e do mesmo perfil do navegador. Conclua a abertura do quadro. O vínculo da campanha fica em **Conta e nuvem** do Director.
4. Em **Cinemática**, selecione uma apresentação salva e clique em **Apresentar**. Enquanto estiver ativa, apresentar novamente atualiza a imagem ou o movimento no mesmo quadro. O movimento termina na última posição e a imagem permanece até **Encerrar apresentação**, disponível na janela de preparação e na página da cena.

A imagem mantém a proporção e preenche a janela, com recorte conforme a tela. A preferência de movimento reduzido mantém a imagem estática. O modelo armazena até 12 apresentações por cena em `scene.cinematic`, no formato `{version:1,items:[]}`. Os metadados referenciam os arquivos pelo hash do conteúdo. O IndexedDB do navegador conserva os arquivos separadamente. O backup completo inclui seus bytes numa seção de mídia própria, fora da cena e do Markdown. Se os bytes estiverem ausentes, anexe novamente a imagem ou restaure um backup completo. Referências substituídas preservam os bytes locais para recuperação e deduplicação.

## Quadro e áudio

O canal local é `cris-cinematic-local-v1`. O protocolo confirma um quadro disponível e identifica a conta, a campanha vinculada, a campanha e cena do Director, a aba de destino e a sessão. Mensagens com contrato, horário, ordem ou destino inválidos são descartadas. A troca de cena, o encerramento explícito ou a recarga normal fecham a camada. Em caso de fechamento abrupto, a sessão expira quando o quadro deixa de receber sinais de atividade por 75 segundos.

A camada está acima do quadro e desaparece após o fade. O módulo nunca lê ou salva o snapshot e não recria o Audio Engine. A abertura pode ser recusada enquanto o quadro ainda carrega ou aguarda a conclusão de um diálogo. Este MVP usa somente o quadro ao vivo do mestre e comunicação na mesma origem e perfil de navegador. O envio remoto a jogadores, arquivos do quadro e acionamento por cue ou timeline ficam fora deste fluxo.

## Colunas

**Desagrupar colunas** leva os blocos para o roteiro, na ordem das colunas. Fundos, proporções e divisórias são atributos do layout. Se algum bloco perder tipo ou conteúdo ao serializar fora do layout, a operação explica a incompatibilidade e preserva o original. Com três colunas, **Transferir e remover** mantém os blocos na coluna vizinha. Com duas, **Remover coluna e desagrupar** usa a mesma validação. **Excluir layout** apaga de uma vez o contêiner e seus blocos, com confirmação quando há conteúdo. As operações passam pelo histórico e autosave do editor.

## Demonstração e verificação

A partir de `campaign-director/`, execute `node tests/fixtures/cinematic-demo.mjs /caminho/novo/demo` e sirva a pasta `public/` gerada por HTTP local. A página inicial tem links separados para Director e Quadro e uma visualização com dois painéis de 390 px. Use **Editar sem transmitir** no quadro. O botão **Fixar snapshot de teste** registra a referência do snapshot da demonstração para verificar a igualdade na abertura e no encerramento. O teste usa o engine real do quadro, áudios locais do Director, conta fictícia e estado descartável.

`npm run check` e `npm test` passaram. Os testes cobrem serialização de colunas, confirmação de exclusão, modelo, imagens e backup, movimentos, mensagens inválidas e antigas, expiração e comunicação local. No Chrome desktop, a imagem foi salva, reaberta, apresentada, encerrada e reapresentada. Foram verificadas troca de cena, recarga do quadro, aviso sem quadro, igualdade do snapshot e continuidade das camadas locais de áudio. A experiência também foi exercitada em 390 px simulados. Não houve validação em aparelhos físicos, com conta Spotify real ou entre dispositivos.
