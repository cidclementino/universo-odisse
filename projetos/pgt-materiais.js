// ==========================================================================
// PGT › Materiais: os PADRÕES de material e os materiais com link.
//
//   * Padrão = formulário, checklist ou modelo de documento feito aqui: campos em ordem e a folha da Marca em que
//     ele sai (Coluna ou Ficha). Criado uma vez, é LIGADO a quantas etapas, entregas e eventos for preciso, de
//     qualquer fase e serviço; mudou o padrão, mudou em todos (cada ligação é um pgt_materiais com modelo_id).
//   * #materiais: Registro dos padrões + a lista dos materiais com link (como antes).
//   * #materiais/pmo_…: o editor (Editor com prévia): a folha à esquerda, montada pelo montador da Marca; os Blocos
//     à direita (Padrão, Folha, Campos em Pilha arrastável com Inserir entre, Ligado a); Barra de salvar.
//   * O projeto (Escopo) preenche o padrão da versão publicada do PGT: vem depois.
// Usa as globais da página: D, ROTA, escHtml, Universo, aviso, mensagemDe, recarregar, bloco, ligarBlocos, IC2,
// etapaDe, entDe, evtDe, faseDe, alvoNome, materiaisDe, TIPOS_MAT, montarFiltroAlvo.
// ==========================================================================

const MT = { id: null, r: null, sujo: false, aberto: null, inserir: null, tPrevia: 0, rodada: 0, valores: null,
  vista: (() => { try { return localStorage.getItem('pgt:mt-vista') || 'formulario'; } catch (_) { return 'formulario'; } })(), folha: 'vazia' };
const MT_TIPOS = MP.TIPOS, MT_CAMPOS = MP.CAMPOS, MT_AUTO = MP.AUTO;
const mtNome = (lista, id) => (lista.find((x) => x[0] === id) || [id, id])[1];
const MT_IC = {
  alca: '<svg viewBox="0 0 14 14" aria-hidden="true"><g fill="currentColor"><circle cx="5" cy="3.5" r="1.1"/><circle cx="9" cy="3.5" r="1.1"/><circle cx="5" cy="7" r="1.1"/><circle cx="9" cy="7" r="1.1"/><circle cx="5" cy="10.5" r="1.1"/><circle cx="9" cy="10.5" r="1.1"/></g></svg>',
  lapis: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.8 2.6 13.4 5.2 6 12.6 3 13 3.4 10Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  mais: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
};
const mtModelos = () => D.modelos || [];
const mtModelo = (id) => mtModelos().find((m) => m.id === id);
const mtLigacoes = (id) => D.materiais.filter((m) => m.modelo_id === id);
const mtNovoId = () => 'c' + Math.random().toString(36).slice(2, 9);

// ---------------------------------------------------------------- prévia: Formulário (digital, em Blocos) ou Folha (o PDF)
// O formulário é o que se preenche no cartão do projeto; a folha é o PDF — vazia por padrão, ou com o que se
// digitou no formulário (aqui, para testar o padrão: nada do que se digita na prévia é gravado).
async function mtPrevia() {
  const minha = ++MT.rodada;
  if (!MT.r) return;
  const caixaForm = document.querySelector('[data-mt-form]');
  if (MT.vista === 'formulario') {
    if (!caixaForm) return;
    caixaForm.innerHTML = MP.formulario(MT.r, { valores: MT.valores || {} });
    MP.ligar(caixaForm, MT.r, (v) => { MT.valores = v; });
    return;
  }
  const caixa = document.querySelector('[data-mt-folhas]');
  const escala = document.querySelector('.mt-escala');
  if (!caixa) return;
  try {
    const n = await MP.montar(caixa, MP.doc(MT.r, MT.folha === 'preenchida' ? (MT.valores || {}) : null));
    if (minha !== MT.rodada) return;
    const k = Math.min(0.72, (escala.parentElement.clientWidth - 32) / 794);
    caixa.style.transform = `scale(${k})`;
    escala.style.height = `${(n * 1123 + (n - 1) * 24) * k}px`;
    escala.style.width = `${794 * k}px`;
  } catch (e) {
    caixa.innerHTML = `<p class="pg-apoio">Não foi possível montar a prévia: ${escHtml(e.message)}</p>`;
  }
}
// miniatura da folha (Registro dos padrões): a primeira página reduzida
async function mtMiniaturas(raiz) {
  for (const box of raiz.querySelectorAll('[data-mt-mini]')) {
    const m = mtModelo(box.dataset.mtMini); if (!m) continue;
    try { const f = box.querySelector('.mt-mini__folhas'); await MP.montar(f, MP.doc(m)); f.style.transform = `scale(${box.clientWidth / 794})`; }
    catch (_) { /* fica a caixa vazia */ }
  }
}
const mtPreviaDepois = () => { clearTimeout(MT.tPrevia); MT.tPrevia = setTimeout(mtPrevia, MT.vista === 'formulario' ? 150 : 250); };

// ---------------------------------------------------------------- a aba: Registro dos padrões + materiais com link
function desenharMateriais() {
  const el = document.getElementById('materiais');
  if (!el || !D) return;
  const filtrosAlvo = document.querySelector('[data-painel="materiais"] .gestao__filtros');
  if (ROTA.aba === 'materiais' && ROTA.padrao) {
    if (filtrosAlvo) filtrosAlvo.hidden = true;
    document.getElementById('filtros').hidden = true;
    return mtDesenharEditor(el, ROTA.padrao);
  }
  if (filtrosAlvo) filtrosAlvo.hidden = false;
  MT.id = null; MT.r = null; MT.sujo = false;
  document.body.classList.remove('pg-com-barra');
  const ms = mtModelos();
  const padroes = `<section class="mt-secao">
    <div class="mt-secao__cab"><h2 class="pg-secao-h">Padrões</h2><span class="pg-apoio">${ms.length}</span><span class="pg-empurra"></span>
      <button type="button" class="u-botao forte" id="mt-novo">${MT_IC.mais}<span>Novo padrão</span></button></div>
    ${ms.length ? `<div class="pg-regua mt-grade"><span></span><span>Padrão</span><span>Tipo</span><span>Folha</span><span>Ligado a</span><span></span></div>
    <div class="pg-registro">${ms.map((m) => {
      const n = mtLigacoes(m.id).length;
      return `<a class="pg-linha mt-grade" href="#materiais/${m.id}">
        <span class="mt-mini" data-mt-mini="${m.id}" aria-hidden="true"><span class="mt-mini__folhas"></span></span>
        <span class="mt-nome"><b>${escHtml(m.nome)}</b><small>${(m.campos || []).length} campo${(m.campos || []).length === 1 ? '' : 's'}</small></span>
        <span><span class="pg-etq">${escHtml(mtNome(MT_TIPOS, m.tipo))}</span></span>
        <span class="pg-apoio">${m.folha === 'coluna' ? 'Coluna' : 'Ficha'}</span>
        <span>${n ? `${n} ${n > 1 ? 'cartões' : 'cartão'}` : '<span class="pg-etq tracejada">sem ligação</span>'}</span>
        <span class="pg-caixa" aria-hidden="true">${MT_IC.lapis}</span></a>`;
    }).join('')}</div>`
    : '<div class="pg-vazio">Nenhum padrão ainda. Crie um formulário, checklist ou modelo e ligue-o às entregas e eventos.</div>'}
    </section>`;
  // materiais com link (como antes; os ligados a padrão ficam na lista de cima)
  const alvo = document.getElementById('f-alvo').value;
  const f = filtro();
  const casa = (m) => {
    if (m.modelo_id) return false;
    const passo = entDe(m.alvo_id) || evtDe(m.alvo_id);
    const eta = passo ? etapaDe(passo.etapa_id) : etapaDe(m.alvo_id);
    if (!eta) return false;
    return (!f.eta || eta.id === f.eta) && (!f.srv || f.todos || (passo ? passo.servicos[f.srv] : eta.servicos[f.srv]))
      && (!f.q || semAcento(m.nome + ' ' + alvoNome(m.alvo_id)).includes(f.q));
  };
  const lista = (alvo ? materiaisDe(alvo) : D.materiais).filter(casa);
  const links = `<section class="mt-secao mt-secao--links"><div class="mt-secao__cab"><h2 class="pg-secao-h">Materiais com link</h2><span class="pg-apoio">${lista.length}</span></div>
    ${lista.length ? `<table class="tabela"><thead><tr><th>Tipo</th><th>Material</th><th>Ligado a</th></tr></thead><tbody>
      ${lista.map((m) => `<tr><td><span class="chip">${escHtml(nomeDe(TIPOS_MAT, m.tipo))}</span></td>
        <td>${m.link ? `<a href="${escHtml(m.link)}" target="_blank" rel="noopener">${escHtml(m.nome)}</a>` : escHtml(m.nome)}</td>
        <td class="small"><a href="#" data-alvo="${m.alvo_id}">${escHtml(alvoNome(m.alvo_id))}</a></td></tr>`).join('')}</tbody></table>`
      : `<div class="pg-vazio">${alvo ? `Nenhum material com link ligado a ${escHtml(alvoNome(alvo))}.` : 'Nenhum material com link com esses filtros. Acrescente abrindo uma entrega, um evento ou uma etapa no Plano do fluxo ou das ilhas.'}</div>`}
    </section>`;
  el.innerHTML = padroes + links;
  mtMiniaturas(el);
  el.querySelectorAll('[data-alvo]').forEach((a) => a.onclick = (ev) => { ev.preventDefault(); irAoCartao(a.dataset.alvo); });
  el.querySelector('#mt-novo').onclick = async (ev) => {
    ev.currentTarget.disabled = true;
    try {
      const r = await Universo.criar('pgt-modelos', { nome: 'Novo padrão', tipo: 'formulario', campos: [
        { id: mtNovoId(), tipo: 'automatico', fonte: 'projeto', rotulo: 'Projeto' },
        { id: mtNovoId(), tipo: 'automatico', fonte: 'data', rotulo: 'Data' },
        { id: mtNovoId(), tipo: 'secao', rotulo: 'Conteúdo' }] });
      await recarregar();
      location.hash = `#materiais/${r.id}`;
    } catch (err) { aviso(mensagemDe(err)); ev.currentTarget.disabled = false; }
  };
}

// ---------------------------------------------------------------- o editor
function mtDesenharEditor(el, id) {
  const m = mtModelo(id);
  if (!m) { el.innerHTML = '<div class="pg-vazio">Este padrão não existe mais (ou foi arquivado). <a href="#materiais">Voltar aos materiais</a>.</div>'; return; }
  if (MT.id !== id || !MT.r) { if (MT.id !== id) MT.valores = null; MT.id = id; MT.r = structuredClone(m); MT.sujo = false; MT.aberto = null; MT.inserir = null; }
  const r = MT.r;
  // título e trilha da subpágina
  const tr = document.getElementById('trilha');
  tr.hidden = false;
  tr.innerHTML = `<a href="#materiais">Materiais</a><span class="sep">/</span><span aria-current="page">${escHtml(r.nome)}</span>`;
  document.getElementById('titulo').textContent = r.nome;
  document.title = `${r.nome} · Materiais · Plano Geral de Trabalho — Odisse`;
  const seletor = (campo, opcoes, rot) => `<span class="pg-seletor" role="radiogroup" aria-label="${rot}">${opcoes.map(([v, n]) =>
    `<button type="button" role="radio" data-mt-set="${campo}|${v}" aria-checked="${String(r[campo]) === String(v)}">${n}</button>`).join('')}</span>`;
  const campo = (rot, html) => `<div class="u-campo mt-campo-f"><span>${rot}</span>${html}</div>`;
  const ligs = mtLigacoes(id);
  const bPadrao = bloco('mt-padrao', 'Padrão', `<div class="mt-cols">
      ${campo('Nome', `<input type="text" data-mt-txt="nome" value="${escHtml(r.nome)}" maxlength="160">`)}
      ${campo('Tipo', seletor('tipo', MT_TIPOS, 'Tipo'))}
      ${campo('Para que serve', `<textarea data-mt-txt="descricao" rows="2" maxlength="2000">${escHtml(r.descricao || '')}</textarea>`)}</div>`);
  const bFolha = bloco('mt-folha', 'Folha', `<div class="mt-cols mt-cols--linha">
      ${campo('Folha', seletor('folha', [['coluna', 'Coluna'], ['ficha', 'Ficha']], 'Folha'))}
      ${campo('Miolo', seletor('miolo', [['texto', 'Campos'], ['vazio', 'Livre'], ['pontos', 'Quadrícula']], 'Miolo'))}
      ${campo('Quem preenche', seletor('preenche', [['estudio', 'Estúdio'], ['cliente', 'Cliente'], ['ambos', 'Ambos']], 'Quem preenche'))}
      ${campo('Ao concluir', seletor('prova', [['1', 'Vira prova'], ['0', 'Só guarda']], 'Ao concluir'))}</div>`);
  const entre = (i) => `<div class="mt-entre${MT.inserir === i ? ' is-aberto' : ''}" data-entre="${i}">${MT.inserir === i ? mtMenuTipos(i)
    : `<button type="button" class="pg-caixa" data-inserir="${i}" aria-label="Acrescentar um campo aqui" title="Acrescentar um campo aqui">${MT_IC.mais}</button>`}</div>`;
  const pilha = `<div class="mt-pilha" data-mt-pilha>${(r.campos || []).map((c, i) => `${i ? entre(i) : ''}${mtItem(c, i)}`).join('')}</div>
    ${MT.inserir === (r.campos || []).length ? `<div class="mt-entre is-aberto">${mtMenuTipos((r.campos || []).length)}</div>`
      : `<button type="button" class="mt-acrescentar" data-inserir="${(r.campos || []).length}">${MT_IC.mais}<span>Acrescentar campo</span></button>`}`;
  const bCampos = bloco('mt-campos', `Campos <span class="pg-apoio">${(r.campos || []).length}</span>`, pilha);
  const bLig = bloco('mt-lig', `Ligado a <span class="pg-apoio">${ligs.length}</span>`, `${ligs.length ? `<div class="mt-ligs">${ligs.map((l) => `<span class="mt-lig">
      <a href="#" data-ir="${l.alvo_id}">${escHtml(alvoNome(l.alvo_id))}</a><button type="button" class="pg-caixa" data-desligar="${l.id}" aria-label="Desligar" title="Desligar deste cartão">${MT_IC.x}</button></span>`).join('')}</div>`
      : '<p class="pg-apoio">Ainda não está em nenhum cartão.</p>'}
    <button type="button" class="u-botao pg-meia" id="mt-ligar">Ligar a etapas, entregas e eventos</button>`);
  el.innerHTML = `<div class="mt-editor">
      <div class="mt-previa">
        <div class="mt-previa__cab">
          <span class="pg-seletor" role="radiogroup" aria-label="Prévia">
            <button type="button" role="radio" data-mt-vista="formulario" aria-checked="${MT.vista === 'formulario'}">Formulário</button>
            <button type="button" role="radio" data-mt-vista="folha" aria-checked="${MT.vista === 'folha'}">Folha (PDF)</button></span>
          ${MT.vista === 'folha' ? `<span class="pg-seletor" role="radiogroup" aria-label="Folha">
            <button type="button" role="radio" data-mt-folha="vazia" aria-checked="${MT.folha === 'vazia'}">Vazia</button>
            <button type="button" role="radio" data-mt-folha="preenchida" aria-checked="${MT.folha === 'preenchida'}" title="Com o que foi digitado na vista Formulário">Preenchida</button></span>` : '<span class="pg-apoio">o que se preenche no cartão do projeto · nada aqui é gravado</span>'}
        </div>
        ${MT.vista === 'folha' ? '<div class="mt-folha"><div class="mt-escala"><div class="mt-folhas" data-mt-folhas></div></div></div>' : '<div class="mt-formulario" data-mt-form></div>'}
      </div>
      <div class="mt-blocos">${bPadrao}${bFolha}${bCampos}${bLig}
        <p class="mt-arquivar"><button type="button" class="btn-link perigo" id="mt-arquivar">Arquivar padrão</button></p></div>
    </div>
    <div class="pg-barra-salvar" id="mt-barra" ${MT.sujo ? '' : 'hidden'}><span>Mudanças não salvas no padrão · valem em todos os cartões ligados depois de salvar</span><div>
      <button type="button" class="u-botao" id="mt-descartar">Descartar</button><button type="button" class="u-botao forte" id="mt-salvar">Salvar</button></div></div>`;
  document.body.classList.toggle('pg-com-barra', MT.sujo);
  ligarBlocos(el);
  mtLigarEditor(el, id);
  mtPrevia();
}
function mtItem(c, i) {
  const aberto = MT.aberto === c.id;
  const auto = c.tipo === 'automatico';
  return `<div class="mt-item${aberto ? ' is-aberto' : ''}${c.tipo === 'secao' ? ' is-secao' : ''}" data-item="${c.id}" data-i="${i}">
    <div class="mt-item__linha">
      <button type="button" class="pg-caixa mt-alca" data-alca="${i}" aria-label="Arrastar para mudar a posição (ou ↑ ↓)" title="Arrastar (ou ↑ ↓)">${MT_IC.alca}</button>
      <button type="button" class="pg-caixa${aberto ? ' is-on' : ''}" data-abrir-item="${c.id}" aria-label="Detalhes do campo" aria-expanded="${aberto}">${MT_IC.lapis}</button>
      <input class="mt-rotulo" data-rotulo="${c.id}" value="${escHtml(c.rotulo || '')}" placeholder="${escHtml(mtNome(MT_CAMPOS, c.tipo))}" aria-label="Rótulo do campo">
      <span class="pg-etq${auto ? ' ardosia' : ''}">${auto ? escHtml(mtNome(MT_AUTO, c.fonte)) : escHtml(mtNome(MT_CAMPOS, c.tipo))}</span>
      <button type="button" class="pg-caixa" data-tirar-item="${c.id}" aria-label="Tirar o campo" title="Tirar o campo">${MT_IC.x}</button>
    </div>${aberto ? `<div class="mt-item__det">${mtDetalhes(c)}</div>` : ''}</div>`;
}
function mtDetalhes(c) {
  const num = (k, rot, v, min, max) => `<label class="u-campo mt-campo-f"><span>${rot}</span><input type="number" min="${min}" max="${max}" data-det="${c.id}|${k}" value="${v}"></label>`;
  const tipo = `<label class="u-campo mt-campo-f"><span>Tipo</span><select data-det="${c.id}|tipo">${MT_CAMPOS.map(([v, n]) => `<option value="${v}" ${v === c.tipo ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
  if (c.tipo === 'automatico') return `${tipo}<label class="u-campo mt-campo-f"><span>Dado</span><select data-det="${c.id}|fonte">${MT_AUTO.map(([v, n]) => `<option value="${v}" ${v === c.fonte ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
  if (c.tipo === 'escolha') return `${tipo}<label class="u-campo mt-campo-f mt-largo"><span>Opções (uma por linha)</span><textarea rows="3" data-det="${c.id}|opcoes">${escHtml((c.opcoes || []).join('\n'))}</textarea></label>`;
  if (c.tipo === 'tabela') return `${tipo}<label class="u-campo mt-campo-f mt-largo"><span>Colunas (separadas por vírgula)</span><input type="text" data-det="${c.id}|colunas" value="${escHtml((c.colunas || []).join(', '))}"></label>${num('linhas', 'Linhas em branco', c.linhas || 3, 1, 40)}`;
  if (c.tipo === 'pessoas') return `${tipo}${num('linhas', 'Linhas em branco', c.linhas || 4, 1, 40)}`;
  if (c.tipo === 'texto_longo') return `${tipo}${num('linhas', 'Linhas para escrever', c.linhas || 4, 1, 40)}`;
  if (c.tipo === 'numero') return `${tipo}<label class="u-campo mt-campo-f"><span>Unidade</span><input type="text" data-det="${c.id}|unidade" value="${escHtml(c.unidade || '')}" maxlength="20" placeholder="m², dias, R$…"></label>`;
  return tipo;
}
function mtMenuTipos(i) {
  return `<div class="mt-tipos" role="menu" aria-label="Que campo">${MT_CAMPOS.map(([v, n]) => `<button type="button" class="u-botao" role="menuitem" data-novo-campo="${i}|${v}">${n}</button>`).join('')}
    <button type="button" class="btn-link" data-cancelar-inserir>cancelar</button></div>`;
}

function mtMudou({ redesenhar = false } = {}) {
  MT.sujo = true;
  const b = document.getElementById('mt-barra'); if (b) b.hidden = false;
  document.body.classList.add('pg-com-barra');
  if (redesenhar) mtDesenharEditor(document.getElementById('materiais'), MT.id); else mtPreviaDepois();
}
function mtLigarEditor(el, id) {
  const r = MT.r;
  el.querySelectorAll('[data-mt-vista]').forEach((b) => b.onclick = () => {
    MT.vista = b.dataset.mtVista; try { localStorage.setItem('pgt:mt-vista', MT.vista); } catch (_) { /* sem armazenamento */ }
    mtDesenharEditor(el, id);
  });
  el.querySelectorAll('[data-mt-folha]').forEach((b) => b.onclick = () => { MT.folha = b.dataset.mtFolha; mtDesenharEditor(el, id); });
  el.querySelectorAll('[data-mt-set]').forEach((b) => b.onclick = () => {
    const [k, v] = b.dataset.mtSet.split('|');
    r[k] = k === 'prova' ? Number(v) : v;
    mtMudou({ redesenhar: true });
  });
  el.querySelectorAll('[data-mt-txt]').forEach((i) => i.oninput = () => {
    r[i.dataset.mtTxt] = i.value;
    if (i.dataset.mtTxt === 'nome') { document.getElementById('titulo').textContent = i.value || 'Padrão'; }
    mtMudou();
  });
  el.querySelectorAll('[data-rotulo]').forEach((i) => i.oninput = () => { r.campos.find((c) => c.id === i.dataset.rotulo).rotulo = i.value; mtMudou(); });
  el.querySelectorAll('[data-abrir-item]').forEach((b) => b.onclick = () => { MT.aberto = MT.aberto === b.dataset.abrirItem ? null : b.dataset.abrirItem; mtDesenharEditor(el, id); });
  el.querySelectorAll('[data-tirar-item]').forEach((b) => b.onclick = () => { r.campos = r.campos.filter((c) => c.id !== b.dataset.tirarItem); mtMudou({ redesenhar: true }); });
  el.querySelectorAll('[data-inserir]').forEach((b) => b.onclick = () => { MT.inserir = Number(b.dataset.inserir); mtDesenharEditor(el, id); });
  el.querySelectorAll('[data-cancelar-inserir]').forEach((b) => b.onclick = () => { MT.inserir = null; mtDesenharEditor(el, id); });
  el.querySelectorAll('[data-novo-campo]').forEach((b) => b.onclick = () => {
    const [i, tipo] = b.dataset.novoCampo.split('|');
    const c = { id: mtNovoId(), tipo, rotulo: tipo === 'automatico' ? 'Projeto' : mtNome(MT_CAMPOS, tipo) };
    if (tipo === 'automatico') c.fonte = 'projeto';
    if (tipo === 'escolha') c.opcoes = ['Sim', 'Não'];
    if (tipo === 'tabela') { c.colunas = ['Assunto', 'Decisão', 'Quem', 'Até']; c.linhas = 3; }
    r.campos = r.campos || []; r.campos.splice(Number(i), 0, c);
    MT.inserir = null; MT.aberto = ['secao', 'texto', 'data', 'marcar', 'assinatura'].includes(tipo) ? null : c.id;
    mtMudou({ redesenhar: true });
    setTimeout(() => { const inp = document.querySelector(`[data-rotulo="${c.id}"]`); if (inp) { inp.focus(); inp.select(); } }, 0);
  });
  el.querySelectorAll('[data-det]').forEach((i) => i.onchange = i.oninput = (ev) => {
    const [cid, k] = i.dataset.det.split('|');
    const c = r.campos.find((x) => x.id === cid);
    if (k === 'opcoes') c.opcoes = i.value.split('\n').map((x) => x.trim()).filter(Boolean);
    else if (k === 'colunas') c.colunas = i.value.split(',').map((x) => x.trim()).filter(Boolean);
    else if (k === 'linhas') c.linhas = Math.max(1, Math.min(40, Number(i.value) || 1));
    else c[k] = i.value;
    if (k === 'tipo' || k === 'fonte') { if (k === 'tipo' && i.value === 'automatico' && !c.fonte) c.fonte = 'projeto'; if (ev.type === 'change') mtMudou({ redesenhar: true }); return; }
    mtMudou();
  });
  // arrastar pela alça (com o teclado: ↑ ↓ na alça)
  const pilha = el.querySelector('[data-mt-pilha]');
  let de = null;
  const mover = (a, b) => { const [c] = r.campos.splice(a, 1); r.campos.splice(b, 0, c); mtMudou({ redesenhar: true }); };
  pilha.querySelectorAll('[data-alca]').forEach((h) => {
    const item = h.closest('.mt-item');
    h.addEventListener('mousedown', () => { item.draggable = true; });
    h.addEventListener('keydown', (ev) => {
      const i = Number(h.dataset.alca);
      if (ev.key === 'ArrowUp' && i > 0) { ev.preventDefault(); mover(i, i - 1); setTimeout(() => document.querySelector(`[data-alca="${i - 1}"]`)?.focus(), 0); }
      if (ev.key === 'ArrowDown' && i < r.campos.length - 1) { ev.preventDefault(); mover(i, i + 1); setTimeout(() => document.querySelector(`[data-alca="${i + 1}"]`)?.focus(), 0); }
    });
  });
  pilha.addEventListener('dragstart', (ev) => { const it = ev.target.closest('.mt-item'); if (!it) return; de = Number(it.dataset.i); it.classList.add('is-arrastando'); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', String(de)); });
  pilha.addEventListener('dragend', () => { pilha.querySelectorAll('.mt-item').forEach((x) => { x.draggable = false; x.classList.remove('is-arrastando', 'alvo-acima', 'alvo-abaixo'); }); });
  pilha.addEventListener('dragover', (ev) => {
    if (de === null) return;
    ev.preventDefault();
    const it = ev.target.closest('.mt-item'); pilha.querySelectorAll('.mt-item').forEach((x) => x.classList.remove('alvo-acima', 'alvo-abaixo'));
    if (!it) return;
    const r0 = it.getBoundingClientRect();
    it.classList.add(ev.clientY < r0.top + r0.height / 2 ? 'alvo-acima' : 'alvo-abaixo');
  });
  pilha.addEventListener('drop', (ev) => {
    ev.preventDefault();
    const it = ev.target.closest('.mt-item'); if (de === null || !it) return;
    let para = Number(it.dataset.i); const r0 = it.getBoundingClientRect();
    if (ev.clientY >= r0.top + r0.height / 2) para += 1;
    if (para > de) para -= 1;
    const a = de; de = null;
    if (para !== a) mover(a, para);
  });
  // ligações
  el.querySelectorAll('[data-ir]').forEach((a) => a.onclick = (ev) => { ev.preventDefault(); irAoCartao(a.dataset.ir); });
  el.querySelectorAll('[data-desligar]').forEach((b) => b.onclick = async () => {
    b.disabled = true;
    try { await arquivarRegistro(D.materiais.find((x) => x.id === b.dataset.desligar)); await recarregar(); } catch (err) { aviso(mensagemDe(err)); b.disabled = false; }
  });
  el.querySelector('#mt-ligar').onclick = () => mtAbrirLigar(id);
  // salvar, descartar, arquivar
  el.querySelector('#mt-descartar').onclick = () => { MT.r = null; MT.sujo = false; document.body.classList.remove('pg-com-barra'); mtDesenharEditor(el, id); };
  el.querySelector('#mt-salvar').onclick = mtSalvar;
  el.querySelector('#mt-arquivar').onclick = async () => {
    const n = mtLigacoes(id).length;
    if (!confirm(`Arquivar o padrão «${r.nome}»?${n ? ` Ele sai dos ${n} cartões ligados.` : ''} Fica nos arquivados e pode ser restaurado.`)) return;
    try { await arquivarRegistro(mtModelo(id)); MT.r = null; MT.sujo = false; await recarregar(); location.hash = '#materiais'; } catch (err) { aviso(mensagemDe(err)); }
  };
}
async function mtSalvar() {
  const r = MT.r; const m = mtModelo(MT.id);
  if (!r.nome.trim()) { aviso('Dê um nome ao padrão.'); return; }
  const b = document.getElementById('mt-salvar'); if (b) b.disabled = true;
  try {
    await Universo.alterar('pgt-modelos', MT.id, { versao: m.versao, nome: r.nome.trim(), tipo: r.tipo, descricao: r.descricao || null, folha: r.folha,
      miolo: r.miolo, preenche: r.preenche, prova: r.prova ? 1 : 0, campos: r.campos || [] });
    // o nome das ligações acompanha o do padrão (a lista de materiais dos cartões mostra o nome)
    for (const l of mtLigacoes(MT.id)) if (l.nome !== r.nome.trim() || l.tipo !== (r.tipo === 'modelo' ? 'modelo' : r.tipo)) {
      await Universo.alterar('pgt-materiais', l.id, { versao: l.versao, nome: r.nome.trim(), tipo: r.tipo === 'modelo' ? 'modelo' : r.tipo });
    }
    MT.r = null; MT.sujo = false; document.body.classList.remove('pg-com-barra');
    aviso('Padrão salvo. Vale nos projetos a partir da próxima versão publicada do PGT.', 'ok'); setTimeout(() => aviso(''), 3500);
    await recarregar();
  } catch (err) { aviso(mensagemDe(err)); if (b) b.disabled = false; }
}
document.addEventListener('keydown', (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's' && MT.sujo && MT.id) { ev.preventDefault(); ev.stopImmediatePropagation(); mtSalvar(); }
}, true);
window.addEventListener('beforeunload', (ev) => { if (MT.sujo) { ev.preventDefault(); ev.returnValue = ''; } });

// ---------------------------------------------------------------- ligar a cartões (de qualquer fase e serviço)
function mtAbrirLigar(id) {
  const m = mtModelo(id);
  const ja = new Map(mtLigacoes(id).map((l) => [l.alvo_id, l]));
  const marcados = new Set(ja.keys());
  const st = { srv: '', q: '' };
  const dlg = document.createElement('dialog');
  dlg.className = 'mt-dialogo';
  document.body.appendChild(dlg);
  const desenhar = () => {
    const vale = (x) => !st.srv || (x.servicos && x.servicos[st.srv] && (x.servicos[st.srv].pertinencia || x.servicos[st.srv]));
    const casa = (t) => !st.q || semAcento(t).includes(semAcento(st.q));
    const fases = D.fases.map((fa) => {
      const etapas = D.etapas.filter((e) => e.fase_id === fa.id).map((e) => {
        const itens = [...D.entregaveis.filter((x) => x.etapa_id === e.id), ...D.eventos.filter((x) => x.etapa_id === e.id && !x.encerramento)]
          .filter((x) => vale(x) && casa(`${x.codigo} ${x.texto || x.nome} ${e.sigla} ${e.nome}`));
        if (!itens.length && !(vale(e) && casa(`${e.sigla} ${e.nome}`))) return '';
        const caixa = (alvo, rot, cls = '') => `<label class="mt-alvo ${cls}"><input type="checkbox" data-alvo-lig="${alvo}" ${marcados.has(alvo) ? 'checked' : ''}> ${rot}</label>`;
        return `<div class="mt-alvo-etapa">${caixa(e.id, `<b>${escHtml(e.sigla)}</b> ${escHtml(e.nome)} <span class="pg-apoio">(a etapa)</span>`, 'is-etapa')}
          ${itens.map((x) => caixa(x.id, `<b>${escHtml(x.codigo)}</b> ${escHtml(x.texto || x.nome)}`)).join('')}</div>`;
      }).join('');
      return etapas ? `<div class="mt-alvo-fase"><div class="u-rotulo">${escHtml(fa.nome)}</div>${etapas}</div>` : '';
    }).join('');
    const novos = [...marcados].filter((a) => !ja.has(a)).length; const sai = [...ja.keys()].filter((a) => !marcados.has(a)).length;
    dlg.innerHTML = `<div class="mt-dlg__cab"><h3>Ligar «${escHtml(m.nome)}»</h3><button type="button" class="pg-caixa" data-fechar aria-label="Fechar">${MT_IC.x}</button></div>
      <div class="pg-filtros mt-dlg__filtros"><select data-f-srv aria-label="Serviço"><option value="">Todos os serviços</option>${D.servicos.map((s) => `<option value="${s.id}" ${s.id === st.srv ? 'selected' : ''}>${escHtml(s.sigla + ' · ' + s.nome)}</option>`).join('')}</select>
        <input type="search" data-f-q placeholder="Buscar etapa, entrega ou evento" value="${escHtml(st.q)}"></div>
      <div class="mt-dlg__lista">${fases || '<div class="pg-vazio">Nada com esses filtros.</div>'}</div>
      <div class="mt-dlg__pe"><span class="pg-apoio">${marcados.size} marcado${marcados.size === 1 ? '' : 's'}${novos ? ` · ${novos} a ligar` : ''}${sai ? ` · ${sai} a desligar` : ''}</span>
        <span><button type="button" class="u-botao" data-fechar>Cancelar</button> <button type="button" class="u-botao forte" data-aplicar ${novos || sai ? '' : 'disabled'}>Aplicar</button></span></div>`;
    dlg.querySelectorAll('[data-fechar]').forEach((b) => b.onclick = () => dlg.close());
    dlg.querySelector('[data-f-srv]').onchange = (ev) => { st.srv = ev.target.value; desenhar(); };
    const q = dlg.querySelector('[data-f-q]');
    q.oninput = () => { st.q = q.value; const pos = q.selectionStart; desenhar(); const n = dlg.querySelector('[data-f-q]'); n.focus(); n.setSelectionRange(pos, pos); };
    dlg.querySelectorAll('[data-alvo-lig]').forEach((c) => c.onchange = () => { c.checked ? marcados.add(c.dataset.alvoLig) : marcados.delete(c.dataset.alvoLig); desenhar(); });
    dlg.querySelector('[data-aplicar]').onclick = async (ev) => {
      ev.currentTarget.disabled = true;
      try {
        const tipo = m.tipo === 'modelo' ? 'modelo' : m.tipo;
        for (const a of marcados) if (!ja.has(a)) await Universo.criar('pgt-materiais', { alvo_id: a, modelo_id: m.id, tipo, nome: m.nome });
        for (const [a, l] of ja) if (!marcados.has(a)) await arquivarRegistro(l);
        dlg.close(); await recarregar();
      } catch (err) { aviso(mensagemDe(err)); ev.currentTarget.disabled = false; }
    };
  };
  dlg.addEventListener('close', () => dlg.remove());
  desenhar();
  dlg.showModal();
}
