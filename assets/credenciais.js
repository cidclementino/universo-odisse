// O Estúdio › Credenciais (#/credenciais) e a lista de documentos comum às páginas Empresa e Equipe.
//
// Cada documento mora com o seu dono (worker/dados/credenciais.js, catálogo e regras):
//   Empresa      Constituição e registros, Sede          → montar(el, 'constituicao' | 'sede', 'emp_odisse')
//   Equipe       Documentos da pessoa                    → montar(el, 'equipe', 'eqp_…')
//   Credenciais  Regularidade, Econômico-financeira, Cadastros e acessos, Atestados e RRTs (por ora), e o
//                estado de tudo: Placar (vencidos, a vencer, faltando, em dia) e o que pede atenção nas outras páginas.
// Uma leitura só (GET /api/v1/credenciais/quadro), guardada como cópia (sem os números dos documentos de identidade).
//
// Linha do documento: ✎ em caixa · nome e detalhe · Etiqueta da validade · arquivo · Substituir (só os que vencem).
// Exigido e não registrado: linha tracejada com "falta". Opcionais e "mais um" (CAT, balanço…): etiquetas
// tracejadas "+ …" no fim da lista. Registrar, editar e substituir abrem a Gaveta (grava sozinha ao salvar).
// Substituir registra o documento novo e arquiva o anterior no mesmo lote: é o que tira o aviso da Início.
// A Início pede para abrir a Gaveta de substituição guardando { id } em sessionStorage ('credenciais:abrir').

import { lerCopia, gravarCopia } from './memoria.js';
import { numeros } from '../base/v2/componentes.js';

const COPIA = 'credenciais:quadro';
const PENDENTE = 'credenciais:abrir';
const RECOLHIDOS = 'credenciais:recolhidos';
const EMPRESA = 'emp_odisse';

const SVG = {
  lapis: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.6 2.6 13.4 5.4 5.6 13.2 2.4 13.6 2.8 10.4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  fechar: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4 12 12M12 4 4 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  seta: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arquivo: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.8h5.2L12.5 5v9.2h-8.5zM9 2v3.2h3.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  trocar: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6h9l-2.5-2.5M13 10H4l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ir: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const dataBr = (d) => (d ? d.split('-').reverse().join('/') : '');
const diasAte = (d, hoje) => Math.round((Date.parse(d) - Date.parse(hoje)) / 864e5);
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const sha256 = async (blob) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))]
  .map((b) => b.toString(16).padStart(2, '0')).join('');

export function criarCredenciais({ esc, api, apiBinario, toque }) {
  let Q = lerCopia(COPIA);            // quadro: { hoje, catalogo, lugares, itens, equipe, projetos }
  let buscando = null;
  const montados = new Set();         // { el, lugar, dono } desenhados nas páginas
  let pagina = null;                  // raiz da página Credenciais, quando aberta
  let gav = null;                     // estado da Gaveta
  let recolhidos = new Set((() => { try { return JSON.parse(localStorage.getItem(RECOLHIDOS) || '[]'); } catch { return []; } })());

  const cat = (tipo) => Q?.catalogo.find((c) => c.tipo === tipo);
  const hoje = () => Q?.hoje || hojeBR();
  const itensDe = (lugar, dono) => (Q?.itens || []).filter((i) => cat(i.tipo)?.lugar === lugar && (!dono || i.dono_id === dono));
  const pessoa = (id) => Q?.equipe.find((e) => e.id === id);
  const temRegistro = (id) => !!pessoa(id)?.registro;
  // na equipe, "exigido" só vale para quem tem registro no conselho
  const exigido = (c, dono) => c.exigido && (c.lugar !== 'equipe' || temRegistro(dono));
  const estado = (i) => {
    if (!i.vence_em) return 'sem_validade';
    const d = diasAte(i.vence_em, hoje());
    return d < 0 ? 'vencido' : d <= (Q?.aviso_dias || 30) ? 'vence' : 'ok';
  };

  // ---- leitura -------------------------------------------------------------------

  async function carregar() {
    if (buscando) return buscando;
    buscando = (async () => {
      const r = await api('/api/v1/credenciais/quadro').catch((e) => ({ status: 0, erro: e.message }));
      if (r.status !== 200) return { erro: r.erro || r.status };
      const { status, ...novo } = r;
      const mudou = JSON.stringify(novo) !== JSON.stringify(Q);
      Q = novo;
      // nada sensível na cópia: os números dos documentos de identidade ficam fora
      gravarCopia(COPIA, { ...Q, itens: Q.itens.map((i) => (i.tipo === 'identidade' ? { ...i, numero: null } : i)) });
      if (mudou) redesenhar();
      abrirPendente();
      return {};
    })().finally(() => { buscando = null; });
    return buscando;
  }

  function redesenhar() {
    for (const m of [...montados]) {
      if (!m.el.isConnected) { montados.delete(m); continue; }
      m.el.innerHTML = lista(m.lugar, m.dono);
    }
    if (pagina?.isConnected) desenharPagina();
  }

  // ---- lista de documentos (comum às páginas) --------------------------------------

  function etiquetaValidade(i) {
    const e = estado(i);
    if (e === 'vencido') return `<span class="ini-etq problema" title="Venceu em ${dataBr(i.vence_em)}">vencido em ${dataBr(i.vence_em)}</span>`;
    if (e === 'vence') {
      const d = diasAte(i.vence_em, hoje());
      return `<span class="ini-etq atencao" title="Vence em ${dataBr(i.vence_em)}">${d === 0 ? 'vence hoje' : `vence em ${d} ${d === 1 ? 'dia' : 'dias'}`}</span>`;
    }
    if (e === 'ok') return `<span class="ini-etq cre-etq-nevoa">vale até ${dataBr(i.vence_em)}</span>`;
    return '';
  }

  function linha(i, { comDono = false } = {}) {
    const c = cat(i.tipo) || { nome: i.tipo, vence: 'nao' };
    const sub = [
      comDono && i.projeto_codigo ? `${i.projeto_codigo}${i.projeto_nome ? ' ' + i.projeto_nome : ''}` : '',
      i.titulo, i.numero ? `nº ${i.numero}` : '', i.emitido_em ? `emitido em ${dataBr(i.emitido_em)}` : '',
    ].filter(Boolean).join(' · ');
    const arq = i.arquivo_id
      ? `<button type="button" class="u-botao cre-mini" data-cre="abrir-arquivo" data-arq="${esc(i.arquivo_id)}" title="${esc(i.arquivo_nome || 'Abrir arquivo')}">${SVG.arquivo}Abrir</button>`
      : '<span class="ini-etq opcional">sem arquivo</span>';
    const substituir = c.vence !== 'nao'
      ? `<button type="button" class="u-botao cre-mini${estado(i) === 'vencido' ? ' cre-urgente' : ''}" data-cre="substituir" data-id="${esc(i.id)}">${SVG.trocar}Substituir</button>`
      : '';
    return `<div class="cre-linha" data-cre-id="${esc(i.id)}">
        <button type="button" class="cre-caixa" data-cre="editar" data-id="${esc(i.id)}" aria-label="Editar ${esc(c.nome)}">${SVG.lapis}</button>
        <span class="cre-txt"><b>${esc(c.nome)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>
        <span class="cre-etqs">${etiquetaValidade(i)}</span>
        <span class="cre-acoes">${arq}${substituir}</span>
      </div>`;
  }

  // a lista de um lugar para um dono (projeto: dono vazio = todos os projetos)
  function lista(lugar, dono) {
    if (!Q) return '<p class="u-apoio cre-carregando">Carregando documentos…</p>';
    const tipos = Q.catalogo.filter((c) => c.lugar === lugar);
    const itens = itensDe(lugar, dono);
    const linhas = [];
    const extras = [];
    for (const c of tipos) {
      const deste = itens.filter((i) => i.tipo === c.tipo);
      linhas.push(...deste.map((i) => linha(i, { comDono: lugar === 'projeto' })));
      if (!deste.length && exigido(c, dono)) {
        linhas.push(`<button type="button" class="cre-linha is-falta" data-cre="novo" data-tipo="${c.tipo}" data-dono="${esc(dono || '')}">
            <span class="cre-caixa is-mais" aria-hidden="true">+</span>
            <span class="cre-txt"><b>${esc(c.nome)}</b><small>Registrar</small></span>
            <span class="cre-etqs"><span class="ini-etq atencao">falta</span></span><span class="cre-acoes"></span></button>`);
      } else if (!deste.length || c.varios) {
        extras.push(`<button type="button" class="cre-mais" data-cre="novo" data-tipo="${c.tipo}" data-dono="${esc(dono || '')}">+ ${esc(deste.length ? 'Mais um: ' + c.nome : c.nome)}</button>`);
      }
    }
    return `<div class="cre-lista">${linhas.join('') || '<p class="cre-vazio">Nenhum documento registrado.</p>'}</div>
      ${extras.length ? `<div class="cre-extras">${extras.join('')}</div>` : ''}`;
  }

  // monta a lista num elemento de outra página (Empresa, Equipe)
  function montar(el, lugar, dono) {
    if (!el) return;
    const m = { el, lugar, dono };
    for (const x of [...montados]) if (x.el === el || !x.el.isConnected) montados.delete(x);
    montados.add(m);
    el.innerHTML = lista(lugar, dono);
    if (!el.dataset.creLigado) { el.addEventListener('click', aoClicar); el.dataset.creLigado = '1'; }
    carregar();
  }

  // ---- ações -----------------------------------------------------------------------

  async function abrirArquivo(arq, botao) {
    const janela = window.open('', '_blank');
    botao && (botao.disabled = true);
    try {
      const r = await apiBinario(`/api/v1/arquivos/${encodeURIComponent(arq)}/conteudo`);
      if (!r.ok) throw new Error(r.status);
      const url = URL.createObjectURL(await r.blob());
      if (janela) janela.location = url; else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      janela?.close();
      toque('Não foi possível abrir o arquivo');
    } finally { botao && (botao.disabled = false); }
  }

  function aoClicar(ev) {
    const b = ev.target.closest('[data-cre]');
    if (!b) {
      const r = ev.target.closest('[data-cre-recolher]');
      if (r) {
        const k = r.dataset.creRecolher;
        recolhidos.has(k) ? recolhidos.delete(k) : recolhidos.add(k);
        try { localStorage.setItem(RECOLHIDOS, JSON.stringify([...recolhidos])); } catch {}
        desenharPagina();
        pagina?.querySelector(`.bol-caixa[data-cre-recolher="${k}"]`)?.focus();
      }
      return;
    }
    ev.preventDefault();
    const acao = b.dataset.cre;
    if (acao === 'abrir-arquivo') return abrirArquivo(b.dataset.arq, b);
    if (acao === 'novo') return abrirGaveta({ modo: 'novo', tipo: b.dataset.tipo, dono: b.dataset.dono || null });
    const item = Q?.itens.find((i) => i.id === b.dataset.id);
    if (!item) return;
    if (acao === 'editar') return abrirGaveta({ modo: 'editar', item });
    if (acao === 'substituir') return abrirGaveta({ modo: 'substituir', item });
  }

  // a Início pede para abrir a substituição de um documento vencido
  function abrirPendente() {
    let p = null;
    try { p = JSON.parse(sessionStorage.getItem(PENDENTE) || 'null'); } catch {}
    if (!p?.id || !Q) return;
    const item = Q.itens.find((i) => i.id === p.id);
    sessionStorage.removeItem(PENDENTE);
    if (!item) { toque('Esse documento já foi substituído'); return; }
    document.querySelector(`[data-cre-id="${p.id}"]`)?.scrollIntoView({ block: 'center' });
    abrirGaveta({ modo: 'substituir', item });
  }

  // ---- Gaveta ----------------------------------------------------------------------

  function abrirGaveta(g) {
    const tipo = g.item?.tipo || g.tipo;
    const c = cat(tipo);
    if (!c) return;
    gav = { ...g, c, dono: g.item?.dono_id || g.dono || (c.dono === 'emp' ? EMPRESA : null), arquivo: null, confirmarArquivar: false };
    desenharGaveta();
    document.body.classList.add('acv-com-gaveta');
    document.querySelector('.cre-gaveta input:not([type="hidden"]), .cre-gaveta select')?.focus();
  }

  function fecharGaveta() {
    gav = null;
    document.getElementById('cre-gaveta')?.remove();
    document.body.classList.remove('acv-com-gaveta');
  }

  function desenharGaveta() {
    let caixa = document.getElementById('cre-gaveta');
    if (!caixa) {
      caixa = document.createElement('div');
      caixa.id = 'cre-gaveta';
      document.body.appendChild(caixa);
      caixa.addEventListener('click', aoClicarGaveta);
      caixa.addEventListener('change', aoMudarGaveta);
      caixa.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') fecharGaveta();
        if ((ev.ctrlKey || ev.metaKey) && ev.key === 's') { ev.preventDefault(); salvar(); }
      });
      caixa.addEventListener('submit', (ev) => { ev.preventDefault(); salvar(); });
    }
    const { modo, c, item } = gav;
    const base = modo === 'editar' ? item : {};
    const titulo = { novo: 'Registrar documento', editar: 'Editar documento', substituir: 'Substituir documento' }[modo];
    const vence = c.vence !== 'nao';
    const campo = (nome, rotulo, valor, tipo = 'text', extra = '') => `<label class="u-campo"><span>${rotulo}</span>${tipo === 'area'
      ? `<textarea name="${nome}" rows="3" ${extra}>${esc(valor || '')}</textarea>`
      : `<input type="${tipo}" name="${nome}" value="${esc(valor || '')}" ${extra}>`}</label>`;
    // de quem é: projeto escolhido aqui quando o documento é de projeto e ainda não tem dono
    const projetoSel = c.dono === 'prj' && modo === 'novo'
      ? `<label class="u-campo"><span>Projeto</span><select name="dono_id" required><option value="">—</option>
          ${(Q?.projetos || []).map((p) => `<option value="${esc(p.id)}"${p.id === gav.dono ? ' selected' : ''}>${esc(p.codigo)} ${esc(p.nome || '')}</option>`).join('')}</select></label>`
      : '';
    const deQuem = c.dono === 'eqp' ? pessoa(gav.dono)?.nome
      : c.dono === 'prj' && gav.dono ? (() => { const p = Q?.projetos.find((x) => x.id === gav.dono); return p ? `${p.codigo} ${p.nome || ''}` : ''; })()
      : 'Odisse';
    const aviso = modo === 'substituir'
      ? `<p class="cre-aviso">${item.vence_em ? `O anterior ${estado(item) === 'vencido' ? 'venceu' : 'vence'} em <b>${dataBr(item.vence_em)}</b>. ` : ''}Ao salvar, ele é arquivado e o novo passa a valer${estado(item) === 'vencido' ? '; o aviso da Início sai' : ''}.</p>`
      : modo === 'editar' && estado(item) === 'vencido'
        ? '<p class="cre-aviso">Documento vencido: a validade não se edita. Use <b>Substituir</b> para registrar o novo.</p>' : '';
    const arqAtual = modo === 'editar' && item.arquivo_id
      ? `<span class="cre-arq-atual">${SVG.arquivo}<span>${esc(item.arquivo_nome || 'arquivo')}</span>
          <button type="button" class="u-botao cre-mini" data-g="abrir-arquivo" data-arq="${esc(item.arquivo_id)}">Abrir</button></span>` : '';
    const venceTravado = modo === 'editar' && estado(item) === 'vencido';
    caixa.innerHTML = `<div class="acv-veu" data-g="fechar"></div>
      <aside class="acv-gaveta cre-gaveta" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <div class="acv-gaveta-cab"><b>${esc(titulo)}</b>
          <button type="button" class="cre-caixa" data-g="fechar" aria-label="Fechar">${SVG.fechar}</button></div>
        <form class="acv-gaveta-corpo" novalidate autocomplete="off">
          <section class="acv-bloco"><span class="u-rotulo">${esc(deQuem || '')}</span>
            <h3 class="u-subtitulo cre-g-nome">${esc(c.nome)}</h3>
            ${c.dica ? `<p class="u-apoio cre-dica">${esc(c.dica)}</p>` : ''}
            ${aviso}
          </section>
          <section class="acv-bloco">
            ${projetoSel}
            ${c.detalhe ? campo('titulo', c.detalhe, base.titulo ?? (modo === 'substituir' ? item.titulo : ''), 'text', 'maxlength="160"') : ''}
            <div class="acv-duas">
              ${campo('numero', 'Número', base.numero, 'text', 'maxlength="80"')}
              ${campo('emitido_em', 'Emitido em', base.emitido_em, 'date')}
            </div>
            ${vence ? `<div class="acv-duas">${campo('vence_em', c.vence === 'sim' ? 'Vence em' : 'Vence em (se tiver validade)', base.vence_em, 'date',
              `${c.vence === 'sim' ? 'required' : ''}${venceTravado ? ' readonly' : ''}${modo === 'substituir' ? ` min="${hoje()}"` : ''}`)}<span></span></div>` : ''}
          </section>
          <section class="acv-bloco"><h3 class="u-subtitulo">Arquivo</h3>
            ${arqAtual}
            <label class="u-botao eq-arquivo cre-enviar">${modo === 'editar' && item.arquivo_id ? 'Trocar arquivo' : 'Escolher arquivo'}
              <input type="file" name="arquivo" accept="application/pdf,image/*"></label>
            <small class="u-apoio cre-arq-nome" data-arq-nome>${gav.arquivo ? esc(gav.arquivo.name) : 'PDF ou imagem, até 95 MB. O original continua no Drive.'}</small>
          </section>
          <section class="acv-bloco">${campo('observacao', 'Observação', base.observacao, 'area', 'maxlength="1000"')}</section>
          <button type="submit" hidden></button>
        </form>
        <div class="acv-gaveta-pe"><span class="cre-g-msg" data-g-msg></span>
          <span class="cre-g-botoes">
            ${modo === 'editar' ? `<button type="button" class="u-botao perigo" data-g="arquivar">${gav.confirmarArquivar ? 'Confirmar: arquivar' : 'Arquivar'}</button>` : ''}
            <button type="button" class="u-botao" data-g="fechar">Cancelar</button>
            <button type="button" class="u-botao forte" data-g="salvar">${modo === 'substituir' ? 'Substituir' : 'Salvar'}</button>
          </span></div>
      </aside>`;
  }

  function aoMudarGaveta(ev) {
    if (ev.target.name === 'arquivo') {
      gav.arquivo = ev.target.files?.[0] || null;
      const n = document.querySelector('#cre-gaveta [data-arq-nome]');
      if (n && gav.arquivo) n.textContent = `${gav.arquivo.name} · ${(gav.arquivo.size / 1048576).toFixed(1).replace('.', ',')} MB`;
    }
  }

  function aoClicarGaveta(ev) {
    const b = ev.target.closest('[data-g]');
    if (!b) return;
    const g = b.dataset.g;
    if (g === 'fechar') return fecharGaveta();
    if (g === 'salvar') return salvar();
    if (g === 'abrir-arquivo') return abrirArquivo(b.dataset.arq, b);
    if (g === 'arquivar') {
      if (!gav.confirmarArquivar) { gav.confirmarArquivar = true; b.textContent = 'Confirmar: arquivar'; return; }
      return arquivar();
    }
  }

  const msg = (texto, erro = true) => {
    const el = document.querySelector('#cre-gaveta [data-g-msg]');
    if (el) { el.textContent = texto; el.classList.toggle('erro', erro); }
  };
  const ocupado = (sim) => document.querySelectorAll('#cre-gaveta .acv-gaveta-pe button').forEach((b) => { b.disabled = sim; });

  async function enviarArquivo(f) {
    const r = await api('/api/v1/arquivos', { method: 'POST', body: JSON.stringify({
      nome_original: f.name.slice(0, 200), tipo_mime: f.type || 'application/octet-stream', categoria: 'outro', tamanho: f.size, sha256: await sha256(f),
    }) });
    if (r.status >= 400) throw new Error(r.erro || r.status);
    const id = r.registro.id;
    const c = await apiBinario(`/api/v1/arquivos/${id}/conteudo`, { method: 'PUT', body: f, headers: { 'Content-Type': f.type || 'application/octet-stream' } });
    if (!c.ok) { const j = await c.json().catch(() => ({})); throw new Error(j.erro || c.status); }
    return id;
  }

  async function salvar() {
    const f = document.querySelector('#cre-gaveta form');
    if (!f || !gav) return;
    const { modo, c, item } = gav;
    const v = (k) => (f.elements[k] ? f.elements[k].value.trim() || null : undefined);
    const dados = { titulo: v('titulo'), numero: v('numero'), emitido_em: v('emitido_em'), vence_em: v('vence_em'), observacao: v('observacao') };
    for (const k of Object.keys(dados)) if (dados[k] === undefined) delete dados[k];
    const dono = c.dono === 'prj' && modo === 'novo' ? v('dono_id') : gav.dono;
    if (!dono) return msg('Escolha o projeto.');
    if (c.vence === 'sim' && !dados.vence_em && !(modo === 'editar' && estado(item) === 'vencido')) return msg('Informe até quando vale.');
    if (modo === 'substituir' && dados.vence_em && dados.vence_em <= hoje()) return msg('O documento novo já está vencido: confira a data.');
    ocupado(true); msg('Gravando…', false);
    try {
      if (gav.arquivo) dados.arquivo_id = await enviarArquivo(gav.arquivo);
      let r;
      if (modo === 'editar') {
        const corpo = { versao: item.versao };
        for (const [k, val] of Object.entries(dados)) if ((item[k] ?? null) !== val) corpo[k] = val;
        if (estado(item) === 'vencido') delete corpo.vence_em;
        r = await api(`/api/v1/credenciais/${item.id}`, { method: 'PATCH', body: JSON.stringify(corpo) });
      } else {
        r = await api('/api/v1/credenciais', { method: 'POST', body: JSON.stringify({
          ...dados, dono_id: dono, tipo: c.tipo, ...(modo === 'substituir' ? { substitui_id: item.id } : {}),
        }) });
      }
      if (r.status === 409 && r.erro === 'conflito') throw new Error('o documento mudou em outro lugar; feche e abra de novo');
      if (r.status >= 400) throw new Error(r.erro || r.status);
      fecharGaveta();
      toque(modo === 'substituir' ? 'Documento substituído' : 'Documento gravado');
      await carregar();
    } catch (e) {
      msg('Não gravou: ' + e.message);
      ocupado(false);
    }
  }

  async function arquivar() {
    const { item } = gav;
    ocupado(true);
    const r = await api(`/api/v1/credenciais/${item.id}/arquivar`, { method: 'POST', body: JSON.stringify({ versao: item.versao }) });
    if (r.status >= 400) { msg('Não arquivou: ' + (r.erro || r.status)); ocupado(false); return; }
    fecharGaveta();
    toque('Documento arquivado');
    await carregar();
  }

  // ---- página Credenciais ----------------------------------------------------------

  // pendências de um lugar e dono: vencidos, a vencer e faltando (exigidos sem registro)
  function pendencias(lugar, dono) {
    const tipos = Q.catalogo.filter((c) => c.lugar === lugar);
    const itens = itensDe(lugar, dono);
    const vencidos = itens.filter((i) => estado(i) === 'vencido');
    const vencem = itens.filter((i) => estado(i) === 'vence');
    const faltam = tipos.filter((c) => exigido(c, dono) && !itens.some((i) => i.tipo === c.tipo));
    const emDia = itens.length - vencidos.length - vencem.length;
    return { vencidos, vencem, faltam, emDia };
  }

  function contas() {
    const t = { vencidos: 0, vencem: 0, faltam: 0, emDia: 0 };
    const somar = (p) => { t.vencidos += p.vencidos.length; t.vencem += p.vencem.length; t.faltam += p.faltam.length; t.emDia += p.emDia; };
    for (const l of ['constituicao', 'sede', 'regularidade', 'economico', 'cadastros']) somar(pendencias(l, EMPRESA));
    for (const e of Q.equipe) somar(pendencias('equipe', e.id));
    somar(pendencias('projeto', null));
    return t;
  }

  function cabBloco(id, titulo, extra = '', link = null) {
    const aberto = !recolhidos.has(id);
    return `<div class="bol-cab">
        <button type="button" class="bol-titulo" data-cre-recolher="${id}" aria-expanded="${aberto}"><h2>${esc(titulo)}</h2>${extra}</button>
        ${link ? `<a class="bol-fonte" href="${esc(link[1])}">${esc(link[0])}<i>${SVG.ir}</i></a>` : ''}
        <button type="button" class="bol-caixa" data-cre-recolher="${id}" aria-label="${aberto ? 'Recolher' : 'Abrir'} ${esc(titulo)}">
          <span class="bol-seta${aberto ? ' aberta' : ''}" aria-hidden="true">${SVG.seta}</span></button>
      </div>`;
  }

  const contaTxt = (p) => {
    const n = p.vencidos.length + p.vencem.length + p.faltam.length;
    return `<span class="bol-conta">${n ? `${n} ${n === 1 ? 'pede' : 'pedem'} atenção` : 'tudo em dia'}</span>`;
  };

  function blocoLugar(lugar) {
    const id = 'l:' + lugar;
    const dono = lugar === 'projeto' ? null : EMPRESA;
    const nome = Q.lugares[lugar].nome;
    return `<section class="bol-bloco cre-bloco${recolhidos.has(id) ? ' fechado' : ''}">
        ${cabBloco(id, nome, contaTxt(pendencias(lugar, dono)))}
        ${recolhidos.has(id) ? '' : `<div class="cre-corpo">${lista(lugar, dono)}</div>`}
      </section>`;
  }

  // nas outras páginas: só o que pede atenção, com o caminho até lá
  function linhaPendente(i, extra = '') {
    const c = cat(i.tipo);
    return `<div class="cre-linha is-leitura"><span class="cre-txt"><b>${esc(c?.nome || i.tipo)}</b>${extra || i.titulo ? `<small>${esc(extra || i.titulo)}</small>` : ''}</span>
      <span class="cre-etqs">${etiquetaValidade(i)}</span><span class="cre-acoes">
      <button type="button" class="u-botao cre-mini${estado(i) === 'vencido' ? ' cre-urgente' : ''}" data-cre="substituir" data-id="${esc(i.id)}">${SVG.trocar}Substituir</button></span></div>`;
  }
  const linhaFalta = (c, dono) => `<button type="button" class="cre-linha is-falta" data-cre="novo" data-tipo="${c.tipo}" data-dono="${esc(dono)}">
      <span class="cre-caixa is-mais" aria-hidden="true">+</span><span class="cre-txt"><b>${esc(c.nome)}</b><small>Registrar</small></span>
      <span class="cre-etqs"><span class="ini-etq atencao">falta</span></span><span class="cre-acoes"></span></button>`;
  const pendentesHtml = (p, dono) => [...p.vencidos.map((i) => linhaPendente(i)), ...p.vencem.map((i) => linhaPendente(i)),
    ...p.faltam.map((c) => linhaFalta(c, dono))].join('');
  const emDiaTxt = (p) => `<p class="cre-emdia">${p.emDia ? `${p.emDia} ${p.emDia === 1 ? 'documento em dia' : 'documentos em dia'}` : 'Nenhum documento em dia ainda'}</p>`;

  function blocoEmpresa() {
    const id = 'o:empresa';
    const ps = ['constituicao', 'sede'].map((l) => [l, pendencias(l, EMPRESA)]);
    const tudo = { vencidos: [], vencem: [], faltam: [], emDia: 0 };
    for (const [, p] of ps) { tudo.vencidos.push(...p.vencidos); tudo.vencem.push(...p.vencem); tudo.faltam.push(...p.faltam); tudo.emDia += p.emDia; }
    const corpo = ps.map(([l, p]) => {
      const h = pendentesHtml(p, EMPRESA);
      return h ? `<div class="bol-sub">${esc(Q.lugares[l].nome)}</div><div class="cre-lista">${h}</div>` : '';
    }).join('');
    return `<section class="bol-bloco cre-bloco${recolhidos.has(id) ? ' fechado' : ''}">
        ${cabBloco(id, 'Empresa', contaTxt(tudo), ['Abrir Empresa', '#/empresa'])}
        ${recolhidos.has(id) ? '' : `<div class="cre-corpo">${corpo}${emDiaTxt(tudo)}</div>`}
      </section>`;
  }

  function blocoEquipe() {
    const id = 'o:equipe';
    const tudo = { vencidos: [], vencem: [], faltam: [], emDia: 0 };
    const corpo = Q.equipe.map((e) => {
      const p = pendencias('equipe', e.id);
      tudo.vencidos.push(...p.vencidos); tudo.vencem.push(...p.vencem); tudo.faltam.push(...p.faltam); tudo.emDia += p.emDia;
      const h = pendentesHtml(p, e.id);
      return `<a class="bol-sub cre-sub-link" href="#/equipe/${esc(e.id)}">${esc(e.nome)}<span>${h ? '' : 'em dia · '}abrir a ficha${SVG.ir}</span></a>
        ${h ? `<div class="cre-lista">${h}</div>` : ''}`;
    }).join('');
    return `<section class="bol-bloco cre-bloco${recolhidos.has(id) ? ' fechado' : ''}">
        ${cabBloco(id, 'Equipe', contaTxt(tudo), ['Abrir Equipe', '#/equipe'])}
        ${recolhidos.has(id) ? '' : `<div class="cre-corpo">${corpo || '<p class="cre-vazio">Ninguém ativo na equipe.</p>'}${emDiaTxt(tudo)}</div>`}
      </section>`;
  }

  function desenharPagina() {
    if (!pagina?.isConnected) return;
    const lado = Q?.hoje ? `Hoje, ${dataBr(Q.hoje)}` : '';
    const cab = `<div class="cab"><h1 class="u-titulo">Credenciais</h1>${lado ? `<div class="lado u-apoio">${esc(lado)}</div>` : ''}</div>`;
    if (!Q) { pagina.innerHTML = cab + '<p class="u-apoio cre-carregando">Carregando…</p>'; return; }
    const t = contas();
    const y = window.scrollY;
    pagina.innerHTML = cab + `
      ${numeros([
        { rotulo: 'Vencidos', valor: t.vencidos, apoio: t.vencidos ? 'substitua para o aviso sair' : 'nenhum', tom: t.vencidos ? 'problema' : '' },
        { rotulo: 'Vencem em breve', valor: t.vencem, apoio: `nos próximos ${Q.aviso_dias} dias` },
        { rotulo: 'Faltando', valor: t.faltam, apoio: 'exigidos e não registrados' },
        { rotulo: 'Em dia', valor: t.emDia, apoio: 'válidos ou sem validade' },
      ], { estatico: true })}
      <section class="cre-sec">
        <h2 class="cre-sec__titulo">Aqui</h2>
        <div class="blocos-fluxo cre-fluxo">${['regularidade', 'economico', 'cadastros', 'projeto'].map(blocoLugar).join('')}</div>
      </section>
      <section class="cre-sec">
        <h2 class="cre-sec__titulo">Nas outras páginas</h2>
        <div class="blocos-fluxo cre-fluxo">${blocoEmpresa()}${blocoEquipe()}</div>
      </section>
      <section class="pas-notas">
        <div><h3 class="u-rotulo">Onde mora cada documento</h3>
          <p><b>Empresa</b>: constituição e registros (contrato social, CNPJ, inscrições, CAU da PJ) e a sede (alvará, comprovante).
          <b>Equipe</b>: o registro no conselho, as CATs, diplomas, currículo, vínculo, procuração e identidade, na ficha de cada pessoa.
          <b>Aqui</b>: o que é da empresa mas vence ou depende de fora (certidões, balanço, cadastros) e, por ora, os atestados e RRTs dos projetos.</p>
          <p>Declarações de cada edital (art. 63, equipe técnica, visita) saem da Emissão de documentos avulsos; inscrição e anonimato de concurso ficam no <code>00-adm</code> do projeto.</p></div>
        <div><h3 class="u-rotulo">Validade e aviso</h3>
          <p>Documento com validade mostra até quando vale; a partir de ${Q.aviso_dias} dias antes, aparece como “vence em”. <b>Vencido, ele avisa na Início</b>, e o aviso só sai quando o documento é substituído (ou arquivado, se deixou de ser preciso).</p>
          <p>Substituir registra o novo e arquiva o anterior. A validade de um documento vencido não se edita.</p></div>
        <div><h3 class="u-rotulo">Faltando</h3>
          <p>Conta só os documentos que todo edital costuma pedir. Na equipe, só para quem tem registro no conselho. Opcionais e “mais um” (CAT, balanço de outro exercício, outro portal) ficam nas etiquetas tracejadas do fim de cada lista.</p>
          <p>Senhas de portais nunca entram no Universo: registre só que a conta existe.</p></div>
      </section>`;
    window.scrollTo(0, y);
  }

  function ligar(raiz) {
    pagina = raiz;
    raiz.addEventListener('click', aoClicar);
    desenharPagina();
    carregar();
  }

  return { ligar, montar, carregar, lerQuadro: () => Q };
}

// a Início guarda o pedido e leva à página onde o documento mora
export function pedirSubstituicao(id) {
  try { sessionStorage.setItem(PENDENTE, JSON.stringify({ id })); } catch {}
}
