/* CÓPIA — não edite aqui. Fonte: tools/bases/triagem-pagina.js no repositório phd, copiada por
 * tools/triagem/sincroniza_celular.py. */
/* Triagem pela página Artigos × Bases — todos os artigos: base da tese e candidatos.
 *
 * Pedido do pesquisador em 20/10/2026. Inserido na página por tools/bases/gera_matriz_bases.py
 * (no lugar de TRIAGEM_JS do template). Dois modos, escolhidos sozinhos:
 *
 *   local   a página veio do serve.py: grava por /api/triagem (base, papers/data/triagem-tese.csv)
 *           e /api/triagem-candidatos (candidatos, papers/data/triagem-candidatos.csv); quem
 *           escreve o arquivo é o store em Python.
 *   online  GitHub Pages: com o token pessoal (o mesmo da página de triagem do celular, guardado
 *           neste navegador em localStorage "ghpat"), lê e grava os dois CSV no repositório
 *           privado pela API de conteúdo do GitHub. O CSV é montado AQUI com as mesmas regras
 *           do store (triagem_store.py): ordem dos ids, limpeza do motivo, carimbo preservado
 *           quando nada mudou, comentário só nos incluídos, 9 colunas. tools/review/bases/
 *           teste_triagem_csv.js confere, byte a byte, que este código e o store dão o mesmo
 *           arquivo.
 *   sem nenhum dos dois: só leitura, com o botão para conectar.
 *
 * "Fora" exige motivo (pedido de 20/10/2026, só nesta página; o painel continua sem pedir).
 * A coluna Status da tabela é a da última geração da página; a marcação salva aparece na hora
 * nos botões e entra no Status quando a página for regerada.
 */
"use strict";
(function (raiz) {
  const CFG = { owner: "antonioaurel", repo: "phd", branch: "main" };
  const ARQ = {
    base: { csv: "papers/data/triagem-tese.csv", api: "/api/triagem", meta: "papers/data/articles.json" },
    cand: { csv: "papers/data/triagem-candidatos.csv", api: "/api/triagem-candidatos", meta: "papers/data/matriz-artigos-bases.csv" },
  };
  const COLUNAS = ["id", "decisao", "motivo", "titulo", "ano", "autores", "origem", "marcado_em", "comentario"];

  /* ---------- funções puras (as mesmas regras do store; testadas contra ele) ---------- */
  // _limpar_motivo / _limpar_comentario: só caracteres "imprimíveis" do Python (tira as
  // categorias Unicode C e Z, menos o espaço ASCII), espaços colapsados, corte em code points.
  function limpa(s, lim) {
    s = String(s == null ? "" : s).replace(/[\p{C}\p{Z}]/gu, ch => (ch === " " ? " " : ""));
    s = s.split(" ").filter(Boolean).join(" ");
    return Array.from(s).slice(0, lim).join("");
  }
  const limpaMotivo = s => limpa(s, 280), limpaComentario = s => limpa(s, 300);
  // sorted(ids, key=lambda i: (i[0], i[1:].zfill(6)))
  function zfill6(s) { return s.length >= 6 ? s : "0".repeat(6 - s.length) + s; }
  function ordenaIds(ids) {
    return ids.slice().sort((x, y) => {
      const a = [x[0], zfill6(x.slice(1))], b = [y[0], zfill6(y.slice(1))];
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
    });
  }
  // csv.DictWriter(QUOTE_MINIMAL, lineterminator="\n")
  function campo(s) { s = s == null ? "" : String(s); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function parseCSV(text) {
    const rows = []; let row = [], f = "", i = 0, q = false; text = text.replace(/^﻿/, "");
    while (i < text.length) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; } f += c; i++; continue; }
      if (c === '"') { q = true; i++; continue; }
      if (c === ",") { row.push(f); f = ""; i++; continue; }
      if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; i++; continue; }
      if (c === "\r") { i++; continue; }
      f += c; i++;
    }
    if (f.length || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  function objetos(text) {
    const rows = parseCSV(text); if (!rows.length) return [];
    const h = rows[0];
    return rows.slice(1).filter(r => r.length > 1 || r[0]).map(r => Object.fromEntries(h.map((k, j) => [k, r[j] == null ? "" : r[j]])));
  }
  // TriagemStore.carregar(): só decisões válidas de ids que existem na base; textos limpos
  function lerTriagem(text, meta) {
    const st = { marcas: {}, motivos: {}, comentarios: {}, carimbos: {} };
    for (const l of objetos(text || "")) {
      const id = (l.id || "").trim(), dec = (l.decisao || "").trim().toLowerCase();
      if (!id || (dec !== "incluir" && dec !== "fora") || !meta[id]) continue;
      st.marcas[id] = dec; st.motivos[id] = limpaMotivo(l.motivo || "");
      st.comentarios[id] = limpaComentario(l.comentario || ""); st.carimbos[id] = (l.marcado_em || "").trim();
    }
    return st;
  }
  // TriagemStore.salvar(): `marcas` é o estado inteiro; motivo não editado é o do arquivo
  function montaCSV(atual, marcas, motivosEditados, meta, agora) {
    const linhas = [COLUNAS.map(campo).join(",")];
    for (const id of ordenaIds(Object.keys(marcas))) {
      const dec = marcas[id];
      const motivo = id in motivosEditados ? limpaMotivo(motivosEditados[id]) : (atual.motivos[id] || "");
      const comentario = dec === "incluir" ? (atual.comentarios[id] || "") : "";
      const inalterado = atual.marcas[id] === dec && (atual.motivos[id] || "") === motivo && (atual.comentarios[id] || "") === comentario;
      const carimbo = (inalterado ? atual.carimbos[id] || "" : "") || agora;
      const m = meta[id];
      linhas.push([id, dec, motivo, m.titulo, m.ano, m.autores, m.origem, carimbo, comentario].map(campo).join(","));
    }
    return linhas.join("\n") + "\n";
  }
  function metaBase(articlesJson) {
    const doc = JSON.parse(articlesJson), lista = Array.isArray(doc) ? doc : doc.articles, out = {};
    for (const a of lista) if (a && a.id) out[a.id] = { titulo: a.title || "", ano: String(a.year || ""), autores: a.authors || "", origem: a.origin || "" };
    return out;
  }
  function metaCand(matrizCsv) {
    const out = {};
    for (const l of objetos(matrizCsv)) if (l.grupo !== "Base da tese" && !l.dup) out[l.id] = { titulo: l.titulo, ano: l.ano, autores: "", origem: l.origem };
    return out;
  }
  function agoraISO() {
    const d = new Date(), p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  const PURAS = { limpaMotivo, limpaComentario, ordenaIds, parseCSV, lerTriagem, montaCSV, metaBase, metaCand };
  if (typeof module !== "undefined" && module.exports) { module.exports = PURAS; return; }

  /* ---------- estado da página ---------- */
  const doc = raiz.document;
  const S = { modo: "leitura", token: "", erro: "" };
  const F = {};   // por arquivo: {meta, atual, versao|sha, marcas, motivos}
  for (const k in ARQ) F[k] = { meta: null, atual: { marcas: {}, motivos: {}, comentarios: {}, carimbos: {} }, versao: "", sha: null, marcas: {}, motivos: {} };
  let redesenha = () => {};
  const IDS = { base: {}, cand: {} };  // ids triáveis no modo local (o store confere de novo)
  // Página com retrato embutido (Artigos × Bases) confere o retrato contra o repositório; página
  // sem retrato (a do celular) monta a lista a partir dos próprios arquivos de metadados.
  let comRetrato = true;
  const grupoDe = r => (r.g === "Base da tese" ? "base" : "cand");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function ls(k, v) { try { if (v === undefined) return raiz.localStorage.getItem(k) || ""; if (v === null) raiz.localStorage.removeItem(k); else raiz.localStorage.setItem(k, v); } catch (e) { return ""; } }

  function pendentes() {
    const out = [];
    for (const k in F) {
      const f = F[k], ids = new Set([...Object.keys(f.atual.marcas), ...Object.keys(f.marcas)]);
      for (const id of ids) {
        const a = f.atual.marcas[id] || "", b = f.marcas[id] || "";
        if (a !== b || (b && id in f.motivos && limpaMotivo(f.motivos[id]) !== (f.atual.motivos[id] || ""))) out.push([k, id]);
      }
    }
    return out;
  }
  // Só o que foi marcado ou mudado AQUI: os "fora" já salvos sem motivo (o painel deixou de
  // pedir motivo em 11/08/2026) não travam o salvar.
  function semMotivo() {
    const out = [];
    for (const [k, id] of pendentes()) {
      if (F[k].marcas[id] !== "fora") continue;
      const m = id in F[k].motivos ? F[k].motivos[id] : F[k].atual.motivos[id];
      if (!limpaMotivo(m)) out.push(id);
    }
    return out;
  }
  function fixa(k, st, versao, sha) {
    const f = F[k];
    f.atual = { marcas: st.marcas || {}, motivos: st.motivos || {}, comentarios: st.comentarios || {}, carimbos: st.carimbos || {} };
    f.versao = versao || ""; f.sha = sha || null;
    f.marcas = { ...f.atual.marcas }; f.motivos = {};
  }
  function edicoes(k) {
    const f = F[k], set = {}, clr = [];
    for (const id of new Set([...Object.keys(f.atual.marcas), ...Object.keys(f.marcas)])) {
      const a = f.atual.marcas[id] || "", b = f.marcas[id] || "";
      if (b && (a !== b || id in f.motivos)) set[id] = { dec: b, mot: f.motivos[id] };
      else if (!b && a) clr.push(id);
    }
    return { set, clr };
  }
  function reaplica(k, e) {
    const f = F[k];
    for (const id in e.set) { f.marcas[id] = e.set[id].dec; if (e.set[id].mot !== undefined) f.motivos[id] = e.set[id].mot; }
    for (const id of e.clr) delete f.marcas[id];
  }

  /* ---------- local (serve.py) ---------- */
  async function localGet(k) {
    const r = await fetch(ARQ[k].api, { cache: "no-store" });
    if (!r.ok) throw new Error(`${ARQ[k].api}: ${r.status}`);
    return r.json();
  }
  async function localSalva(k) {
    const f = F[k], e = edicoes(k), motivos = {};
    for (const id in f.motivos) if (f.marcas[id]) motivos[id] = f.motivos[id];
    const r = await fetch(ARQ[k].api, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marcas: f.marcas, motivos, base: f.versao }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 409 && j.atual) { fixa(k, j.atual, j.atual.versao); reaplica(k, e); throw Object.assign(new Error("conflito"), { conflito: true }); }
    if (!r.ok) throw new Error(j.erro || `erro ${r.status}`);
    fixa(k, j, j.versao);
  }

  /* ---------- online (API do GitHub) ---------- */
  const API = `https://api.github.com/repos/${CFG.owner}/${CFG.repo}/contents`;
  const cab = () => ({ Authorization: `Bearer ${S.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });
  function b64d(b) { const bin = atob(b.replace(/\s/g, "")); return new TextDecoder("utf-8").decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }
  function b64e(s) { const by = new TextEncoder().encode(s); let bin = ""; for (let i = 0; i < by.length; i += 0x8000) bin += String.fromCharCode.apply(null, by.subarray(i, i + 0x8000)); return btoa(bin); }
  async function ghGet(path) {
    const r = await fetch(`${API}/${path}?ref=${CFG.branch}`, { headers: cab(), cache: "no-store" });
    if (r.status === 404) return { falta: true };
    if (r.status === 401) throw new Error("token inválido ou sem acesso ao repositório (401)");
    if (!r.ok) throw new Error(`GitHub ${r.status} ao ler ${path}`);
    const j = await r.json();
    if (!j.content && j.download_url) throw new Error(`${path} grande demais para a API de conteúdo`);
    return { texto: b64d(j.content), sha: j.sha };
  }
  async function ghPut(path, texto, sha, msg) {
    const corpo = { message: msg, content: b64e(texto), branch: CFG.branch }; if (sha) corpo.sha = sha;
    const r = await fetch(`${API}/${path}`, { method: "PUT", headers: cab(), body: JSON.stringify(corpo) });
    // 409: o sha mudou (outra tela gravou). 422 só é conflito quando o arquivo passou a existir
    // sem que a página soubesse ("sha wasn't supplied"); nos demais casos é erro de pedido, com
    // a mensagem do GitHub, e nada é recarregado (revisão 031, ISS-002).
    if (r.status === 409) throw Object.assign(new Error("conflito"), { conflito: true });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      if (r.status === 422 && /sha/i.test(j.message || "")) throw Object.assign(new Error("conflito"), { conflito: true });
      throw new Error(`GitHub ${r.status}: ${j.message || "erro ao gravar"}`);
    }
    return (await r.json()).content.sha;
  }
  // A página publicada é um retrato; o repositório pode ter andado. Se a LISTA de ids triáveis do
  // repositório não for a da página, a página está defasada: fica só leitura e diz para regerar
  // (revisão 031, ISS-001). Título e ano não entram na conferência: a página mostra os da matriz,
  // o arquivo grava os do repositório — os mesmos que o store gravaria.
  function confereIds(k, meta) {
    if (!comRetrato) { IDS[k] = Object.fromEntries(Object.keys(meta).map(i => [i, 1])); return; }
    const repo = Object.keys(meta), pag = Object.keys(IDS[k]);
    const so_repo = repo.filter(i => !(i in IDS[k])), so_pag = pag.filter(i => !(i in meta));
    if (so_repo.length || so_pag.length)
      throw new Error(`a página está defasada em relação ao repositório (${k === "base" ? "base da tese" : "candidatos"}: `
        + `${so_repo.length} id(s) só no repositório${so_repo.length ? " — " + so_repo.slice(0, 4).join(", ") : ""}, `
        + `${so_pag.length} só na página${so_pag.length ? " — " + so_pag.slice(0, 4).join(", ") : ""}); regere e publique a página antes de triar online`);
  }
  // Relida e reconferida em TODA carga e antes de toda gravação, não só ao conectar: o repositório
  // pode andar no meio da sessão (revisão 031, rodada 2).
  async function onlineMeta(k) {
    const m = await ghGet(ARQ[k].meta);
    if (m.falta) throw new Error(`${ARQ[k].meta} não existe no repositório`);
    const meta = k === "base" ? metaBase(m.texto) : metaCand(m.texto);
    confereIds(k, meta);
    F[k].meta = meta;
  }
  async function onlineCarrega(k) {
    const f = F[k];
    await onlineMeta(k);
    const t = await ghGet(ARQ[k].csv);
    fixa(k, t.falta ? {} : lerTriagem(t.texto, f.meta), "", t.falta ? null : t.sha);
  }
  async function onlineSalva(k) {
    const f = F[k], e = edicoes(k);
    try { await onlineMeta(k); }
    catch (err) { S.modo = "leitura"; throw err; }  // defasou no meio da sessão: para de gravar, marcações ficam
    const texto = montaCSV(f.atual, f.marcas, f.motivos, f.meta, agoraISO());
    try { f.sha = await ghPut(ARQ[k].csv, texto, f.sha, `triagem (Artigos × Bases online): ${Object.keys(e.set).length + e.clr.length} alteração(ões)`); }
    catch (err) { if (err.conflito) { await onlineCarrega(k); reaplica(k, e); } throw err; }
    fixa(k, lerTriagem(texto, f.meta), "", f.sha);
  }

  /* ---------- interface ---------- */
  function barra() {
    const b = doc.getElementById("trbar"); if (!b) return;
    const n = pendentes().length;
    const modo = S.modo === "local" ? "gravando neste computador (serve.py)" : S.modo === "online" ? "online: grava no repositório com o seu token" : "só leitura";
    const tot = k => Object.values(F[k].marcas);
    const inc = tot("base").concat(tot("cand")).filter(v => v === "incluir").length, fora = tot("base").concat(tot("cand")).filter(v => v === "fora").length;
    b.innerHTML = `<b>Triagem</b> <span class="s">${esc(modo)}</span>`
      + (S.modo !== "leitura" ? ` · <span>${inc} incluir · ${fora} fora (marcados)</span>` : "")
      + (n ? ` · <b>${n}</b> não salva${n > 1 ? "s" : ""}${S.modo !== "leitura" ? ` <button id="trsalva">Salvar</button>` : ""} <button id="trdesfaz">Desfazer</button>` : "")
      + (S.modo === "leitura" ? ` <button id="trconecta">Conectar para triar</button>` : "")
      + (S.modo === "online" ? ` <button id="trsai" class="s">desconectar</button>` : "")
      + (S.erro ? ` <span class="trerro">${esc(S.erro)}</span>` : "")
      + `<span id="trtok" style="display:none"> <input id="trtokv" type="password" placeholder="token do GitHub (contents: read/write no repo phd)" autocomplete="off"> <button id="trtokok">Conectar</button></span>`;
  }
  function celula(r) {
    if (S.modo === "leitura") return "";
    if (r.dp) return `<div class="trc s">triar pelo estudo ${esc(r.dp)}</div>`;
    const k = grupoDe(r), f = F[k];
    if (!f.meta || !f.meta[r.i]) return `<div class="trc s">fora da lista triável</div>`;
    const d = f.marcas[r.i] || "", salvo = f.atual.marcas[r.i] || "";
    const mot = r.i in f.motivos ? f.motivos[r.i] : f.atual.motivos[r.i] || "";
    const mud = d !== salvo || (d && r.i in f.motivos && limpaMotivo(f.motivos[r.i]) !== (f.atual.motivos[r.i] || ""));
    return `<div class="trc${mud ? " mud" : ""}" data-id="${esc(r.i)}" data-k="${k}">`
      + `<button data-a="incluir" class="${d === "incluir" ? "on inc" : ""}">Incluir</button>`
      + `<button data-a="fora" class="${d === "fora" ? "on nao" : ""}">Fora</button>`
      + (d ? `<button data-a="limpa" title="tirar a marcação">✕</button>` : "")
      + (d === "fora" ? `<input class="trmot${limpaMotivo(mot) ? "" : " falta"}" maxlength="280" placeholder="motivo (obrigatório)" value="${esc(mot)}">` : "")
      + (mud ? `<span class="s"> não salvo</span>` : (salvo ? `<span class="s"> salvo</span>` : ""))
      + `</div>`;
  }
  function marcacao(r) { const f = F[grupoDe(r)]; return f.marcas[r.i] || ""; }
  function naoSalvo(r) { return pendentes().some(([, id]) => id === r.i); }

  async function carrega() {
    S.erro = "";
    try {
      if (S.modo === "local") {
        for (const k in F) {
          const j = await localGet(k); fixa(k, j, j.versao);
          if (comRetrato) F[k].meta = IDS[k];
          else {  // celular servido pelo serve.py: títulos dos mesmos arquivos que o store lê
            const r = await fetch("/" + ARQ[k].meta, { cache: "no-store" });
            if (!r.ok) throw new Error(`/${ARQ[k].meta}: ${r.status}`);
            const meta = k === "base" ? metaBase(await r.text()) : metaCand(await r.text());
            confereIds(k, meta); F[k].meta = meta;
          }
        }
      }
      else if (S.modo === "online") { for (const k in F) await onlineCarrega(k); }
    } catch (e) { S.erro = e.message; if (S.modo === "online") { S.modo = "leitura"; } }
    barra(); redesenha();
  }
  async function salva() {
    const falta = semMotivo();
    if (falta.length) { S.erro = `"Fora" sem motivo: ${falta.slice(0, 8).join(", ")}${falta.length > 8 ? "…" : ""} — escreva o motivo antes de salvar`; barra(); return; }
    S.erro = "";
    const grava = S.modo === "local" ? localSalva : onlineSalva;
    const lote = Object.keys(F).filter(k => pendentes().some(([kk]) => kk === k));
    // Online: confere os metadados de TODOS os arquivos do lote antes do primeiro envio, para uma
    // defasagem no segundo arquivo não deixar o primeiro gravado (revisão 031, rodada 3). A API do
    // GitHub grava um arquivo por vez: conflito ou queda de rede no segundo ainda pode deixar o
    // primeiro salvo e o segundo pendente — cada arquivo fica íntegro e a pendência fica na tela.
    if (S.modo === "online") {
      try { for (const k of lote) await onlineMeta(k); }
      catch (e) { S.modo = "leitura"; S.erro = e.message; barra(); return redesenha(); }
    }
    try { for (const k of lote) await grava(k); }
    catch (e) { S.erro = e.conflito ? "outra tela gravou no meio do caminho: recarreguei e mantive suas marcas — salve de novo" : e.message; }
    barra(); redesenha();
  }
  // linhas: o retrato embutido da página ([{i, g, dp}]); sem ele (null), a lista vem dos arquivos.
  function liga(desenha, linhas) {
    redesenha = desenha;
    comRetrato = !!linhas;
    for (const r of linhas || []) if (!r.dp) IDS[grupoDe(r)][r.i] = 1;
    doc.addEventListener("click", e => {
      const b = e.target.closest("#trbar button, .trc button"); if (!b) return;
      if (b.id === "trsalva") return salva();
      if (b.id === "trdesfaz") { for (const k in F) { F[k].marcas = { ...F[k].atual.marcas }; F[k].motivos = {}; } S.erro = ""; barra(); return redesenha(); }
      if (b.id === "trconecta") { const t = doc.getElementById("trtok"); t.style.display = ""; doc.getElementById("trtokv").focus(); return; }
      if (b.id === "trtokok") { const v = doc.getElementById("trtokv").value.trim(); if (!v) return; S.token = v; S.modo = "online"; carrega().then(() => { if (S.modo === "online") ls("ghpat", v); }); return; }
      if (b.id === "trsai") { if (pendentes().length && !raiz.confirm("Há marcações não salvas. Desconectar mesmo assim?")) return; ls("ghpat", null); S.token = ""; S.modo = "leitura"; barra(); return redesenha(); }
      const c = b.closest(".trc"); if (!c) return;
      const f = F[c.dataset.k], id = c.dataset.id, a = b.dataset.a;
      if (a === "limpa") delete f.marcas[id]; else f.marcas[id] = a;
      barra(); redesenha();
    });
    doc.addEventListener("input", e => {
      const i = e.target.closest(".trc .trmot"); if (!i) return;
      const c = i.closest(".trc"); F[c.dataset.k].motivos[c.dataset.id] = i.value;
      i.classList.toggle("falta", !limpaMotivo(i.value)); barra();
    });
    raiz.addEventListener("beforeunload", e => { if (pendentes().length) { e.preventDefault(); e.returnValue = ""; } });
    // modo: serve.py responde /api/triagem; senão, online se houver token guardado
    // serve.py só escuta no próprio computador: fora dele (GitHub Pages) nem pergunta, para não
    // deixar um 404 no console a cada visita
    const local = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(raiz.location.hostname);
    (local ? fetch(ARQ.base.api, { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null)).then(j => {
      if (j && typeof j.versao === "string") S.modo = "local";
      else if ((S.token = ls("ghpat")) && /^https:/.test(raiz.location.protocol)) S.modo = "online";
      barra(); redesenha(); carrega();
    });
  }
  // artigos(): a lista para a página sem retrato montar os cartões (base e candidatos, com título)
  function artigos() {
    const out = [];
    for (const k in F) for (const i in F[k].meta || {}) {
      const m = F[k].meta[i];
      if (m && typeof m === "object") out.push({ i, g: k === "base" ? "Base da tese" : "Candidato (triagem)", t: m.titulo, a: m.ano, au: m.autores, o: m.origem });
    }
    return out;
  }
  const modo = () => S.modo;
  raiz.TRIAGEM = { liga, celula, marcacao, naoSalvo, artigos, modo, ...PURAS };
})(typeof window !== "undefined" ? window : globalThis);
