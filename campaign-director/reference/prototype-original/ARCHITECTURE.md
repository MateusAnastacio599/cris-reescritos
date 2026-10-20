# Arquitetura alvo — CRIS como mesa completa do mestre

## 1. Núcleo persistente
O App Shell do CRIS fica montado durante toda a sessão. O Audio Engine pertence ao App Shell e **não** às páginas, garantindo que navegação entre ficha, quadro, wiki e mapas não interrompa som.

## 2. Modelo de dados

```js
Campaign {
  pages: Page[]
  audioAssets: AudioAsset[]
}

Page {
  id, title, folder, tags,
  scenes: Scene[]
}

Scene {
  id, title, markdown,
  music,
  layers: AudioLayer[],
  timeline: TimelineEvent[],
  triggers: Trigger[],
  cues: Cue[]
}

Cue {
  id, name,
  actions: [fade, play, stop, seek, volume, delay, handout]
}
```

## 3. Provedores de música
- Local/licenciado: controle completo, melhor opção técnica.
- YouTube IFrame API: URL + timestamp + volume dentro das regras do player.
- Spotify: manter apenas como link/referência; não usar para mixar com SFX no produto.

## 4. Modos de interface
- **Edição:** wiki + configuração de cenas + biblioteca de áudio.
- **Sessão:** narração limpa + triggers + timeline + dock persistente.
- **Jogador:** fichas, handouts, quadro compartilhado e elementos liberados pelo mestre.

## 5. Casa São Martinho como teste de integração
A página já testa quase tudo que o módulo precisa:
- chuva em loop;
- room tone;
- efeitos manuais de fechadura/sino/trovão;
- riser automático;
- fade brusco para silêncio;
- cue composta na Terceira Badalada;
- texto do mestre na mesma tela.
