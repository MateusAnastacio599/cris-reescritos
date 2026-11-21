# CINEMATIC-01.1 · Efeitos e ciclo de vida

Em **Ferramentas → Cinemática**, a **Prévia** executa os ajustes atuais no mesmo player que o quadro usa. **Salvar** guarda a configuração da cena. **Apresentar** fica indisponível enquanto houver ajustes ou uma imagem nova ainda sem salvar.

Novas apresentações começam em **Ambiente vivo**, com duração de 12 segundos e permanência de 2 segundos. **Respiração** faz a câmera aproximar e afastar com movimento vertical e vinheta discreta. **Revelação** clareia a imagem durante a aproximação. **Tensão** desloca a câmera suavemente sem flashes. Estático, Aproximação, Afastamento e Panorâmica continuam disponíveis.

No modo automático, o quadro executa o movimento, mantém o enquadramento final pelo tempo de permanência e retira a camada após uma saída de 300 ms. **Repetir até encerrar** está disponível em Ambiente vivo, Respiração e Tensão. As poses e a vinheta fecham o ciclo no mesmo valor em que começaram. O encerramento manual pode antecipar a saída. Com movimento reduzido, o quadro mantém a imagem estática e segue a duração configurada.

## Dados e sincronização

O esquema salvo continua na versão 1. Os campos opcionais `ending` e `hold` são aditivos. Apresentações antigas conservam IDs, imagens, movimento, duração e intensidade. Na ausência dos novos campos, passam a usar o encerramento automático com 2 segundos de permanência. Backups antigos podem ser importados sem regravar seus metadados.

O quadro informa o encerramento da reprodução identificada pelo ID de sessão após remover a camada. Reapresentar gera outro ID. Uma confirmação ou temporizador anterior fica associado à reprodução anterior. Ao trocar de cena ou recarregar o Director, o vínculo anterior é encerrado. A recarga do quadro descarta a camada e avisa o Director. O canal é local ao navegador e ao quadro ao vivo da conta e campanha vinculadas.

## Verificação

A demonstração da CINEMATIC-01 usa a cena local do Director e o motor real do quadro com uma conta fictícia e dados descartáveis. Para iniciá-la a partir de `campaign-director/`, execute `node tests/fixtures/cinematic-demo.mjs /caminho/novo/demo` e sirva a pasta `public/` por HTTP local. Abra o Director e o quadro da demonstração. A imagem de teste está na página inicial.

Na versão-base, o Chrome mediu uma aproximação de escala 1,00 para 1,12 e então 1,24. Estático ficou em 1,00. A camada permaneceu visível depois do último frame. O formulário novo começava em Estático, e Apresentar lia a versão salva independentemente dos valores em edição.

Na versão atual, a Respiração passou de aproximadamente 1,07 a 1,24 e voltou a 1,06 perto da virada do ciclo. A prévia e o quadro chegaram a aproximadamente 1,24 no meio do ciclo. Na Revelação, a opacidade da sombra passou de 0,66 para 0. A camada permaneceu durante a espera configurada e desapareceu no fim. O snapshot do quadro permaneceu idêntico e os ambientes locais `rain` e `room` continuaram com o mesmo volume durante as transições.

`npm run check` e `npm test` passaram, com 331 testes. A cobertura inclui configurações antigas e novas no mesmo backup, ciclo do player com movimento reduzido, cancelamento de temporizadores e confirmação de encerramento pelo quadro. No Chrome, a demonstração local passou em painéis de 950 px e de 390 px, incluindo reapresentação rápida, troca de cena e recarga do Director e do quadro. O movimento reduzido foi simulado no navegador. Dispositivos físicos, Spotify conectado e transmissão remota ficaram fora do ensaio.

## Integração futura com cues

Uma cue composta poderá incluir as ações **Iniciar apresentação cinematográfica** e **Encerrar apresentação cinematográfica**, usando os IDs estáveis das apresentações e o mecanismo de cues do roteiro. A execução desta etapa é manual.
