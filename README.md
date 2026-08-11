# referencial-triagem

Casca (front-end) da página mobile de triagem do referencial teórico da tese.
**Este repositório é a casa da página** — o código fonte e o deploy vivem aqui,
separados do repositório da tese.

Esta página **não contém dados**. Ela lê e grava a triagem direto num
repositório **privado** (`antonioaurel/phd`) pela API do GitHub, usando um
**token fine-grained pessoal** que você cria e cola na própria página (guardado
só no `localStorage` do seu aparelho). Sem esse token, a página não mostra nada.

Por isso o repositório da casca pode ser público: o código é público, os dados
ficam atrás da autenticação.

Publicada por GitHub Pages em https://antonioaurel.github.io/referencial-triagem/
