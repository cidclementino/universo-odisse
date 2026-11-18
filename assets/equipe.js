// Página Equipe do hub (#/equipe): o cadastro comum da equipe, lido por todas as ferramentas (seletor de quem
// assina, banco de horas, responsáveis, site). Dados em /api/v1/equipe/… (worker/dados/equipe.js).
//
// Rotas: #/equipe (lista, cargos e títulos) · #/equipe/nova · #/equipe/<eqp_…> (ficha da pessoa)
//
// Rubrica (as iniciais, não uma assinatura formal): guardada à parte (arquivo protegido; na API, "assinatura").
// Sai abaixo da identificação (nome; cargo · registro), sem mudar o bloco da folha. Aqui aparece só para
// conferência; nos documentos, a prévia mostra a caixa do lugar dela e o PNG entra só na emissão.

import { lerCopia, gravarCopia, apagarCopia, igual, imagemGuardada } from './memoria.js';

const SITE = 'https://www.odisse.com.br/images/equipe/';
const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const dataBr = (d) => (d ? d.split('-').reverse().join('/') : '');
const USOS = [
  ['proposta', 'Propostas', 'Assina as propostas de honorários.'],
  ['contrato', 'Contratos', 'Representante legal: só sócios.'],
  ['documento', 'Documentos', 'Cartas, ofícios, declarações e memorandos.'],
  ['rrt', 'RRT', 'Responsável técnico: exige conselho e registro.'],
];
const CONSELHOS = { cau: 'CAU', crea: 'CREA', abd: 'ABD' };
const forma = (item, t) => (item ? (t === 'f' ? item.nome_f : item.nome_m) : '');
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---- imagens (mesmo sistema do odisse.com.br: WebP 0,82 ou JPEG 0,86; 2400 / 1200 / 960 pelo lado maior)
async function reduzir(bmp, max) {
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  let blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', 0.82));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.86));
  return { blob, w, h };
}
const sha256 = async (blob) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))]
  .map((b) => b.toString(16).padStart(2, '0')).join('');

// Assinatura: aceita PNG com transparência ou foto/digitalização com fundo claro (o fundo vira transparente);
// apara as margens e limita a 1600 px.
async function prepararAssinatura(arquivo) {
  const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let transparente = false;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) { transparente = true; break; }
  if (!transparente) {
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i + 3] = lum >= 225 ? 0 : lum > 170 ? Math.round(((225 - lum) / 55) * 255) : 255;
    }
  }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error('não encontrei traço na imagem');
  ctx.putImageData(img, 0, 0);
  const m = 8;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  const blob = await new Promise((ok) => out.toBlob(ok, 'image/png'));
  return { blob, w: out.width, h: out.height, fundoTirado: !transparente };
}

// Enquadramento da foto: recorte quadrado com zoom e arraste (o círculo mostra o recorte dos cartões).
// Devolve um canvas quadrado na resolução da foto (até 2400 px de lado) ou null se cancelar.
function enquadrar(bmp) {
  return new Promise((ok) => {
    const L = 360, W = bmp.width, H = bmp.height, menor = Math.min(W, H);
    const d = document.createElement('dialog');
    d.className = 'eq-dialogo';
    d.innerHTML = `<form method="dialog" class="dialogo-logo">
        <div class="dl-cab"><div><span class="u-rotulo">Foto</span><h2 class="u-subtitulo">Enquadrar</h2></div></div>
        <div class="eq-enq"><canvas width="${L * 2}" height="${L * 2}"></canvas><span class="eq-enq-guia"></span></div>
        <div class="eq-enq-ctl"><label>Zoom <input type="range" min="1" max="4" step="0.01" value="1" data-zoom aria-label="Zoom"></label>
          <button type="button" class="u-botao" data-centro>Centralizar</button></div>
        <p class="u-apoio">Arraste para posicionar; roda do mouse para o zoom; setas para ajuste fino.</p>
        <div class="dl-acoes"><button class="u-botao" value="nao">Cancelar</button><button class="u-botao forte" value="sim">Usar este enquadramento</button></div>
      </form>`;
    document.body.appendChild(d);
    const cv = d.querySelector('canvas'), ctx = cv.getContext('2d'), zoom = d.querySelector('[data-zoom]');
    let z = 1, cx = W / 2, cy = H / 2;
    const lado = () => menor / z;
    const prender = () => { const h = lado() / 2; cx = Math.min(W - h, Math.max(h, cx)); cy = Math.min(H - h, Math.max(h, cy)); };
    const desenhar = () => {
      prender();
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(bmp, cx - lado() / 2, cy - lado() / 2, lado(), lado(), 0, 0, cv.width, cv.height);
    };
    const zoomPara = (nz) => { z = Math.min(4, Math.max(1, nz)); zoom.value = z; desenhar(); };
    zoom.addEventListener('input', () => zoomPara(Number(zoom.value)));
    d.querySelector('[data-centro]').addEventListener('click', () => { cx = W / 2; cy = H / 2; zoomPara(1); });
    const area = d.querySelector('.eq-enq');
    let arraste = null;
    area.addEventListener('pointerdown', (ev) => { arraste = { x: ev.clientX, y: ev.clientY, cx, cy }; area.setPointerCapture(ev.pointerId); });
    area.addEventListener('pointermove', (ev) => {
      if (!arraste) return;
      const k = lado() / area.clientWidth;
      cx = arraste.cx - (ev.clientX - arraste.x) * k; cy = arraste.cy - (ev.clientY - arraste.y) * k; desenhar();
    });
    area.addEventListener('pointerup', () => { arraste = null; });
    area.addEventListener('wheel', (ev) => { ev.preventDefault(); zoomPara(z * (ev.deltaY < 0 ? 1.06 : 1 / 1.06)); }, { passive: false });
    d.addEventListener('keydown', (ev) => {
      const passo = lado() / 60, mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
      if (!mv || ev.target === zoom) return;
      ev.preventDefault(); cx += mv[0] * passo; cy += mv[1] * passo; desenhar();
    });
    d.addEventListener('close', () => {
      let out = null;
      if (d.returnValue === 'sim') {
        prender();
        const n = Math.min(2400, Math.round(lado()));
        out = document.createElement('canvas'); out.width = n; out.height = n;
        const c2 = out.getContext('2d'); c2.imageSmoothingQuality = 'high';
        c2.drawImage(bmp, cx - lado() / 2, cy - lado() / 2, lado(), lado(), 0, 0, n, n);
      }
      d.remove(); ok(out);
    });
    desenhar();
    d.showModal();
  });
}

export function criarEquipe({ esc, api, apiBinario, toque }) {
  let avisoSaida = () => false;
  window.addEventListener('beforeunload', (ev) => { if (avisoSaida()) { ev.preventDefault(); ev.returnValue = ''; } });
  const rubricas = new Map(); // assinatura_id → objectURL (só nesta sessão: arquivo protegido não vai para o disco)

  // foto: guardada no navegador pelo id do arquivo (trocar a foto = id novo), lida da API só uma vez
  const fotoUrl = (p, variante = 's') => (!p.foto_id ? Promise.resolve(null)
    : imagemGuardada(`foto-${p.foto_id}-${variante}`, () => apiBinario(`/api/v1/equipe/${p.id}/foto?variante=${variante}`)));
  const preencherFotos = (raiz, pessoas) => raiz.querySelectorAll('[data-foto]').forEach(async (el) => {
    const p = pessoas.find((x) => x.id === el.dataset.foto);
    const u = p && (await fotoUrl(p, el.dataset.variante || 's'));
    if (u) el.style.backgroundImage = `url("${u}")`;
  });
  const iniciais = (nome) => String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  const linhaTitulo = (p) => [p.titulo, p.registro_formatado].filter(Boolean).join(' · ');
  const trilha = (...itens) => `<nav class="u-trilha" aria-label="Caminho">${itens.map(([nome, href]) =>
    href ? `<a href="${href}">${esc(nome)}</a>` : `<span aria-current="page">${esc(nome)}</span>`).join('<span class="sep" aria-hidden="true">/</span>')}</nav>`;

  // ---- lista -----------------------------------------------------------------
  async function lista(raiz) {
    avisoSaida = () => false;
    const copia = lerCopia('equipe:quadro');
    if (copia) desenharLista(raiz, copia); else raiz.innerHTML = '<p class="u-apoio">Carregando…</p>';
    const q = await api('/api/v1/equipe/quadro?todos=1');
    if (q.status !== 200) { if (!copia) raiz.innerHTML = `<p class="u-apoio">Não foi possível ler a equipe (${esc(q.erro || q.status)}).</p>`; return; }
    const novo = { itens: q.itens, cargos: q.cargos, titulos: q.titulos };
    gravarCopia('equipe:quadro', novo);
    if (!raiz.isConnected || (copia && igual(copia, novo))) return;
    if (copia && raiz.contains(document.activeElement) && document.activeElement.matches('input')) return; // editando uma lista
    desenharLista(raiz, novo);
  }

  function desenharLista(raiz, q) {
    const ativos = q.itens.filter((p) => p.ativo), inativos = q.itens.filter((p) => !p.ativo);
    const cartao = (p) => {
      const marcas = [p.socio ? '<span class="socio">Sócio</span>' : '', p.publico ? '<span>No site</span>' : '',
        p.ativo ? '' : `<span>Desligado${p.ate ? ' em ' + esc(dataBr(p.ate)) : ''}</span>`].filter(Boolean).join('');
      return `<a class="u-cartao eq-pessoa${p.ativo ? '' : ' inativa'}" href="#/equipe/${esc(p.id)}">
        <span class="eq-foto" data-foto="${esc(p.id)}">${p.foto_id ? '' : `<i>${esc(iniciais(p.nome))}</i>`}</span>
        <span class="eq-dados"><b>${esc(p.nome)}</b>
          <span class="eq-cargo">${esc(p.cargo || 'Sem cargo')}</span>
          ${linhaTitulo(p) ? `<span class="eq-reg">${esc(linhaTitulo(p))}</span>` : ''}
          ${marcas ? `<span class="eq-marcas">${marcas}</span>` : ''}</span></a>`;
    };
    raiz.innerHTML = `<div class="cab"><div><h1 class="u-titulo">Equipe</h1></div>
        <div class="acoes-cab"><a class="u-botao" href="#/equipe/cargos">Cargos e títulos</a>
          <a class="u-botao forte" href="#/equipe/nova">+ Pessoa</a></div></div>
      <section class="bloco"><span class="u-rotulo">Na equipe</span>
        <div class="eq-grade">${ativos.map(cartao).join('') || '<p class="u-apoio">Ninguém ainda.</p>'}</div></section>
      ${inativos.length ? `<section class="bloco"><span class="u-rotulo">Já passaram pela equipe</span>
        <div class="eq-grade">${inativos.map(cartao).join('')}</div></section>` : ''}`;
    preencherFotos(raiz, q.itens);
  }

  // ---- cargos e títulos (subpágina #/equipe/cargos) ------------------------------
  async function cargosTitulos(raiz) {
    avisoSaida = () => false;
    const desenhar = (q) => {
      raiz.innerHTML = `<div class="cab"><div>${trilha(['Equipe', '#/equipe'], ['Cargos e títulos'])}<h1 class="u-titulo">Cargos e títulos</h1>
          <p class="u-apoio">Na ficha aparece só a forma masculina; o sexo da pessoa escolhe a forma. A inglesa vai para o site em inglês.
          Mudar aqui muda em todo lugar que mostra o cargo.</p></div></div>
        <section class="bloco"><div class="duas eq-listas"><div data-lista="cargos"></div><div data-lista="titulos"></div></div></section>`;
      listaEditavel(raiz.querySelector('[data-lista="cargos"]'), 'cargos', 'Cargos', q.cargos);
      listaEditavel(raiz.querySelector('[data-lista="titulos"]'), 'titulos', 'Títulos profissionais', q.titulos);
    };
    const copia = lerCopia('equipe:quadro');
    if (copia) desenhar(copia); else raiz.innerHTML = '<p class="u-apoio">Carregando…</p>';
    const q = await api('/api/v1/equipe/quadro?todos=1');
    if (q.status !== 200) { if (!copia) raiz.innerHTML = `<p class="u-apoio">Não foi possível ler as listas (${esc(q.erro || q.status)}).</p>`; return; }
    const novo = { itens: q.itens, cargos: q.cargos, titulos: q.titulos };
    gravarCopia('equipe:quadro', novo);
    if (!raiz.isConnected || (copia && igual({ c: copia.cargos, t: copia.titulos }, { c: novo.cargos, t: novo.titulos }))) return;
    if (copia && raiz.contains(document.activeElement) && document.activeElement.matches('input')) return;
    desenhar(novo);
  }

  // Lista de cargos ou títulos: cada linha grava ao sair do campo.
  function listaEditavel(caixa, rota, nome, itens) {
    const linha = (c) => `<tr data-id="${esc(c.id)}" data-versao="${c.versao}">
        <td><input data-k="nome_m" value="${esc(c.nome_m)}" aria-label="Masculino"></td>
        <td><input data-k="nome_f" value="${esc(c.nome_f)}" aria-label="Feminino"></td>
        <td><input data-k="nome_en" value="${esc(c.nome_en || '')}" aria-label="Inglês"></td>
        <td class="eq-tirar"><button type="button" class="u-botao" data-tirar title="Tirar da lista">×</button></td></tr>`;
    caixa.innerHTML = `<h3 class="eq-h3">${esc(nome)}</h3>
      <table class="u-tabela eq-tabela"><thead><tr><th>Masculino</th><th>Feminino</th><th>Inglês</th><th></th></tr></thead>
        <tbody>${itens.map(linha).join('')}</tbody></table>
      <form class="eq-nova-linha" data-nova><input name="nome_m" placeholder="Masculino" required><input name="nome_f" placeholder="Feminino" required>
        <input name="nome_en" placeholder="Inglês"><button class="u-botao" type="submit">+ Acrescentar</button></form>`;
    caixa.addEventListener('change', async (ev) => {
      const tr = ev.target.closest('tr[data-id]');
      if (!tr) return;
      const r = await api(`/api/v1/${rota}/${tr.dataset.id}`, { method: 'PATCH',
        body: JSON.stringify({ versao: Number(tr.dataset.versao), [ev.target.dataset.k]: ev.target.value }) });
      if (r.status >= 400) { toque('Não foi possível salvar: ' + (r.erro || r.status)); return; }
      tr.dataset.versao = r.registro.versao;
      apagarCopia('equipe:quadro');
      toque('Salvo');
    });
    caixa.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-tirar]');
      if (!b) return;
      const tr = b.closest('tr');
      if (!confirm('Tirar esta opção da lista? Quem já tem este item continua com ele até trocar.')) return;
      const r = await api(`/api/v1/${rota}/${tr.dataset.id}/arquivar`, { method: 'POST', body: JSON.stringify({ versao: Number(tr.dataset.versao) }) });
      if (r.status >= 400) { toque('Não foi possível tirar: ' + (r.erro || r.status)); return; }
      tr.remove();
      apagarCopia('equipe:quadro');
    });
    caixa.querySelector('[data-nova]').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const corpo = { nome_m: f.nome_m.value, nome_f: f.nome_f.value, nome_en: f.nome_en.value || null, ordem: (itens.length + 1) * 10 };
      const r = await api(`/api/v1/${rota}`, { method: 'POST', body: JSON.stringify(corpo) });
      if (r.status >= 400) { toque('Não foi possível acrescentar: ' + (r.erro || r.status)); return; }
      itens.push(r.registro);
      caixa.querySelector('tbody').insertAdjacentHTML('beforeend', linha(r.registro));
      apagarCopia('equipe:quadro');
      f.reset();
    });
  }

  // ---- pessoa nova -------------------------------------------------------------
  function nova(raiz) {
    avisoSaida = () => false;
    raiz.innerHTML = `<div class="cab"><div>${trilha(['Equipe', '#/equipe'], ['Pessoa nova'])}<h1 class="u-titulo">Pessoa nova</h1>
        <p class="u-apoio">Se a pessoa já estiver nos Contatos (mesmo nome ou e-mail), o cadastro dela é aproveitado.
        O resto (cargo, registro, foto, rubrica) se preenche na ficha.</p></div></div>
      <form class="u-cartao eq-form-nova">
        <label class="u-campo"><span>Nome</span><input name="nome" required autofocus></label>
        <label class="u-campo"><span>E-mail</span><input name="email" type="email"></label>
        <button class="u-botao forte" type="submit">Acrescentar à equipe</button></form>`;
    raiz.querySelector('form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      f.querySelector('button').disabled = true;
      const r = await api('/api/v1/producao/equipe', { method: 'POST',
        body: JSON.stringify({ nome: f.nome.value, email: f.email.value || null, papel: 'colaborador' }) });
      f.querySelector('button').disabled = false;
      if (r.status >= 400) { toque('Não foi possível acrescentar: ' + (r.erro || r.status)); return; }
      if (r.ja_estava) toque('Essa pessoa já está na equipe.');
      apagarCopia('equipe:quadro');
      location.hash = '#/equipe/' + r.registro.id;
    });
  }

  // ---- ficha -------------------------------------------------------------------
  // Abre na hora com a última cópia guardada e confere por baixo; só redesenha se algo mudou e não há edição em curso.
  async function lerFicha(id) {
    const [q, rEq] = await Promise.all([api('/api/v1/equipe/quadro?todos=1'), api('/api/v1/equipe/' + id)]);
    if (q.status !== 200 || rEq.status !== 200) return { erro: rEq.erro || q.erro || rEq.status };
    const rPes = await api('/api/v1/pessoas/' + rEq.registro.pessoa_id);
    gravarCopia('equipe:quadro', { itens: q.itens, cargos: q.cargos, titulos: q.titulos });
    return { reg: rEq.registro, pes: rPes.registro || null, p: q.itens.find((x) => x.id === id), cargos: q.cargos, titulos: q.titulos };
  }

  async function ficha(raiz, id) {
    const chave = 'equipe:ficha:' + id;
    const copia = lerCopia(chave);
    if (copia) montarFicha(raiz, id, copia); else raiz.innerHTML = '<p class="u-apoio">Carregando…</p>';
    const d = await lerFicha(id);
    if (d.erro) { if (!copia) raiz.innerHTML = `<p class="u-apoio">Pessoa não encontrada (${esc(d.erro)}).</p>`; return; }
    gravarCopia(chave, d);
    if (!raiz.isConnected || location.hash !== '#/equipe/' + id) return;
    if (copia && igual(copia, d)) return;
    if (copia && avisoSaida()) { toque('Esta ficha mudou em outro lugar. Salve ou recarregue para ver.'); return; }
    montarFicha(raiz, id, d);
  }

  function montarFicha(raiz, id, dados) {
    let { reg, p } = dados;                       // linha da equipe (com versao e custo por hora) e a pessoa montada
    let pes = dados.pes || { nome: p?.nome || '', email: p?.email || '' };
    const temPes = !!dados.pes;
    const { cargos, titulos } = dados;
    const chave = 'equipe:ficha:' + id;
    let sujo = false;
    const ativo = !!reg.ativo;

    // na lista aparece só a forma masculina; o sexo da pessoa escolhe a forma no resto do Universo
    const opcoes = (lista, atual) => `<option value="">—</option>` + lista.map((c) =>
      `<option value="${esc(c.id)}"${c.id === atual ? ' selected' : ''}>${esc(c.nome_m)}</option>`).join('');
    const chk = (nome, v, texto) => `<label class="eq-check"><input type="checkbox" name="${nome}"${v ? ' checked' : ''}> ${texto}</label>`;
    const assina = (reg.assina || '').split(',').filter(Boolean);

    raiz.innerHTML = `<div class="cab"><div>${trilha(['Equipe', '#/equipe'], ['Ficha'])}
        <h1 class="u-titulo">${esc(pes.nome)}</h1><p class="u-apoio" data-resumo></p></div>
        ${ativo ? '' : `<div class="acoes-cab"><span class="chip">desligado${reg.ate ? ' em ' + esc(dataBr(reg.ate)) : ''}</span></div>`}</div>
      <form class="eq-ficha" autocomplete="off">
        <section class="u-cartao eq-sec"><h2 class="u-subtitulo">Pessoa, cargo e registro</h2>
          <div class="eq-tres">
            <div class="eq-foto-grande"><span class="eq-foto g" data-foto="${esc(id)}" data-variante="m">${reg.foto_id ? '' : `<i>${esc(iniciais(pes.nome))}</i>`}</span>
              <div class="eq-assin-acoes"><label class="u-botao eq-arquivo">${reg.foto_id ? 'Trocar foto' : 'Enviar foto'}<input type="file" accept="image/*" data-arquivo="foto"></label>
              ${reg.foto_id ? '<button type="button" class="u-botao" data-acao="enquadrar">Enquadrar</button>' : ''}
              ${reg.foto_id ? '' : `<button type="button" class="u-botao" data-acao="foto-site">Trazer do site</button>`}</div>
              <small class="u-apoio">Ao enviar, você enquadra a foto (zoom e posição). Vai para o acervo, nos três tamanhos do site.</small></div>
            <div class="eq-col">
              <label class="u-campo"><span>Nome</span><input name="nome" value="${esc(pes.nome)}" required></label>
              <label class="u-campo"><span>E-mail</span><input name="email" type="email" value="${esc(pes.email || '')}"></label>
              <div class="u-campo"><span>Sexo</span><div class="eq-radios">
                <label><input type="radio" name="tratamento" value="m"${reg.tratamento !== 'f' ? ' checked' : ''}> Masculino</label>
                <label><input type="radio" name="tratamento" value="f"${reg.tratamento === 'f' ? ' checked' : ''}> Feminino</label></div></div>
              <div class="u-campo"><span>Sociedade</span>${chk('socio', reg.socio, 'Sócio(a) do Odisse')}</div>
            </div>
            <div class="eq-col">
              <label class="u-campo"><span>Cargo</span><select name="cargo_id">${opcoes(cargos, reg.cargo_id)}</select></label>
              <label class="u-campo"><span>Título profissional</span><select name="titulo_id">${opcoes(titulos, reg.titulo_id)}</select></label>
              <div class="eq-registro">
                <label class="u-campo"><span>Conselho</span><select name="conselho"><option value="">—</option>
                  ${Object.entries(CONSELHOS).map(([k, v]) => `<option value="${k}"${reg.conselho === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
                <label class="u-campo"><span>UF</span><select name="registro_uf"><option value="">—</option>
                  ${UFS.map((u) => `<option${reg.registro_uf === u ? ' selected' : ''}>${u}</option>`).join('')}</select></label>
                <label class="u-campo"><span>Número de registro</span><input name="registro" value="${esc(reg.registro || '')}" placeholder="A123456-7"></label>
              </div>
              <small class="u-apoio">Cargos e títulos se editam na lista da página Equipe.</small>
            </div>
          </div></section>

        <section class="u-cartao eq-sec"><h2 class="u-subtitulo">Assinatura</h2>
          <div class="eq-tres">
            <div class="u-campo"><span>Pode assinar</span>${USOS.map(([k, n, ajuda]) =>
              `<label class="eq-check"><input type="checkbox" name="assina" value="${k}"${assina.includes(k) ? ' checked' : ''}> ${n} <small>${ajuda}</small></label>`).join('')}</div>
            <div class="eq-col">
              <label class="u-campo"><span>Nome na assinatura</span><input name="nome_assinatura" value="${esc(reg.nome_assinatura || '')}" placeholder="${esc(pes.nome)}">
                <small>Vazio = o nome da pessoa.</small></label>
              <div class="u-campo"><span>Rubrica (iniciais)</span>
                <div class="eq-assin-acoes"><label class="u-botao eq-arquivo">${reg.assinatura_id ? 'Trocar rubrica' : 'Enviar rubrica'}<input type="file" accept="image/png,image/jpeg,image/webp" data-arquivo="assinatura"></label>
                  ${reg.assinatura_id ? '<button type="button" class="u-botao perigo" data-acao="tirar-assinatura">Tirar</button>' : ''}</div>
                <small>Sai abaixo da identificação. PNG com fundo transparente, ou foto/digitalização em papel branco (o fundo é tirado aqui).
                Fica guardada à parte e só entra no PDF na hora de emitir; cada uso fica registrado.</small></div>
            </div>
            <div><span class="u-rotulo">Como sai no documento</span>
              <div class="eq-folha"><div data-bloco></div></div>
              <div class="eq-alterna"><label><input type="radio" name="vista-assin" value="emitido" checked> Emitido</label>
                <label><input type="radio" name="vista-assin" value="previa"> Prévia (caixa)</label></div></div>
          </div></section>

        <section class="u-cartao eq-sec"><h2 class="u-subtitulo">Site</h2>
          <div class="eq-tres">
            <div class="u-campo">${chk('publico', reg.publico, 'Aparece na página Sobre do site')}
              <small>Quem aparece entra em ordem aleatória a cada visita.</small></div>
            <label class="u-campo"><span>Bio <span class="lingua">PT</span></span><textarea name="bio_pt" rows="7" maxlength="2000">${esc(reg.bio_pt || '')}</textarea></label>
            <label class="u-campo"><span>Bio <span class="lingua en">EN</span></span><textarea name="bio_en" rows="7" maxlength="2000">${esc(reg.bio_en || '')}</textarea>
              <small>Vazia = no site em inglês a pessoa aparece sem bio (em vez do texto em português).</small></label>
          </div></section>

        <section class="u-cartao eq-sec"><h2 class="u-subtitulo">Vínculo e custo</h2>
          <div class="eq-tres">
            <label class="u-campo"><span>Custo por hora (R$)</span><input name="custo_hora" inputmode="decimal" value="${reg.custo_hora != null ? (reg.custo_hora / 100).toFixed(2).replace('.', ',') : ''}">
              <small>Só sócios. Não aparece para o vendas, os fornecedores nem o marketing.</small></label>
            <label class="u-campo"><span>Na equipe desde</span><input type="date" name="desde" value="${esc(reg.desde || '')}"></label>
            <label class="u-campo"><span>Até</span><input type="date" name="ate" value="${esc(reg.ate || '')}"${ativo ? '' : ' readonly'}>
              <small>${ativo ? 'Preenchida ao desligar.' : 'Data do desligamento.'}</small></label>
          </div>
          <div class="eq-vinculo">${ativo
            ? `<button type="button" class="u-botao forte" data-acao="desligar">Desligar da equipe</button>
               <small class="u-apoio">Preenche “Até” com hoje (ou a data já escrita) e tira a pessoa dos seletores e do banco de horas.
               Horas e documentos antigos continuam com o nome.</small>`
            : `<button type="button" class="u-botao" data-acao="religar">Trazer de volta à equipe</button>
               <small class="u-apoio">Volta para os seletores e o banco de horas; a data de saída é apagada.</small>`}</div></section>

        <div class="barra-salvar"><span class="u-apoio" data-estado></span><button class="u-botao forte" type="submit">Salvar</button></div>
      </form>`;

    const form = raiz.querySelector('form');
    const estado = raiz.querySelector('[data-estado]');
    preencherFotos(raiz, [{ ...(p || {}), id, foto_id: reg.foto_id }]);
    const esquecer = () => { apagarCopia(chave); apagarCopia('equipe:quadro'); };

    // ---- bloco de assinatura (como sai no documento)
    let assinUrl = null;
    const caixaBloco = raiz.querySelector('[data-bloco]');
    const atual = () => {
      const f = new FormData(form);
      const t = f.get('tratamento');
      const cargo = forma(cargos.find((c) => c.id === f.get('cargo_id')), t);
      const titulo = forma(titulos.find((c) => c.id === f.get('titulo_id')), t);
      const conselho = CONSELHOS[f.get('conselho')];
      const uf = f.get('registro_uf');
      const regi = String(f.get('registro') || '').trim().toUpperCase().replace(/^(CAU|CREA|ABD)(\/[A-Z]{2})?\s*/, '');
      return { nome: String(f.get('nome_assinatura') || '').trim() || String(f.get('nome') || ''), cargo, titulo,
        registro: regi ? [conselho && (uf ? `${conselho}/${uf}` : conselho), regi].filter(Boolean).join(' ') : '' };
    };
    const desenharBloco = () => {
      const a = atual();
      const previa = form.elements['vista-assin'].value === 'previa';
      const img = previa || !assinUrl
        ? (previa && assinUrl ? '<span class="eq-caixa-assin">rubrica</span>' : previa ? '' : '<span class="eq-sem-rubrica">sem rubrica enviada</span>')
        : `<img src="${assinUrl}" alt="Rubrica de ${esc(a.nome)}">`;
      // igual à folha da Marca: nome; cargo · registro; a rubrica abaixo
      const linha = [a.cargo, a.registro].filter(Boolean).join(' · ');
      caixaBloco.innerHTML = `<div class="eq-bloco"><div><b>${esc(a.nome)}</b>${linha ? `<br>${esc(linha)}` : ''}</div>${img}</div>`;
      raiz.querySelector('[data-resumo]').textContent = [a.cargo, a.titulo, a.registro].filter(Boolean).join(' · ');
    };
    // a conferência da rubrica fica no histórico: lida uma vez por sessão (por versão da rubrica), nunca guardada em disco
    const carregarAssinatura = async () => {
      if (!reg.assinatura_id) { assinUrl = null; desenharBloco(); return; }
      if (!rubricas.has(reg.assinatura_id)) {
        const r = await apiBinario(`/api/v1/equipe/${id}/assinatura?uso=conferencia`);
        rubricas.set(reg.assinatura_id, r.ok ? URL.createObjectURL(await r.blob()) : null);
      }
      assinUrl = rubricas.get(reg.assinatura_id);
      if (raiz.contains(caixaBloco)) desenharBloco();
    };
    desenharBloco();
    carregarAssinatura();

    form.addEventListener('input', (ev) => {
      if (ev.target.type === 'file' || ev.target.name === 'vista-assin') { desenharBloco(); return; }
      sujo = true; estado.textContent = 'não salvo';
      desenharBloco();
    });
    avisoSaida = () => sujo;

    // ---- salvar
    const ler = () => {
      const f = new FormData(form);
      const v = (k) => { const x = String(f.get(k) ?? '').trim(); return x === '' ? null : x; };
      const custo = v('custo_hora');
      return {
        equipe: {
          socio: form.elements.socio.checked ? 1 : 0,
          tratamento: v('tratamento'), desde: v('desde'), ate: v('ate'),
          cargo_id: v('cargo_id'), titulo_id: v('titulo_id'), conselho: v('conselho'), registro_uf: v('registro_uf'), registro: v('registro'),
          assina: f.getAll('assina'), nome_assinatura: v('nome_assinatura'),
          publico: form.elements.publico.checked ? 1 : 0,
          bio_pt: v('bio_pt'), bio_en: v('bio_en'),
          // "1.500,00" ou "150,5" (vírgula decimal) e também "150.5"
          custo_hora: custo === null ? null : Math.round(Number(custo.includes(',') ? custo.replace(/\./g, '').replace(',', '.') : custo) * 100),
        },
        pessoa: { nome: v('nome'), email: v('email') },
      };
    };
    const gravar = async (extra = {}) => {
      const d = ler();
      Object.assign(d.equipe, extra);
      if (Number.isNaN(d.equipe.custo_hora)) { toque('Custo por hora: use só números (ex.: 150,00)'); return false; }
      if (temPes && (d.pessoa.nome !== pes.nome || (d.pessoa.email || null) !== (pes.email || null))) {
        const r = await api('/api/v1/pessoas/' + pes.id, { method: 'PATCH', body: JSON.stringify({ versao: pes.versao, ...d.pessoa }) });
        if (r.status >= 400) { toque('Não foi possível salvar o nome/e-mail: ' + (r.erro || r.status)); return false; }
        pes = r.registro;
      }
      const r = await api('/api/v1/equipe/' + id, { method: 'PATCH', body: JSON.stringify({ versao: reg.versao, ...d.equipe }) });
      if (r.status === 409 && r.erro === 'conflito') { toque('Alguém salvou esta ficha antes. Recarregue a página.'); return false; }
      if (r.status >= 400) { toque('Não foi possível salvar: ' + (r.erro || r.status)); return false; }
      reg = r.registro; sujo = false; estado.textContent = 'salvo';
      apagarCopia('equipe:quadro');
      gravarCopia(chave, { ...dados, reg, pes: temPes ? pes : dados.pes });
      raiz.querySelector('h1').textContent = pes.nome;
      return true;
    };
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const botao = form.querySelector('[type=submit]');
      botao.disabled = true;
      try { if (await gravar()) toque('Salvo'); } finally { botao.disabled = false; }
    });

    // ---- desligar / trazer de volta (salva junto o que estiver na ficha)
    raiz.querySelector('[data-acao="desligar"]')?.addEventListener('click', async () => {
      const ate = form.elements.ate.value || hoje();
      if (!confirm(`Desligar ${pes.nome} da equipe em ${dataBr(ate)}? Some dos seletores e do banco de horas; horas e documentos antigos continuam com o nome.`)) return;
      if (await gravar({ ativo: 0, ate })) { toque('Desligado da equipe'); montarFicha(raiz, id, { ...dados, reg, pes: temPes ? pes : dados.pes }); }
    });
    raiz.querySelector('[data-acao="religar"]')?.addEventListener('click', async () => {
      if (!confirm(`Trazer ${pes.nome} de volta à equipe?`)) return;
      if (await gravar({ ativo: 1, ate: null })) { toque('De volta à equipe'); montarFicha(raiz, id, { ...dados, reg, pes: temPes ? pes : dados.pes }); }
    });

    // ---- foto
    async function enviarFoto(arquivo, origem) {
      const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
      const quadro = await enquadrar(bmp);
      bmp.close?.();
      if (!quadro) return false;
      estado.textContent = 'enviando a foto…';
      const g = await reduzir(quadro, 2400), m = await reduzir(quadro, 1200), s = await reduzir(quadro, 960);
      const sha = await sha256(g.blob);
      let r = await api('/api/v1/arquivos', { method: 'POST', body: JSON.stringify({
        dono_id: id, nome_original: arquivo.name || `${semAcento(pes.nome).replace(/\s+/g, '-')}.jpg`, tipo_mime: g.blob.type,
        categoria: 'imagem', sha256: sha, largura: g.w, altura: g.h, direitos: 'livre',
        texto_alternativo: pes.nome, legenda: origem || null }) });
      let arqId;
      if (r.status === 409 && r.registro) arqId = r.registro.id; // a mesma foto já está no acervo
      else if (r.status >= 400) throw new Error(r.erro || r.status);
      else {
        arqId = r.registro.id;
        for (const [v, x] of [['g', g], ['m', m], ['s', s]]) {
          const e = await apiBinario(`/api/v1/arquivos/${arqId}/conteudo?variante=${v}`, { method: 'PUT', body: x.blob, headers: { 'Content-Type': x.blob.type } });
          if (!e.ok) throw new Error('envio da imagem: ' + e.status);
        }
      }
      r = await api('/api/v1/equipe/' + id, { method: 'PATCH', body: JSON.stringify({ versao: reg.versao, foto_id: arqId }) });
      if (r.status >= 400) throw new Error(r.erro || r.status);
      reg = r.registro;
      estado.textContent = sujo ? 'não salvo' : 'foto salva';
      esquecer();
      ficha(raiz, id); // redesenha com a foto nova (mantém o que foi salvo)
      return true;
    }
    // reenquadrar a foto atual (a maior guardada); só dá para aproximar, não para mostrar além da foto
    raiz.querySelector('[data-acao="enquadrar"]')?.addEventListener('click', async () => {
      if (!quandoSujo()) return;
      try {
        const r = await apiBinario(`/api/v1/equipe/${id}/foto?variante=g`);
        if (!r.ok) throw new Error('foto não encontrada (' + r.status + ')');
        const b = await r.blob();
        sujo = false;
        await enviarFoto(new File([b], `${semAcento(pes.nome).replace(/\s+/g, '-')}.jpg`, { type: b.type }), 'Reenquadrada no Universo');
      } catch (e) { toque('Não foi possível enquadrar: ' + e.message); estado.textContent = ''; }
    });
    const quandoSujo = () => !sujo || confirm('Há mudanças não salvas na ficha. A foto é salva já, e a página recarrega. Continuar sem salvar o resto?');

    raiz.querySelector('[data-arquivo="foto"]').addEventListener('change', async (ev) => {
      const a = ev.target.files[0];
      ev.target.value = '';
      if (!a || !quandoSujo()) return;
      try { sujo = false; await enviarFoto(a); } catch (e) { toque('Não foi possível enviar a foto: ' + e.message); estado.textContent = ''; }
    });
    raiz.querySelector('[data-acao="foto-site"]')?.addEventListener('click', async () => {
      if (!quandoSujo()) return;
      const nome = semAcento(pes.nome.split(/\s+/)[0]);
      try {
        const r = await fetch(SITE + nome + '.jpg');
        if (!r.ok) throw new Error(`não há ${nome}.jpg no site`);
        const b = await r.blob();
        sujo = false;
        await enviarFoto(new File([b], nome + '.jpg', { type: b.type || 'image/jpeg' }), 'Do site (odisse.com.br › Sobre)');
      } catch (e) { toque('Não foi possível trazer a foto do site: ' + e.message); }
    });

    // ---- rubrica
    raiz.querySelector('[data-arquivo="assinatura"]').addEventListener('change', async (ev) => {
      const a = ev.target.files[0];
      ev.target.value = '';
      if (!a) return;
      if (!quandoSujo()) return;
      try {
        const x = await prepararAssinatura(a);
        const u = URL.createObjectURL(x.blob);
        const ok = await confirmarAssinatura(u, x);
        URL.revokeObjectURL(u);
        if (!ok) return;
        const r = await apiBinario(`/api/v1/equipe/${id}/assinatura?versao=${reg.versao}`, { method: 'PUT', body: x.blob, headers: { 'Content-Type': 'image/png' } });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.erro || r.status);
        sujo = false;
        toque('Rubrica guardada');
        esquecer();
        ficha(raiz, id);
      } catch (e) { toque('Não foi possível usar a rubrica: ' + e.message); }
    });
    raiz.querySelector('[data-acao="tirar-assinatura"]')?.addEventListener('click', async () => {
      if (!confirm('Tirar a rubrica? Os PDFs já baixados não mudam; os próximos saem sem ela.') || !quandoSujo()) return;
      const r = await api(`/api/v1/equipe/${id}/assinatura/remover`, { method: 'POST', body: JSON.stringify({ versao: reg.versao }) });
      if (r.status >= 400) { toque('Não foi possível tirar: ' + (r.erro || r.status)); return; }
      sujo = false;
      esquecer();
      ficha(raiz, id);
    });
  }

  // Confirmação da rubrica antes de enviar: mostra sobre papel e sobre fundo quadriculado.
  function confirmarAssinatura(url, x) {
    return new Promise((ok) => {
      const d = document.createElement('dialog');
      d.className = 'eq-dialogo';
      d.innerHTML = `<form method="dialog" class="dialogo-logo">
          <div class="dl-cab"><div><span class="u-rotulo">Rubrica</span><h2 class="u-subtitulo">Conferir antes de guardar</h2></div></div>
          <div class="duas"><div class="pv"><div class="eq-pv papel"><img src="${url}" alt=""></div>Sobre o papel</div>
            <div class="pv"><div class="eq-pv pv-q xadrez"><img src="${url}" alt=""></div>Transparência</div></div>
          <p class="u-apoio">${x.w} × ${x.h} px${x.fundoTirado ? ' · o fundo claro foi tirado aqui; confira se o traço ficou inteiro' : ''}.</p>
          <div class="dl-acoes"><button class="u-botao" value="nao">Cancelar</button><button class="u-botao forte" value="sim">Guardar rubrica</button></div>
        </form>`;
      document.body.appendChild(d);
      d.addEventListener('close', () => { ok(d.returnValue === 'sim'); d.remove(); });
      d.showModal();
    });
  }

  return {
    ligar(raiz) {
      const partes = location.hash.split('?')[0].split('/').slice(2); // [] | ['nova'] | ['eqp_…']
      if (partes[0] === 'nova') return nova(raiz);
      if (partes[0] === 'cargos') return cargosTitulos(raiz);
      if (partes[0]) { avisoSaida = () => false; return ficha(raiz, partes[0]); }
      return lista(raiz);
    },
  };
}
