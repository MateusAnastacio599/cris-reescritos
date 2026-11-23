# Aceitação CINEMATIC-01.4

## Resultado automatizado

- `npm run check`: aprovado (módulos/imports, shell, CSS e arquivos existentes).
- `npm test`: **375/375**, zero falhas, cancelamentos ou skips. Os 355 casos anteriores foram mantidos e foram acrescentados 20 casos de Studio/direção/vídeo/backup.
- Backup completo pelo `exportWorkspace`/`importWorkspace` real: metadados e bytes WebM restaurados, Markdown e configurações preservados; backup corrompido recusado antes de alterar o armazenamento.
- Compatibilidade de conta/campanha/cena/sessão, mensagens antigas, troca rápida e cancelamento continuam cobertos pelas suites anteriores da Cinematic.

## Chrome real — demonstração isolada

Cenas e identidade fictícias; nenhuma conta real ou campanha do usuário alterada.

| Caminho | Resultado |
| --- | --- |
| Director + quadro raiz, viewport 1440 px | aprovado: câmera amostrada em instantes distintos, alpha decodificado, pausa/seek/reinício, cues, encerramento e áudio local |
| Director + quadro raiz, viewport 390 px | aprovado: mesmas operações, painéis alternáveis, corpo sem overflow horizontal |
| Director + quadro integrado, 1440 px e movimento reduzido simulado | composição estática + aviso; permissão explícita local ativa movimento na prévia e no quadro; aprovado |
| WebM VP9 original | alpha de pixel externo **0**, pixel opaco **255**; personagem animada sobre o fundo, não apenas MIME reconhecido |
| Reprodução bloqueada deliberadamente no Chrome | `play()` de vídeo rejeitado na fixture; PNG permanece visível e aviso aparece; aprovado |
| Recarga do quadro | apresentação não ressuscitou; aprovado |
| Apresentar por cue / encerrar por cue / reapresentar / autoencerrar | aprovado; camada removida e estado atualizado |
| Snapshot completo e áudio local | idêntico antes/depois nas execuções finais; áudio continuou na mesma cena, mesmo master e tempo crescente |

O cenário contém Iris a 3,8%, plateia, dois atores sem efeito local, respiração por âncora nos pés, câmera de 1× a 2,2× e luz amarela pulsante. As duas cópias do quadro usam o mesmo renderer atualizado, sem alteração em seus snapshots ou módulos de persistência.

## Gestos reais no desktop

- Âncora Pés → Centro: bounding box permaneceu exatamente em x=615,8671875, y=537,890625, largura=31,21875, altura=62,4375.
- Arraste nativo: X/Y de 50/60 para 55,963/53,726.
- Alça nativa de escala: 3,8% → 8,424%; Desfazer → 3,8%; Refazer → 8,424%.
- Enquadrar seleção: zoom de visualizador 481%, mantendo escala persistida 3,8%; Ajustar retorna a 100%.
- O teste visual identificou e corrigiu um campo numérico que rejeitava a precisão de posições calculadas por âncora, e uma alça que não acompanhava a troca de seleção.

## Notas de verificação e limites

Uma execução com outra aba ativa não mediu avanço visual; os testes de animação foram executados em primeiro plano. Uma execução desktop inicial apresentou divergência de snapshot. Foi acrescentado diagnóstico de diferenças à fixture; a divergência **não se repetiu** nas execuções completas posteriores em desktop, mobile e quadro integrado. A causa dessa ocorrência inicial não foi confirmada; se reaparecer, o diagnóstico imprime antes/depois sem modificar os dados. Não houve alteração no código de estado do quadro para contornar o teste.

Safari, aparelho físico iOS/Android, dispositivo de pouca memória e Spotify conectado não foram testados. Não se afirma suporte de alpha no Safari. Fallback de falta de decoder foi testado automatizadamente, e bloqueio de reprodução foi simulado no Chrome; não houve teste em um dispositivo real sem decoder alpha.

Não houve teste de transmissão entre dispositivos, recurso fora do escopo. A persistência/backups foi exercitada de forma automatizada; a reabertura do Studio também foi conferida no navegador com os dados salvos da demonstração. A recarga completa do Director durante uma apresentação segue as suites pré-existentes de lifecycle/protocolo; a nova execução visual específica verificou a recarga do quadro.

Logs completos, capturas desktop/mobile e patch estão no pacote de entrega. Nenhuma publicação ou merge foi executado.
