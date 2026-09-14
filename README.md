# CRIS + LUME — Reescritos

A raiz do projeto agora é o **CRIS**, sistema operacional usado pela Ordo durante a campanha.

- `index.html` — hub CRIS / caso 26-107
- `cris.css` / `cris.js` — identidade e interações do CRIS
- `lume/` — site público institucional da LUME, mantido separado como fonte externa de pesquisa
- `lume/index.html` — homepage pública da LUME
- `lume/noticia-1990-03-12-calisto.html` — referência `LM-90-03-12`

A proposta é que o CRIS concentre briefing, situação, arquivos e localizações, enquanto o LUME permaneça como uma fonte pública que os agentes podem consultar durante a investigação.


## Publicação via GitHub Pages

Este projeto está preparado para ser mantido em um repositório Git e publicado automaticamente pelo **GitHub Pages**.

### Estrutura importante

- `.gitignore` — evita arquivos temporários e arquivos locais de IDE no repositório.
- `.gitattributes` — mantém a normalização de texto consistente entre Windows, macOS e Linux.
- `.github/workflows/pages.yml` — publica automaticamente o site a cada `push` na branch `main`.
- `configurar-git.bat` — configuração inicial para Windows: cria o repositório local, conecta ao GitHub e faz o primeiro `push`.
- `publicar.bat` — rotina rápida para Windows: adiciona, cria o commit e envia as próximas atualizações.
- `index.html` — ponto de entrada do CRIS.
- `lume/` — site público da LUME.
- `assets/audio/samuel-briefing.mp3` — registro de áudio do Samuel.

### Primeiro envio para o GitHub

No terminal, dentro da pasta do projeto:

```bash
git init
git branch -M main
git add .
git commit -m "Versão inicial do CRIS"
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

No GitHub, em **Settings → Pages**, selecione **GitHub Actions** como origem da publicação. Depois disso, cada `git push` na `main` dispara a publicação automaticamente.

### Atualizar o site

Depois que o repositório estiver configurado, o fluxo normal é:

**No Windows:** execute `publicar.bat`, informe uma mensagem para a alteração e aguarde o envio.

**Pelo terminal:**

```bash
git add .
git commit -m "Atualiza conteúdo do CRIS"
git push
```

Não é necessário reenviar o ZIP manualmente para cada atualização. O workflow do GitHub cuida da publicação.

> **Importante:** o `.git` não é colocado dentro deste ZIP. Ele é criado localmente com `git init`, porque a pasta `.git` depende do repositório e da conta do GitHub que você vai usar.
