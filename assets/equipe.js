// Página Equipe do hub (#/equipe): o cadastro comum da equipe, lido por todas as ferramentas (seletor de quem
// assina, banco de horas, responsáveis, site). Dados em /api/v1/equipe/… (worker/dados/equipe.js).
//
// Rotas: #/equipe (lista, cargos e títulos) · #/equipe/nova · #/equipe/<eqp_…> (ficha da pessoa)
//
// Rubrica (as iniciais, não uma assinatura formal): guardada à parte (arquivo protegido; na API, "assinatura").
// Sai abaixo da identificação (nome; cargo · registro), sem mudar o bloco da folha. Aqui aparece só para
// conferência; nos documentos, a prévia mostra a caixa do lugar dela e o PNG entra só na emissão.

const SITE = 'https://www.odisse.com.br/images/equipe/';
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

export function criarEquipe({ esc, api, apiBinario, toque }) {
  let avisoSaida = () => false;
  window.addEventListener('beforeunload', (ev) => { if (avisoSaida()) { ev.preventDefault(); ev.returnValue = ''; } });
  const urls = new Map(); // id da pessoa + variante → objectURL da foto (lida com a senha)

  async function fotoUrl(p, variante = 's') {
    if (!p.foto_id) return null;
    const chave = `${p.foto_id}-${variante}`;
    if (urls.has(chave)) return urls.get(chave);
    const r = await apiBinario(`/api/v1/equipe/${p.id}/foto?variante=${variante}`);
    if (!r.ok) return null;
    const u = URL.createObjectURL(await r.blob());
    urls.set(chave, u);
    return u;
  }
  const preencherFotos = (raiz, pessoas) => raiz.querySelectorAll('[data-foto]').forEach(async (el) => {
    const p = pessoas.find((x) => x.id === el.dataset.foto);
    const u = p && (await fotoUrl(p, el.dataset.variante || 's'));
    if (u) el.style.backgroundImage = `url("${u}")`;
  });
  const iniciais = (nome) => String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  const linhaTitulo = (p) => [p.titulo, p.registro_formatado].filter(Boolean).join(' · ');

  // ---- lista -----------------------------------------------------------------
  async function lista(raiz) {
    avisoSaida = () => false;
    raiz.innerHTML = '<p class="u-apoio">Carregando…</p>';
    const q = await api('/api/v1/equipe/quadro?todos=1');
    if (q.status !== 200) { raiz.innerHTML = `<p class="u-apoio">Não foi possível ler a equipe (${esc(q.erro || q.status)}).</p>`; return; }
    const ativos = q.itens.filter((p) => p.ativo), inativos = q.itens.filter((p) => !p.ativo);
    const cartao = (p) => `<a class="u-cartao eq-pessoa${p.ativo ? '' : ' inativa'}" href="#/equipe/${esc(p.id)}">
        <span class="eq-foto" data-foto="${esc(p.id)}">${p.foto_id ? '' : `<i>${esc(iniciais(p.nome))}</i>`}</span>
        <span class="eq-dados"><b>${esc(p.nome)}</b>
          <span>${esc(p.cargo || 'Sem cargo')}</span>
          ${linhaTitulo(p) ? `<small>${esc(linhaTitulo(p))}</small>` : ''}
          <span class="eq-chips">${p.socio ? '<span class="chip forte">sócio</span>' : ''}${p.publico ? '<span class="chip">no site</span>' : ''}
            ${p.assina.length ? `<span class="chip">assina: ${esc(p.assina.map((u) => (USOS.find((x) => x[0] === u) || [u, u])[1].toLowerCase()).join(', '))}</span>` : ''}
            ${p.assina.length && !p.tem_assinatura ? '<span class="chip falta-chip">sem rubrica</span>' : ''}
            ${p.ativo ? '' : '<span class="chip">inativo</span>'}</span></span></a>`;
    raiz.innerHTML = `<div class="cab"><div><h1 class="u-titulo">Equipe</h1>
        <p class="u-apoio">Quem faz o Odisse. Todas as ferramentas leem daqui: quem assina propostas, contratos e documentos,
        o banco de horas, os responsáveis pelos projetos e a página Sobre do site.</p></div>
        <div class="acoes-cab"><a class="u-botao forte" href="#/equipe/nova">+ Pessoa</a></div></div>
      <section class="bloco"><span class="u-rotulo">Na equipe</span>
        <div class="eq-grade">${ativos.map(cartao).join('') || '<p class="u-apoio">Ninguém ainda.</p>'}</div></section>
      ${inativos.length ? `<section class="bloco"><span class="u-rotulo">Já passaram pela equipe</span>
        <p class="u-apoio">Não aparecem nos seletores nem no banco de horas; as horas e os documentos antigos continuam com o nome.</p>
        <div class="eq-grade">${inativos.map(cartao).join('')}</div></section>` : ''}
      <section class="bloco"><span class="u-rotulo">Cargos e títulos</span>
        <p class="u-apoio">Opções de cada pessoa, com a forma masculina, a feminina e a inglesa (site em inglês).
        O tratamento da pessoa escolhe a forma. Mudar aqui muda em todo lugar que mostra o cargo.</p>
        <div class="duas eq-listas"><div data-lista="cargos"></div><div data-lista="titulos"></div></div></section>`;
    preencherFotos(raiz, q.itens);
    listaEditavel(raiz.querySelector('[data-lista="cargos"]'), 'cargos', 'Cargos', q.cargos);
    listaEditavel(raiz.querySelector('[data-lista="titulos"]'), 'titulos', 'Títulos profissionais', q.titulos);
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
    });
    caixa.querySelector('[data-nova]').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const corpo = { nome_m: f.nome_m.value, nome_f: f.nome_f.value, nome_en: f.nome_en.value || null, ordem: (itens.length + 1) * 10 };
      const r = await api(`/api/v1/${rota}`, { method: 'POST', body: JSON.stringify(corpo) });
      if (r.status >= 400) { toque('Não foi possível acrescentar: ' + (r.erro || r.status)); return; }
      itens.push(r.registro);
      caixa.querySelector('tbody').insertAdjacentHTML('beforeend', linha(r.registro));
      f.reset();
    });
  }

  // ---- pessoa nova -------------------------------------------------------------
  function nova(raiz) {
    avisoSaida = () => false;
    raiz.innerHTML = `<div class="cab"><div><a class="u-apoio" href="#/equipe">← Equipe</a><h1 class="u-titulo">Pessoa nova</h1>
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
      location.hash = '#/equipe/' + r.registro.id;
    });
  }

  // ---- ficha -------------------------------------------------------------------
  async function ficha(raiz, id) {
    raiz.innerHTML = '<p class="u-apoio">Carregando…</p>';
    const [q, rEq] = await Promise.all([api('/api/v1/equipe/quadro?todos=1'), api('/api/v1/equipe/' + id)]);
    if (q.status !== 200 || rEq.status !== 200) { raiz.innerHTML = `<p class="u-apoio">Pessoa não encontrada (${esc(rEq.erro || q.erro || rEq.status)}).</p>`; return; }
    let reg = rEq.registro;                       // linha da equipe (com versao e custo por hora)
    let p = q.itens.find((x) => x.id === id);     // a mesma pessoa já montada (cargo na forma certa, registro formatado)
    const rPes = await api('/api/v1/pessoas/' + reg.pessoa_id);
    let pes = rPes.registro || { nome: p.nome, email: p.email };
    const { cargos, titulos } = q;
    let sujo = false;

    const opcoes = (lista, atual) => `<option value="">—</option>` + lista.map((c) =>
      `<option value="${esc(c.id)}"${c.id === atual ? ' selected' : ''}>${esc(c.nome_m === c.nome_f ? c.nome_m : `${c.nome_m} / ${c.nome_f}`)}</option>`).join('');
    const chk = (nome, v, texto) => `<label class="eq-check"><input type="checkbox" name="${nome}"${v ? ' checked' : ''}> ${texto}</label>`;
    const assina = (reg.assina || '').split(',').filter(Boolean);

    raiz.innerHTML = `<div class="cab"><div><a class="u-apoio" href="#/equipe">← Equipe</a>
        <h1 class="u-titulo">${esc(pes.nome)}</h1><p class="u-apoio" data-resumo></p></div>
        <div class="acoes-cab"><button class="u-botao perigo" data-acao="arquivar">Tirar da equipe</button></div></div>
      <form class="eq-ficha" autocomplete="off">
        <section class="u-cartao eq-sec"><h2 class="u-subtitulo">Pessoa</h2>
          <div class="eq-pessoa-topo">
            <div class="eq-foto-grande"><span class="eq-foto g" data-foto="${esc(id)}" data-variante="m">${reg.foto_id ? '' : `<i>${esc(iniciais(pes.nome))}</i>`}</span>
              <label class="u-botao eq-arquivo">Trocar foto<input type="file" accept="image/*" data-arquivo="foto"></label>
              ${reg.foto_id ? '' : `<button type="button" class="u-botao" data-acao="foto-site">Trazer do site</button>`}
              <small class="u-apoio">Foto quadrada, rosto ao centro. Vai para o acervo, nos três tamanhos do site.</small></div>
            <div class="campos eq-campos">
              <label class="u-campo"><span>Nome</span><input name="nome" value="${esc(pes.nome)}" required></label>
              <label class="u-campo"><span>E-mail</span><input name="email" type="email" value="${esc(pes.email || '')}"></label>
              <div class="u-campo"><span>Situação</span>${chk('socio', reg.socio, 'Sócio(a)')}${chk('ativo', reg.ativo, 'Ativo(a) na equipe')}</div>
              <div class="u-campo"><span>Tratamento</span><div class="eq-radios">
                <label><input type="radio" name="tratamento" value="m"${reg.tratamento === 'm' ? ' checked' : ''}> o (masculino)</label>
                <label><input type="radio" name="tratamento" value="f"${reg.tratamento === 'f' ? ' checked' : ''}> a (feminino)</label></div></div>
              <label class="u-campo"><span>Na equipe desde</span><input type="date" name="desde" value="${esc(reg.desde || '')}"></label>
              <label class="u-campo"><span>Até</span><input type="date" name="ate" value="${esc(reg.ate || '')}"><small>Quem sai: preencha e desmarque “ativo”.</small></label>
            </div></div></section>

        <section class="u-cartao eq-sec"><h2 class="u-subtitulo">Cargo e registro</h2>
          <div class="campos eq-campos">
            <label class="u-campo"><span>Cargo</span><select name="cargo_id">${opcoes(cargos, reg.cargo_id)}</select>
              <small>Opções na lista de cargos (página Equipe).</small></label>
            <label class="u-campo"><span>Título profissional</span><select name="titulo_id">${opcoes(titulos, reg.titulo_id)}</select></label>
            <label class="u-campo"><span>Conselho</span><select name="conselho"><option value="">—</option>
              ${Object.entries(CONSELHOS).map(([k, v]) => `<option value="${k}"${reg.conselho === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
            <label class="u-campo"><span>Número de registro</span><input name="registro" value="${esc(reg.registro || '')}" placeholder="A123456-7"></label>
          </div></section>

        <section class="u-cartao eq-sec"><h2 class="u-subtitulo">Assinatura</h2>
          <div class="duas">
            <div>
              <div class="u-campo"><span>Pode assinar</span>${USOS.map(([k, n, ajuda]) =>
                `<label class="eq-check"><input type="checkbox" name="assina" value="${k}"${assina.includes(k) ? ' checked' : ''}> ${n} <small>${ajuda}</small></label>`).join('')}</div>
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
          <div class="campos eq-campos">
            <div class="u-campo">${chk('publico', reg.publico, 'Aparece na página Sobre do site')}</div>
            <label class="u-campo"><span>Ordem</span><input type="number" name="ordem" min="0" max="999" value="${esc(reg.ordem ?? '')}"><small>Menor primeiro.</small></label>
            <label class="u-campo f largo"><span>Bio <span class="lingua">PT</span></span><textarea name="bio_pt" rows="4" maxlength="2000">${esc(reg.bio_pt || '')}</textarea></label>
            <label class="u-campo f largo"><span>Bio <span class="lingua en">EN</span></span><textarea name="bio_en" rows="4" maxlength="2000">${esc(reg.bio_en || '')}</textarea>
              <small>Vazia = no site em inglês a pessoa aparece sem bio (em vez do texto em português).</small></label>
          </div></section>

        <section class="u-cartao eq-sec"><h2 class="u-subtitulo">Interno</h2>
          <div class="campos eq-campos">
            <label class="u-campo"><span>Custo por hora (R$)</span><input name="custo_hora" inputmode="decimal" value="${reg.custo_hora != null ? (reg.custo_hora / 100).toFixed(2).replace('.', ',') : ''}">
              <small>Só sócios. Não aparece para o vendas, os fornecedores nem o marketing.</small></label>
          </div></section>

        <div class="barra-salvar"><span class="u-apoio" data-estado></span><button class="u-botao forte" type="submit">Salvar</button></div>
      </form>`;

    const form = raiz.querySelector('form');
    const estado = raiz.querySelector('[data-estado]');
    preencherFotos(raiz, [{ ...p, foto_id: reg.foto_id }]);

    // ---- bloco de assinatura (como sai no documento)
    let assinUrl = null;
    const caixaBloco = raiz.querySelector('[data-bloco]');
    const atual = () => {
      const f = new FormData(form);
      const t = f.get('tratamento');
      const cargo = forma(cargos.find((c) => c.id === f.get('cargo_id')), t);
      const titulo = forma(titulos.find((c) => c.id === f.get('titulo_id')), t);
      const conselho = CONSELHOS[f.get('conselho')];
      const regi = String(f.get('registro') || '').trim().toUpperCase().replace(/^(CAU|CREA|ABD)\s*/, '');
      return { nome: String(f.get('nome_assinatura') || '').trim() || String(f.get('nome') || ''), cargo, titulo,
        registro: regi ? [conselho, regi].filter(Boolean).join(' ') : '' };
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
    const carregarAssinatura = async () => {
      if (!reg.assinatura_id) { assinUrl = null; desenharBloco(); return; }
      const r = await apiBinario(`/api/v1/equipe/${id}/assinatura?uso=conferencia`);
      assinUrl = r.ok ? URL.createObjectURL(await r.blob()) : null;
      desenharBloco();
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
          socio: form.elements.socio.checked ? 1 : 0, ativo: form.elements.ativo.checked ? 1 : 0,
          tratamento: v('tratamento'), desde: v('desde'), ate: v('ate'),
          cargo_id: v('cargo_id'), titulo_id: v('titulo_id'), conselho: v('conselho'), registro: v('registro'),
          assina: f.getAll('assina'), nome_assinatura: v('nome_assinatura'),
          publico: form.elements.publico.checked ? 1 : 0, ordem: v('ordem') === null ? null : Number(v('ordem')),
          bio_pt: v('bio_pt'), bio_en: v('bio_en'),
          // "1.500,00" ou "150,5" (vírgula decimal) e também "150.5"
          custo_hora: custo === null ? null : Math.round(Number(custo.includes(',') ? custo.replace(/\./g, '').replace(',', '.') : custo) * 100),
        },
        pessoa: { nome: v('nome'), email: v('email') },
      };
    };
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const d = ler();
      if (Number.isNaN(d.equipe.custo_hora)) { toque('Custo por hora: use só números (ex.: 150,00)'); return; }
      const botao = form.querySelector('[type=submit]');
      botao.disabled = true;
      try {
        if (rPes.registro && (d.pessoa.nome !== pes.nome || (d.pessoa.email || null) !== (pes.email || null))) {
          const r = await api('/api/v1/pessoas/' + pes.id, { method: 'PATCH', body: JSON.stringify({ versao: pes.versao, ...d.pessoa }) });
          if (r.status >= 400) { toque('Não foi possível salvar o nome/e-mail: ' + (r.erro || r.status)); return; }
          pes = r.registro;
        }
        const r = await api('/api/v1/equipe/' + id, { method: 'PATCH', body: JSON.stringify({ versao: reg.versao, ...d.equipe }) });
        if (r.status === 409 && r.erro === 'conflito') { toque('Alguém salvou esta ficha antes. Recarregue a página.'); return; }
        if (r.status >= 400) { toque('Não foi possível salvar: ' + (r.erro || r.status)); return; }
        reg = r.registro; sujo = false; estado.textContent = 'salvo';
        raiz.querySelector('h1').textContent = pes.nome;
        toque('Salvo');
      } finally { botao.disabled = false; }
    });

    // ---- foto
    async function enviarFoto(arquivo, origem) {
      estado.textContent = 'enviando a foto…';
      const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
      const g = await reduzir(bmp, 2400), m = await reduzir(bmp, 1200), s = await reduzir(bmp, 960);
      bmp.close?.();
      const sha = await sha256(arquivo);
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
      ficha(raiz, id); // redesenha com a foto nova (mantém o que foi salvo)
    }
    const quandoSujo = () => !sujo || confirm('Há mudanças não salvas na ficha. A foto é salva já, e a página recarrega. Continuar sem salvar o resto?');

    raiz.querySelector('[data-arquivo="foto"]').addEventListener('change', async (ev) => {
      const a = ev.target.files[0];
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

    // ---- assinatura
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
        ficha(raiz, id);
      } catch (e) { toque('Não foi possível usar a rubrica: ' + e.message); }
    });
    raiz.querySelector('[data-acao="tirar-assinatura"]')?.addEventListener('click', async () => {
      if (!confirm('Tirar a rubrica? Os PDFs já baixados não mudam; os próximos saem sem ela.') || !quandoSujo()) return;
      const r = await api(`/api/v1/equipe/${id}/assinatura/remover`, { method: 'POST', body: JSON.stringify({ versao: reg.versao }) });
      if (r.status >= 400) { toque('Não foi possível tirar: ' + (r.erro || r.status)); return; }
      sujo = false;
      ficha(raiz, id);
    });

    // ---- tirar da equipe (arquiva o registro da equipe; a pessoa continua nos contatos)
    raiz.querySelector('[data-acao="arquivar"]').addEventListener('click', async () => {
      if (!confirm(`Tirar ${pes.nome} da equipe? Some das listas e seletores; horas e documentos antigos continuam com o nome.
Para quem só saiu, prefira desmarcar “ativo” e preencher a data de saída.`)) return;
      const r = await api(`/api/v1/equipe/${id}/arquivar`, { method: 'POST', body: JSON.stringify({ versao: reg.versao }) });
      if (r.status >= 400) { toque('Não foi possível: ' + (r.erro || r.status)); return; }
      sujo = false;
      location.hash = '#/equipe';
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
      if (partes[0]) { avisoSaida = () => false; return ficha(raiz, partes[0]); }
      return lista(raiz);
    },
  };
}
