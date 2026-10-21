# referencial-triagem

Página de triagem dos artigos da tese **no celular**. **Este repositório é a casa da página** — o
código e o deploy vivem aqui, separados do repositório da tese.

Desde 20/10/2026 ela é sincronizada com a página Artigos × Bases da tese:

- **mesmos artigos**: os 154 da base da tese e os 872 candidatos (as duplicatas se triam pelo estudo
  que repetem);
- **mesmos arquivos**: `papers/data/triagem-tese.csv` (base) e `papers/data/triagem-candidatos.csv`
  (candidatos), no repositório privado `antonioaurel/phd`, no mesmo formato que o store em Python grava;
- **mesmo código**: `triagem-nucleo.js` é uma **cópia** de `tools/bases/triagem-pagina.js` do repositório
  da tese, posta aqui por `tools/triagem/sincroniza_celular.py`. Não edite o núcleo aqui;
- **mesmas regras**: "fora" pede motivo nas marcações novas; se a lista de artigos do repositório mudar
  no meio do caminho, a página fica só leitura.

Esta página **não contém dados**. Online (GitHub Pages, https://antonioaurel.github.io/referencial-triagem/)
ela lê e grava pela API do GitHub com um **token fine-grained pessoal**, guardado só no `localStorage` do
aparelho (o mesmo da Artigos × Bases publicada). No computador, o `serve.py` da tese serve esta pasta em
http://127.0.0.1:8765/triagem/ (clone ao lado do repositório da tese, ou `PHD_TRIAGEM_CELULAR`), e ela
grava nos arquivos locais, sem token.

Por isso o repositório pode ser público: o código é público, os dados ficam atrás da autenticação.
