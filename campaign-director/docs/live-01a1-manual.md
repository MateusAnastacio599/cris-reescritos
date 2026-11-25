# Homologação LIVE-01A.1 — Windows e Android

Este roteiro valida a branch do PR #24 sem alterar produção ou usar campanha real. A fixture substitui identidade e persistência remota por dados fictícios; ela não valida autenticação Supabase/membro. “Passou na fixture” e “segurança de membros homologada” são critérios separados.

## Preparar cópia e fixture no Windows

Pré-requisitos: Git e Node 24. Execute no repositório local. O comando abaixo só faz fetch e cria um worktree separado; não troca sua branch nem descarta alterações.

```powershell
git fetch origin fix/live-01a-board-multiplayer-stability
$qaCheckout = Join-Path $env:TEMP ('cris-live-qa-source-' + [guid]::NewGuid().ToString('N'))
$qaDemo = Join-Path $env:TEMP ('cris-live-qa-demo-' + [guid]::NewGuid().ToString('N'))
git worktree add --detach $qaCheckout origin/fix/live-01a-board-multiplayer-stability
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível preparar o checkout de teste.' }
node (Join-Path $qaCheckout 'campaign-director/tests/fixtures/live-board-demo.mjs') $qaDemo
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível gerar a fixture.' }
Write-Output (Join-Path $qaDemo 'public')
```

Registre `git -C $qaCheckout rev-parse HEAD`. Compare com o head do PR antes do teste. O diretório de saída precisa ser NOVO; o gerador não sobrescreve um diretório existente.

## Implantação de teste HTTPS isolada

Não há implantação criada por esta entrega. Use um projeto de hospedagem estática **separado**, com acesso restrito aos testadores, URL HTTPS própria e certificado normalmente válido nos dois aparelhos. Configure a raiz para **apenas o conteúdo de `$qaDemo/public`**, sem build de servidor. Esse diretório já contém `index.html`, `rtc-probe.html` e `quadro/`.

Não envie `.git`, o repositório completo, credenciais, logs brutos ou campanhas. Não use o workflow Pages deste repositório, seu domínio, o ID do site ou sua configuração de produção. Uma prévia que exige cookies especiais ou injeta políticas de bloqueio WebRTC deve ser identificada como tal. Nenhum serviço TURN novo é exigido por este roteiro; diagnosticá-lo é anterior a decidir infraestrutura.

Confira `/rtc-probe.html` e `/quadro/` no Windows e Android pela mesma origem HTTPS. `http://localhost` pode testar somente o Windows local; o Android precisa da URL HTTPS acessível. Não ignore alertas de certificado.

## Provar isolamento antes de entrar

Use perfil Chrome de mestre e outros perfis Chrome separados para jogadores; Android real também fornece armazenamento independente. Para três jogadores, é possível usar dois perfis adicionais no Windows e um Android. São quatro contextos independentes, porém apenas dois dispositivos — registre essa topologia. Quando disponível, repita com máquinas e redes diferentes.

Em cada perfil/aparelho, abra `/rtc-probe.html` → **Medir isolamento de armazenamento**. Cookie, localStorage e IndexedDB devem ser diferentes entre os contextos. sessionStorage diferente sozinho não basta. Não use duas janelas anônimas que compartilham a mesma sessão nem suponha que nomes de aba isolam perfis. Guarde só os marcadores fictícios do teste, sem exportar cookies de autenticação.

Execute **Testar negociação nativa WebRTC**, primeiro sem STUN e depois com a opção STUN. Esse teste é um par na própria página: serve para diagnóstico, não aprova comunicação entre aparelhos. Capture `stage`, eventos, estatísticas e resultado. Se falhar, não marque o multiplayer como aprovado; compare com o diagnóstico do quadro.

## Mestre e três jogadores

1. Mestre abre `/quadro/`, inicia a mesa, usa **Jogar junto → Compartilhar esta mesa** e copia o link. Não use conta/campanha real.
2. Cada jogador abre o link em seu contexto isolado. Acrescente **um único** `user=one`, `user=two` ou `user=three` à query do link, preservando `sala`. O mestre deve abrir sem `user`; se o link já tiver esse parâmetro, substitua seu valor em vez de duplicá-lo. Todos podem manter o mesmo nome Matias para testar separação por identidade fictícia.
3. Clique **Entrar na mesa**. Exija snapshot recebido, DataChannel aberto e três participantes online, uma vez por conta. Pending, presença declarada ou sinalização aberta não contam como conectado.
4. Compare os dois post-its iniciais, seus 2 pins e 1 fio. Estado fictício anterior pode existir na mesma origem; use a mesma origem isolada e registre o baseline real, sem limpar armazenamento de produção.

## Matriz obrigatória

| Teste | Ação | Evidência exigida |
|---|---|---|
| Entrada | Mestre + 3 jogadores | canal real aberto, quadro recebido e 1 presença por identidade |
| Imagem | **Adicionar PNG (fluxo nativo)** no mestre; repetir com arquivo maior pelo input nativo | mídia visível em todos; mesma sala; itens/pins/fios anteriores intactos |
| Responsividade | mover um post-it existente, cursor e lanterna enquanto PNG é enviado | eventos continuam chegando antes do fim do upload; última posição converge |
| Ordem | editar objeto durante upload, depois excluir/substituir | não ressuscita item; imagem nova e última edição prevalecem |
| Integridade | comparar contagem/IDs/posições de itens, pins/fios e mídia nos relatórios | estado equivalente após convergir; sem erro hash/ACK; nenhuma duplicação |
| Cache | repetir atualização sem alterar arquivo; substituir bytes mantendo contexto do objeto | repetição não reenvia mídia confirmada; mídia alterada chega corretamente |
| Queda durante upload | **Simular queda** e reconectar, depois testar interrupção real da rede no Android | volta à mesma sala, recebe snapshot íntegro e mantém 1 presença |
| Retorno | recarregar jogador, suspender Android e retornar; reiniciar compartilhamento | conexões antigas não invalidam novas; recuperação com estado atual |
| Duas abas | mesma identidade fictícia em duas abas; depois feche a primeira e reconecte a segunda | aviso de duplicidade, sem takeover/ping-pong; retorno explícito funciona |
| Campanhas/salas | mestre em `/quadro/?case=other`, novo link/sala e jogadores preservando `case=other` | estado não atravessa campanha/sala; link antigo testado apenas explicitamente |
| Privacidade | ocultar objeto do mestre com descendentes, pins e fio; contribuir como jogador | materiais ocultos não chegam ao jogador e permanecem intactos no mestre |
| Compatibilidade | cliente wire 2, OBS, lotação/kick, arquivos salvos, fichas, áudio e Cinematic local | sem regressão; limitações do cliente antigo registradas |

Os botões **Simular queda** e **Reabrir compartilhamento** são instrumentos de fixture, não substituem teste de queda da rede física. Não exiba dados secretos no quadro de teste. A proteção da projeção pública tem regressões automatizadas; ela não autentica o participante PeerJS.

## Coleta e critérios de aprovação

O painel de teste mostra conexão, participantes, objetos, posições, pins, fios, mídia, eventos e estatísticas a cada 500 ms. No mestre, reabra **Diagnóstico da conexão** para atualizar o texto capturado. Registre horário, versão/head, navegador, aparelho, topologia/rede e ação que falhou. Anote `stats.maxAckMs`, retries e tamanho/quantidade de imagens. Não chame `maxAckMs` de latência do cursor. Para medir latência real do cursor, use gravação do envio e resultado ou relógios sincronizados; não subtraia `performance.now()` de aparelhos diferentes.

No Windows, para comparar bytes de mídia da fixture com o mesmo relatório de outro cliente, pode-se gerar hashes no DevTools. O Android deve ao menos confirmar visualmente a imagem e seu contador; a igualdade binária em Android exige inspeção remota própria e permanece pendente se indisponível. Exemplo somente no quadro fictício:

```js
const qaSnapshot = window.LIVE_QA.snapshot();
const qaMedia = await Promise.all(Object.entries(qaSnapshot.imgs).map(async ([id, data]) => {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return {id, hash: Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('')};
}));
console.table(qaMedia);
```

Não copie SDP, candidatos/IPs, tokens, dados de conta ou logs brutos para o PR. O módulo de diagnóstico já exporta contagens e estados seguros.

Se `ice-candidates-not-emitted`: compare eventos, candidatos nas estatísticas e contagens SDP; repita o probe nativo no mesmo aparelho. Se houver candidatos e `ice=failed`, investigue rotas/rede e disponibilidade dos servidores efetivos antes de considerar TURN. Se ICE conectar e canal não abrir, investigue DataChannel. Se o canal abrir e a aplicação falhar, analise LiveWire/ACK/hash. Não atribua todas essas falhas à mesma causa.

Somente liberar LIVE-01B após sucesso de mestre + três jogadores isolados, imagens e movimentos remotos, reconexão/presença/estado consistentes, controles de privacidade e prova autenticada de membro da campanha. Operações pessoais não confirmadas precisam ter recuperação definida e validada. Falhas, autenticação fictícia ou ausência de dispositivos não aprovam esses critérios.
