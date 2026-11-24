// ==========================================================================
// Passos do orçamento (projeto → escopo → complexidade → cronograma → honorários → cliente e emissão → revisão).
// Definição dos passos. Cada etapa expõe:
//   render(state, data)              -> string HTML
//   bind(container, state, data, ctx) -> liga os eventos daquele HTML
//   validate(state)                  -> true | string (mensagem de erro)
// ctx = { rerender(), updateTicket() }
// ==========================================================================

function checkSvg() {
  return '<svg viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function segmented(name, options, current) {
  return `<div class="segmented" data-seg="${name}">` +
    options.map((opt, i) => `
      <input type="radio" name="${name}" id="${name}-${i}" value="${opt.value}" ${String(current) === String(opt.value) ? 'checked' : ''}>
      <label for="${name}-${i}">${opt.label}</label>
    `).join('') +
    `</div>`;
}

function maskTelefone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function maskDocumento(v, tipo) {
  const d = v.replace(/\D/g, '');
  if (tipo === 'PJ') {
    const s = d.slice(0, 14);
    let out = s.slice(0, 2);
    if (s.length > 2) out += '.' + s.slice(2, 5);
    if (s.length > 5) out += '.' + s.slice(5, 8);
    if (s.length > 8) out += '/' + s.slice(8, 12);
    if (s.length > 12) out += '-' + s.slice(12, 14);
    return out;
  }
  const s = d.slice(0, 11);
  let out = s.slice(0, 3);
  if (s.length > 3) out += '.' + s.slice(3, 6);
  if (s.length > 6) out += '.' + s.slice(6, 9);
  if (s.length > 9) out += '-' + s.slice(9, 11);
  return out;
}

const IC_LABELS = { baixo: 0.7, medio: 1.0, alto: 1.3 };
function dataValidaOuVazia(valor) {
  if (!valor) return '';
  const m = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return '';
  const ano = parseInt(m[1], 10);
  if (m[1].length !== 4 || ano < 2020 || ano > 2035) return '';
  return valor;
}

// Ordem fixa dos 11 critérios — index casa com data/ic-criterios.json.
// 'empenho_porte' e 'grau_detalhamento' NÃO são mais preenchidos manualmente:
// são calculados a partir do escopo/etapas selecionados (ver recomputeIndicadores).
const IC_KEYS_ALL = ['empenho_porte', 'qtd_especialistas', 'qtd_aprovacoes', 'grau_detalhamento', 'grau_resp_civil', 'grau_intervencao_cliente', 'expectativa_plastica', 'grau_controle_custo', 'indefinicao_escopo', 'indefinicao_prazo', 'demanda_midia'];
const MANUAL_COMPLEXIDADE_KEYS = ['qtd_especialistas', 'qtd_aprovacoes', 'grau_resp_civil', 'grau_intervencao_cliente', 'expectativa_plastica', 'grau_controle_custo', 'indefinicao_prazo', 'demanda_midia'];

// Faixas de repetição iguais às da tabela do CAU (data/redutor-repeticao.json): o valor guardado é o início
// da faixa, e o redutor é o da linha "a partir de" correspondente (0 → 1,00 · 1 → 0,98 · 2 a 3 → 0,94 · …).
// Antes (até nov/2026) as faixas eram "1 a 2", "3 a 4"… e aplicavam o redutor do topo da faixa a ela toda.
const REPETICOES_FAIXAS = [
  { label: 'Nenhuma', value: 0 },
  { label: '1', value: 1 },
  { label: '2 a 3', value: 2 },
  { label: '4 a 7', value: 4 },
  { label: '8 a 15', value: 8 },
  { label: '16 a 31', value: 16 },
  { label: '32 a 63', value: 32 },
  { label: '64 a 127', value: 64 },
  { label: '128 ou mais', value: 128 }
];
// rascunhos antigos guardam o topo da faixa antiga (2, 4, … 129): mostra a faixa nova que dá o mesmo redutor
const faixaRepeticao = (n) => REPETICOES_FAIXAS.filter((f) => f.value <= (n || 0)).pop().value;


const PRAZO_CLIENTE_OPCOES = [
  { label: '30 dias', semanas: 4 },
  { label: '2 meses', semanas: 8 },
  { label: '4 meses', semanas: 16 },
  { label: '6 meses', semanas: 24 },
  { label: '12 meses', semanas: 48 },
  { label: '1 ano e 6 meses', semanas: 72 },
  { label: '2 anos', semanas: 96 },
  { label: 'Indefinido', semanas: null }
];

// ---------- serviço, tipologia e escopo padrão (tudo vem do catálogo publicado) ----------
const labelIc = (v) => (v === 0.7 ? 'baixo' : v === 1.3 ? 'alto' : 'medio');
const nivel = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// IC padrão: preset da categoria da tipologia + ajustes do serviço. Empenho e detalhamento são calculados.
function aplicarIcPadrao(state) {
  const p = Catalogo.icPadrao(state.servicoId, state.categoriaId);
  for (const [k, v] of Object.entries(p)) if (IC_LABELS[v] != null) state.icValores[k] = IC_LABELS[v];
  recomputeIndicadores(state);
}

// Serviço novo: etapas e entregas pertinentes (P) marcadas, opcionais (O) desmarcadas, prazos do PGT.
function aplicarServico(state) {
  const etapas = Catalogo.etapasDoServico(state.servicoId);
  state.etapasSelecionadas = etapas.filter(e => e.pert === 'P').map(e => e.id);
  state.entregasSelecionadas = {};
  for (const e of etapas) state.entregasSelecionadas[e.id] = Catalogo.entregasPadrao(e.id, state.servicoId, state.categoriaId);
  state.clausulasSelecionadas = [];
  state.semanasManual = {};
  const cat = Catalogo.atual();
  if (cat && cat.parcelaEntrada != null) state.pctEntrada = cat.parcelaEntrada;
  aplicarIcPadrao(state);
}

// Categoria nova: mantém as entregas marcadas que continuam valendo e marca as pertinentes que passaram a valer.
function ajustarEntregasACategoria(state) {
  for (const e of Catalogo.etapasDoServico(state.servicoId)) {
    const validas = Catalogo.entregasDaEtapa(e.id, state.servicoId, state.categoriaId);
    const antes = state.entregasSelecionadas[e.id] || [];
    state.entregasSelecionadas[e.id] = validas.filter(x => antes.includes(x.id) || (x.pert === 'P' && x.categorias && x.categorias.length)).map(x => x.id);
  }
}

// Indicadores calculados do IC: detalhamento pelas etapas executivas; empenho pela quantidade de entregas.
// NOTA: os cortes do empenho (3 / 4-6 / 7+) vêm da lista antiga de escopo e seguem pendentes de recalibração.
function recomputeIndicadores(state) {
  const siglas = state.etapasSelecionadas.map(id => (Catalogo.etapa(id) || {}).sigla);
  const det = siglas.includes('DE') ? 'alto' : (siglas.includes('PE') || siglas.includes('PX')) ? 'medio' : 'baixo';
  const n = state.etapasSelecionadas.reduce((s, id) => s + (state.entregasSelecionadas[id] || []).length, 0);
  const emp = n <= 3 ? 'baixo' : n <= 6 ? 'medio' : 'alto';
  state.icValores.grau_detalhamento = IC_LABELS[det];
  state.icValores.empenho_porte = IC_LABELS[emp];
  return { det, emp, n };
}

const STEPS = [];

// Bloco "Ligado ao Universo" / busca de cliente cadastrado (passo Cliente).
function ligarVinculoUniverso(el, state, ctx) {
  const texto = el.querySelector('#vinculo-texto');
  if (texto) {
    (async () => {
      try {
        if (state._oportunidadeId) {
          const o = await Universo.ler('oportunidades', state._oportunidadeId);
          texto.innerHTML = `Oportunidade <a href="crm.html#${o.id}">${escHtml(o.titulo)}</a> · ${escHtml(nomeDe(ETAPAS_FUNIL, o.etapa_funil))}`;
        } else {
          const t = state._clienteId.startsWith('org_') ? 'organizacoes' : 'pessoas';
          const c = await Universo.ler(t, state._clienteId);
          texto.textContent = `Cliente: ${c.nome}`;
        }
      } catch (e) {
        texto.textContent = `Não consegui carregar a ligação (${e.message}).`;
      }
    })();
  }
  const desligar = el.querySelector('#btn-desligar');
  if (desligar) desligar.onclick = () => {
    if (!confirm('Desligar este orçamento do cliente e da oportunidade? Os campos preenchidos continuam.')) return;
    Object.assign(state, { _oportunidadeId: null, _clienteId: null, _revisaoDe: null, _revisaoDeCodigo: null });
    ctx.rerender();
  };

  const busca = el.querySelector('#f-busca-cliente');
  if (!busca) return;
  const res = el.querySelector('#busca-cliente-res');
  let tempo = null;
  busca.oninput = () => {
    clearTimeout(tempo);
    const q = busca.value.trim();
    if (q.length < 2) { res.innerHTML = ''; return; }
    tempo = setTimeout(async () => {
      try {
        const [p, o] = await Promise.all([Universo.buscar(q, 'pessoas'), Universo.buscar(q, 'organizacoes')]);
        const itens = [...o.itens, ...p.itens];
        res.innerHTML = itens.length
          ? itens.map(i => `<button type="button" class="busca-res__item" data-id="${i.id}">${escHtml(i.titulo)} <span class="small muted">${i.tabela === 'organizacoes' ? 'empresa' : 'pessoa'}</span></button>`).join('')
          : '<p class="small muted">Ninguém encontrado — o cliente será cadastrado ao finalizar.</p>';
        res.querySelectorAll('[data-id]').forEach(b => b.onclick = async () => {
          const id = b.dataset.id;
          const tabela = id.startsWith('org_') ? 'organizacoes' : 'pessoas';
          const c = await Universo.ler(tabela, id);
          state._clienteId = id;
          state.cliente.nome = c.nome || '';
          state.cliente.email = c.email || '';
          state.cliente.telefone = Comercial.fmtTel(c.telefone || c.whatsapp || '');
          if (tabela === 'organizacoes') {
            state.cliente.representacao = 'PJ';
            if (c.cnpj) state.cliente.documento = Comercial.fmtCnpj(c.cnpj);
          } else {
            state.cliente.representacao = 'PF';
            const s = await Universo.talvez('pessoas-sensiveis', id).catch(() => null);
            if (s && s.cpf) state.cliente.documento = Comercial.fmtCpf(s.cpf);
          }
          ctx.rerender();
        });
      } catch (e) {
        res.innerHTML = `<p class="small muted">Não consegui buscar agora (${escHtml(e.message)}).</p>`;
      }
    }, 300);
  };
}



// -------------------------------------------------------------------------
// 1. Projeto — o que se vai projetar (o cliente fica para o fim)
// -------------------------------------------------------------------------
STEPS.push({
  id: 'projeto',
  title: 'Projeto',
  desc: 'O que vai ser projetado: serviço, tipologia, imóvel, entendimento, expectativas do cliente e áreas. Serviços, tipologias e etapas vêm do Plano Geral de Trabalho e das Bases publicados no Universo.',
  render(state) {
    const cat = Catalogo.atual();
    const srv = Catalogo.servico(state.servicoId);
    const grupos = {};
    for (const c of cat.categorias) (grupos[c.grupo] ||= []).push(c);
    const usos = cat.usos.filter(u => u.categoria_id === state.categoriaId);
    const critEscopo = DATA.icCriterios[8];
    const escLabel = labelIc(state.icValores.indefinicao_escopo);
    const im = state.imovel;
    return `
      <div class="field-group">
        <h3 class="bloco__titulo">Serviço e tipologia</h3>
        <div class="field">
          <label class="field__label">Serviço</label>
          <select id="f-servico"><option value="">Selecione…</option>
            ${cat.servicos.map(s => `<option value="${s.id}" ${state.servicoId === s.id ? 'selected' : ''}>${escHtml(s.sigla)} · ${escHtml(s.nome)}</option>`).join('')}</select>
          <p class="field__hint">${srv ? escHtml(srv.descricao || '') + (srv.com_preco ? '' : ' Este serviço não tem preço calculado: o valor é informado em Referências › Serviços.') : 'Define as etapas, as entregas e o padrão de complexidade, tudo ajustável depois.'}</p>
        </div>
        <div class="row-2">
          <div class="field">
            <label class="field__label">Categoria</label>
            <select id="f-categoria"><option value="">Selecione…</option>
              ${Object.entries(grupos).map(([g, l]) => `<optgroup label="${escHtml(Catalogo.GRUPOS[g] || g)}">${l.map(c => `<option value="${c.id}" ${state.categoriaId === c.id ? 'selected' : ''}>${escHtml(c.nome)}</option>`).join('')}</optgroup>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field__label">Uso (tipologia)</label>
            <select id="f-uso" ${usos.length ? '' : 'disabled'}><option value="">${state.categoriaId ? 'Selecione…' : 'Escolha a categoria primeiro'}</option>
              ${usos.map(u => `<option value="${u.id}" ${state.usoId === u.id ? 'selected' : ''}>${escHtml(u.item)} · ${escHtml(u.descricao)}</option>`).join('')}</select>
            <p class="field__hint">Item da tabela do CAU: define o CUB, o fator de adequação e a categoria do fator percentual.</p>
          </div>
        </div>
      </div>
      <div class="field-group">
        <h3 class="bloco__titulo">Imóvel</h3>
        <div class="row-2">
          <div class="field"><label class="field__label">CEP</label><input type="text" id="f-cep" value="${escHtml(im.cep || '')}" placeholder="58000-000" maxlength="9"><p class="field__hint" id="cep-status"></p></div>
          <div class="field"><label class="field__label">Bairro</label><input type="text" id="f-bairro" value="${escHtml(im.bairro || '')}"></div>
        </div>
        <div class="field"><label class="field__label">Logradouro</label><input type="text" id="f-logradouro" value="${escHtml(im.logradouro || '')}" placeholder="Preenchido pelo CEP; edite se precisar"></div>
        <div class="row-2">
          <div class="field"><label class="field__label">Número</label><input type="text" id="f-numero-end" value="${escHtml(im.numero || '')}"></div>
          <div class="field"><label class="field__label">Complemento</label><input type="text" id="f-complemento" value="${escHtml(im.complemento || '')}" placeholder="Apto, bloco, sala…"></div>
        </div>
        <div class="field"><label class="field__label">Cidade – UF</label><input type="text" id="f-cidade-uf" value="${escHtml(im.cidadeUf || '')}"></div>
      </div>
      <div class="field-group">
        <h3 class="bloco__titulo">Entendimento do projeto</h3>
        <div class="field">
          <textarea id="f-entendimento" aria-label="Entendimento do projeto" rows="8" placeholder="Ex.: O projeto arquitetônico objeto desta proposta trata-se de…">${escHtml(state.entendimentoProjeto || '')}</textarea>
        </div>
      </div>
      <div class="field-group">
        <h3 class="bloco__titulo">Expectativas do cliente</h3>
        <div class="row-2">
          <div class="field">
            <label class="field__label">Teto orçamentário informado pelo cliente (opcional)</label>
            <input type="text" inputmode="numeric" id="f-teto" value="${escHtml(state.tetoOrcamentario || '')}" placeholder="Só números; a formatação é automática">
          </div>
          <div class="field">
            <label class="field__label">Prazo esperado pelo cliente (opcional)</label>
            <select id="f-prazo-cliente"><option value="">Não informado</option>
              ${PRAZO_CLIENTE_OPCOES.map(o => `<option value="${o.label}" ${state.prazoEsperadoCliente === o.label ? 'selected' : ''}>${o.label}</option>`).join('')}</select>
          </div>
        </div>
      </div>
      <div class="field-group">
        <h3 class="bloco__titulo">Áreas e escopo</h3>
        <div class="row-2">
          <div class="field"><label class="field__label">Área do imóvel ou terreno (m²)</label><input type="number" min="0" step="1" id="f-area-terreno" value="${state.areaTerreno || ''}"></div>
          <div class="field"><label class="field__label">Área edificada prevista (m²)</label><input type="number" min="0" step="1" id="f-area" value="${state.areaConstruida || ''}"></div>
        </div>
        <div class="row-2">
          <div class="field"><label class="field__label">Contagem de repetições</label>
            <select id="f-repeticoes">${REPETICOES_FAIXAS.map(f => `<option value="${f.value}" ${faixaRepeticao(state.contagemRepeticoes) === f.value ? 'selected' : ''}>${f.label}</option>`).join('')}</select>
            <p class="field__hint">Unidades ou áreas que se repetem integralmente no mesmo projeto.</p></div>
          <div class="field"><label class="field__label">Área externa de intervenção (m²)</label><input type="number" min="0" step="1" id="f-area-ext" value="${state.areaExterna || ''}"></div>
        </div>
        <div class="field">
          <label class="field__label">${critEscopo.criterio}</label>
          ${segmented('ic-indefinicao_escopo', [{ value: 'baixo', label: 'Baixo' }, { value: 'medio', label: 'Médio' }, { value: 'alto', label: 'Alto' }], escLabel)}
          <p class="field__hint" id="ic-hint-indefinicao_escopo">${critEscopo[escLabel]}</p>
        </div>
      </div>
    `;
  },
  bind(el, state, data, ctx) {
    el.querySelector('#f-servico').onchange = e => {
      state.servicoId = e.target.value;
      aplicarServico(state);
      ctx.rerender();
    };
    el.querySelector('#f-categoria').onchange = e => {
      state.categoriaId = e.target.value;
      state.usoId = '';
      ajustarEntregasACategoria(state);
      aplicarIcPadrao(state);
      ctx.rerender();
    };
    el.querySelector('#f-uso').onchange = e => { state.usoId = e.target.value; ctx.updateTicket(); };
    el.querySelector('#f-entendimento').oninput = e => { state.entendimentoProjeto = e.target.value; ctx.updateTicket(); };
    el.querySelector('#f-area').oninput = e => { state.areaConstruida = parseFloat(e.target.value) || 0; ctx.updateTicket(); };
    el.querySelector('#f-area-ext').oninput = e => { state.areaExterna = parseFloat(e.target.value) || 0; ctx.updateTicket(); };
    el.querySelector('#f-area-terreno').oninput = e => { state.areaTerreno = parseFloat(e.target.value) || 0; };
    el.querySelector('#f-repeticoes').onchange = e => { state.contagemRepeticoes = parseInt(e.target.value, 10) || 0; ctx.updateTicket(); };
    const crit = data.icCriterios[8];
    el.querySelectorAll('input[name="ic-indefinicao_escopo"]').forEach(r => {
      r.onchange = e => { state.icValores.indefinicao_escopo = IC_LABELS[e.target.value]; el.querySelector('#ic-hint-indefinicao_escopo').textContent = crit[e.target.value]; ctx.updateTicket(); };
    });
    const im = state.imovel;
    for (const [id, k] of [['#f-numero-end', 'numero'], ['#f-logradouro', 'logradouro'], ['#f-complemento', 'complemento'], ['#f-bairro', 'bairro'], ['#f-cidade-uf', 'cidadeUf']]) {
      el.querySelector(id).oninput = e => { im[k] = e.target.value; };
    }
    const cepStatus = el.querySelector('#cep-status');
    el.querySelector('#f-cep').oninput = e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 8);
      if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
      e.target.value = v;
      im.cep = v;
      if (v.replace(/\D/g, '').length === 8) buscarCep(v.replace(/\D/g, ''));
    };
    async function buscarCep(cep) {
      cepStatus.textContent = 'Buscando endereço…';
      try {
        const d = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
        if (d.erro) { cepStatus.textContent = 'CEP não encontrado; preencha à mão.'; return; }
        im.logradouro = d.logradouro || ''; im.bairro = d.bairro || ''; im.cidadeUf = d.localidade && d.uf ? `${d.localidade} – ${d.uf}` : '';
        el.querySelector('#f-logradouro').value = im.logradouro;
        el.querySelector('#f-bairro').value = im.bairro;
        el.querySelector('#f-cidade-uf').value = im.cidadeUf;
        cepStatus.textContent = 'Endereço preenchido; confira.';
      } catch (_) { cepStatus.textContent = 'Não consegui buscar o CEP agora; preencha à mão.'; }
    }
    el.querySelector('#f-teto').oninput = e => {
      const digits = e.target.value.replace(/\D/g, '');
      if (!digits) { state.tetoOrcamentario = ''; state.tetoOrcamentarioNumero = 0; e.target.value = ''; ctx.updateTicket(); return; }
      const valor = parseInt(digits, 10) / 100;
      e.target.value = state.tetoOrcamentario = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      state.tetoOrcamentarioNumero = valor;
      ctx.updateTicket();
    };
    el.querySelector('#f-prazo-cliente').onchange = e => { state.prazoEsperadoCliente = e.target.value; ctx.updateTicket(); };
  },
  validate(state) {
    const srv = Catalogo.servico(state.servicoId);
    if (!srv) return 'Escolha o serviço.';
    if (srv.com_preco && !state.usoId) return 'Escolha a tipologia (categoria e uso).';
    if (srv.com_preco && !(state.areaConstruida > 0)) return 'Informe a área edificada prevista.';
    if (!state.entendimentoProjeto || state.entendimentoProjeto.trim().length < 10) return 'Escreva o entendimento do projeto.';
    return true;
  }
});

// -------------------------------------------------------------------------
// 2. Escopo — etapas, entregas e cláusulas do PGT
// -------------------------------------------------------------------------
STEPS.push({
  id: 'escopo',
  title: 'Escopo',
  desc: 'Etapas e entregas do Plano Geral de Trabalho para este serviço. As pertinentes já vêm marcadas; as opcionais aparecem desmarcadas. O percentual do honorário se ajusta às etapas contratadas.',
  render(state) {
    const srv = Catalogo.servico(state.servicoId);
    if (!srv) return '<p class="muted">Escolha o serviço em Projeto para ver as etapas.</p>';
    const etapas = Catalogo.etapasDoServico(state.servicoId);
    if (!etapas.length) return '<p class="muted">Este serviço não tem etapas no Plano Geral de Trabalho publicado.</p>';
    const pct = Catalogo.percentual(state.servicoId, state.etapasSelecionadas);
    const fases = [];
    for (const e of etapas) {
      let f = fases.find(x => x.id === e.fase_id);
      if (!f) fases.push(f = { ...e.fase, etapas: [] });
      f.etapas.push(e);
    }
    const tag = (p) => (p === 'O' ? '<span class="tag-opcional">opcional</span>' : '');
    const clausulas = Catalogo.clausulas(state.etapasSelecionadas, state.servicoId);
    return `
      <div class="field-group">
        <h3 class="bloco__titulo">Etapas e entregas</h3>
        ${fases.map(f => {
          const ids = f.etapas.map(e => e.id);
          const todas = ids.every(id => state.etapasSelecionadas.includes(id)), alguma = ids.some(id => state.etapasSelecionadas.includes(id));
          return `<div class="fase-group">
            <label class="check-row check-row__toggle fase-toggle ${!todas && alguma ? 'fase-toggle--indeterminado' : ''}">
              <input type="checkbox" data-fase="${f.id}" ${todas ? 'checked' : ''}><span class="check-row__box">${checkSvg()}</span>
              <span class="check-row__text fase-toggle__text">${escHtml(Catalogo.nomeFase(f))}${pct.porEtapa && f.pesos[state.servicoId] ? ` <span class="small muted">· ${f.acrescimo ? 'acréscimo ' : ''}${f.pesos[state.servicoId]}% do projeto</span>` : ''}</span>
            </label>
            <div class="fase-etapas">${f.etapas.map(e => {
              const on = state.etapasSelecionadas.includes(e.id);
              const ents = Catalogo.entregasDaEtapa(e.id, state.servicoId, state.categoriaId);
              const sel = state.entregasSelecionadas[e.id] || [];
              const fr = on ? (pct.noProjeto[e.id] || 0) : Catalogo.fracaoSeMarcada(e.id, state.servicoId, state.etapasSelecionadas);
              return `<div class="etapa-row ${on ? '' : 'etapa-row--off'}">
                  <label class="check-row check-row__toggle"><input type="checkbox" data-etapa="${e.id}" ${on ? 'checked' : ''}><span class="check-row__box">${checkSvg()}</span>
                    <span class="check-row__text"><b class="sigla">${escHtml(e.sigla)}</b> ${escHtml(e.nome)} ${tag(e.pert)}</span></label>
                  <span class="etapa-meta small muted" title="fração do honorário do projeto${on ? '' : ' se marcada'}">${pct.porEtapa ? (on ? fmtPct(fr) : `<i>${fmtPct(fr)}</i>`) : ''}${on ? ` · ${sel.length}/${ents.length}` : ''}</span>
                </div>
                ${on ? `<div class="entregaveis-list">${ents.map(x => `
                  <label class="check-row check-row--sub"><input type="checkbox" data-entrega="${e.id}::${x.id}" ${sel.includes(x.id) ? 'checked' : ''}><span class="check-row__box">${checkSvg()}</span>
                    <span class="check-row__text small"><span class="codigo">${escHtml(x.codigo)}</span> ${escHtml(x.texto)} ${tag(x.pert)}</span></label>`).join('') || '<p class="small muted">Sem entregas para este serviço.</p>'}</div>` : ''}`;
            }).join('')}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="field-group">
        <h3 class="bloco__titulo">Cláusulas</h3>
        <p class="field__hint" style="margin-bottom:12px">Vêm dos eventos das etapas contratadas. As obrigatórias já estão incluídas; as opcionais entram na proposta (e o evento no escopo) quando marcadas.</p>
        ${clausulas.length ? clausulas.map(c => {
          const on = c.pert === 'P' || state.clausulasSelecionadas.includes(c.id);
          const n = state.clausulasQtd[c.id];
          return `<div class="clausula-row">
            <label class="check-row ${c.pert === 'P' ? 'is-travado' : ''}"><input type="checkbox" data-clausula="${c.id}" ${on ? 'checked' : ''} ${c.pert === 'P' ? 'disabled' : ''}><span class="check-row__box">${checkSvg()}</span>
              <span class="check-row__text small">${escHtml(Catalogo.textoClausula(c.clausula, n))} <span class="codigo">${escHtml(c.codigo)}</span> ${c.pert === 'P' ? '<span class="tag-obrigatoria">obrigatória</span>' : ''}</span></label>
            ${on && Catalogo.temQuantidade(c.clausula) ? `<input type="number" min="1" step="1" class="clausula-n" data-qtd="${c.id}" value="${n != null ? n : ''}" placeholder="N">` : ''}
          </div>`;
        }).join('') : '<p class="small muted">Nenhuma cláusula nas etapas marcadas.</p>'}
        <p class="clausulas__sub">Despesas reembolsáveis</p>
        <p class="field__hint" style="margin:0 0 10px">Ficam por conta do cliente e entram na proposta quando marcadas. Textos em Contratos › Gestor de cláusulas.</p>
        ${Catalogo.despesas().map(dr => `<label class="check-row"><input type="checkbox" data-despesa="${dr.id}" ${(state.despesasReembolsaveisSelecionadas || []).includes(dr.id) ? 'checked' : ''}><span class="check-row__box">${checkSvg()}</span><span class="check-row__text small">${escHtml(dr.texto)}</span></label>`).join('') || '<p class="small muted">Nenhuma despesa cadastrada.</p>'}
      </div>
    `;
  },
  bind(el, state, data, ctx) {
    const marcarEtapa = (id, on) => {
      const ja = state.etapasSelecionadas.includes(id);
      if (on && !ja) {
        state.etapasSelecionadas.push(id);
        if (!state.entregasSelecionadas[id] || !state.entregasSelecionadas[id].length) state.entregasSelecionadas[id] = Catalogo.entregasPadrao(id, state.servicoId, state.categoriaId);
      }
      if (!on && ja) state.etapasSelecionadas = state.etapasSelecionadas.filter(x => x !== id);
      // mantém a ordem do PGT
      const ordem = Catalogo.etapasDoServico(state.servicoId).map(e => e.id);
      state.etapasSelecionadas.sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
    };
    el.querySelectorAll('input[data-fase]').forEach(cb => {
      cb.onchange = e => {
        Catalogo.etapasDoServico(state.servicoId).filter(x => x.fase_id === e.target.dataset.fase).forEach(x => marcarEtapa(x.id, e.target.checked));
        recomputeIndicadores(state);
        ctx.rerender();
      };
    });
    el.querySelectorAll('input[data-etapa]').forEach(cb => {
      cb.onchange = e => { marcarEtapa(e.target.dataset.etapa, e.target.checked); recomputeIndicadores(state); ctx.rerender(); };
    });
    el.querySelectorAll('input[data-entrega]').forEach(cb => {
      cb.onchange = e => {
        const [etapaId, id] = e.target.dataset.entrega.split('::');
        const l = new Set(state.entregasSelecionadas[etapaId] || []);
        if (e.target.checked) l.add(id); else l.delete(id);
        const ordem = Catalogo.entregasDaEtapa(etapaId, state.servicoId, state.categoriaId).map(x => x.id);
        state.entregasSelecionadas[etapaId] = ordem.filter(x => l.has(x));
        recomputeIndicadores(state);
        ctx.rerender();
      };
    });
    el.querySelectorAll('input[data-clausula]').forEach(cb => {
      cb.onchange = e => {
        const id = e.target.dataset.clausula;
        const l = new Set(state.clausulasSelecionadas);
        if (e.target.checked) l.add(id); else l.delete(id);
        state.clausulasSelecionadas = [...l];
        ctx.rerender();
      };
    });
    el.querySelectorAll('input[data-despesa]').forEach(cb => {
      cb.onchange = e => {
        const l = new Set(state.despesasReembolsaveisSelecionadas || []);
        if (e.target.checked) l.add(e.target.dataset.despesa); else l.delete(e.target.dataset.despesa);
        state.despesasReembolsaveisSelecionadas = Catalogo.despesas().map(d => d.id).filter(id => l.has(id));
        state.incluirDespesasReembolsaveis = state.despesasReembolsaveisSelecionadas.length > 0;
        ctx.updateTicket();
      };
    });
    el.querySelectorAll('input[data-qtd]').forEach(inp => {
      inp.onchange = e => { const v = parseInt(e.target.value, 10); if (v > 0) state.clausulasQtd[e.target.dataset.qtd] = v; else delete state.clausulasQtd[e.target.dataset.qtd]; ctx.rerender(); };
    });
  },
  validate(state) {
    if (!state.servicoId) return 'Escolha o serviço em Projeto.';
    if (Catalogo.etapasDoServico(state.servicoId).length && !state.etapasSelecionadas.length) return 'Marque ao menos uma etapa.';
    const semN = Catalogo.clausulas(state.etapasSelecionadas, state.servicoId)
      .filter(c => (c.pert === 'P' || state.clausulasSelecionadas.includes(c.id)) && Catalogo.temQuantidade(c.clausula) && !state.clausulasQtd[c.id]);
    if (semN.length) return `Informe a quantidade (N) da cláusula "${semN[0].clausula}".`;
    return true;
  }
});

// -------------------------------------------------------------------------
// 3. Índice de complexidade
// -------------------------------------------------------------------------
STEPS.push({
  id: 'complexidade',
  title: 'Complexidade',
  desc: 'Padrão pré-carregado pela categoria da tipologia e pelo serviço (Bases). Ajuste o que não refletir o projeto.',
  render(state, data) {
    return `
      <div class="field-group">
        <h3 class="bloco__titulo">Critérios do índice</h3>
        <div class="ic-grade">${MANUAL_COMPLEXIDADE_KEYS.map(key => {
          const crit = data.icCriterios[IC_KEYS_ALL.indexOf(key)];
          const atual = labelIc(state.icValores[key] != null ? state.icValores[key] : 1);
          return `<div class="field"><label class="field__label">${crit.criterio}</label>
            ${segmented('ic-' + key, [{ value: 'baixo', label: 'Baixo' }, { value: 'medio', label: 'Médio' }, { value: 'alto', label: 'Alto' }], atual)}
            <p class="field__hint" id="ic-hint-${key}">${crit[atual]}</p></div>`;
        }).join('')}</div>
        <p class="field__hint">Indefinição do escopo fica em Projeto; empenho e detalhamento são calculados do Escopo.
          <button type="button" class="btn-link" id="btn-ic-padrao">Voltar ao padrão das Bases</button></p>
      </div>
    `;
  },
  bind(el, state, data, ctx) {
    MANUAL_COMPLEXIDADE_KEYS.forEach(key => {
      const crit = data.icCriterios[IC_KEYS_ALL.indexOf(key)];
      el.querySelectorAll(`input[name="ic-${key}"]`).forEach(r => {
        r.onchange = e => { state.icValores[key] = IC_LABELS[e.target.value]; el.querySelector(`#ic-hint-${key}`).textContent = crit[e.target.value]; ctx.updateTicket(); };
      });
    });
    el.querySelector('#btn-ic-padrao').onclick = () => { aplicarIcPadrao(state); ctx.rerender(); };
  },
  validate() { return true; }
});

// -------------------------------------------------------------------------
// 4. Cronograma — prazo de cada etapa pelo PGT (× faixa de área), ajustável
// -------------------------------------------------------------------------
STEPS.push({
  id: 'cronograma',
  title: 'Cronograma',
  desc: 'O prazo de cada etapa vem da sequência das entregas marcadas no PGT, multiplicado pela faixa de área das Bases. Para usar outros prazos, ligue Personalizar prazos; etapa sem prazo no PGT pede as semanas.',
  render(state) {
    const etapas = etapasContratadas(state);
    const area = state.areaConstruida;
    const f = Catalogo.faixa(area);
    const faixas = (Catalogo.atual() && Catalogo.atual().faixas) || [];
    const num = (n) => String(n).replace('.', ',');
    const pers = !!state.prazosPersonalizados;
    let antes = 0;
    const etqFaixas = faixas.map((x, i) => {
      const rot = x.ate == null ? `acima de ${num(antes)} m²` : `${i ? num(antes) + ' a ' : 'até '}${num(x.ate)} m²`;
      antes = x.ate;
      return `<span class="etq ${f.indice === i + 1 ? 'etq--faixa' : ''}" title="Faixa ${i + 1} das Bases">${rot} · ×${num(x.mult || 1)}</span>`;
    }).join('');
    return `
      <div class="field-group">
        <h3 class="bloco__titulo">Início</h3>
        <div class="field"><label class="field__label">Data de início do serviço</label>
          <input type="date" id="f-data-inicio" value="${state.dataInicio || ''}" min="2020-01-01" max="2035-12-31"></div>
      </div>
      <div class="field-group" id="cronograma-preview">
        <h3 class="bloco__titulo">Prazo por etapa</h3>
        <div class="cr-faixa">
          <p class="field__label" style="margin:0 0 6px">Ajuste automático pela área (Bases)</p>
          ${faixas.length ? `<div class="cr-faixas">${etqFaixas}</div>
          <p class="field__hint">${area > 0 ? `Área edificada de ${num(area)} m²: faixa ${f.indice}, prazo das entregas × ${num(f.mult)}. Entregas de prazo fixo e eventos não mudam.` : 'Informe a área edificada em Projeto para aplicar a faixa; sem área, vale o prazo do PGT sem multiplicador.'}</p>`
          : '<p class="field__hint">As Bases ainda não têm faixas de prazo por área: vale o prazo do PGT.</p>'}
        </div>
        <label class="check-row cr-chave"><input type="checkbox" id="f-prazos-pers" ${pers ? 'checked' : ''}><span class="check-row__box">${checkSvg()}</span>
          <span class="check-row__text small"><strong>Personalizar prazos</strong>: digitar as semanas de cada etapa no lugar das do PGT.</span></label>
        ${etapas.length ? `<div class="timeline">${etapas.map(e => {
          const calc = prazoCalculado(state, e.id);
          const editavel = pers || !calc.semanas;
          const valor = state.semanasManual[e.id] != null && state.semanasManual[e.id] !== '' ? state.semanasManual[e.id] : '';
          return `<div class="timeline__row">
            <div><div class="timeline__name"><b class="sigla">${escHtml(e.sigla)}</b> ${escHtml(e.nome)}</div>
              <span class="timeline__fase">${escHtml(Catalogo.nomeFase(e.fase))} · PGT: ${calc.semanas ? fmtSemanas(calc.semanas, true) : 'sem prazo'}${calc.semPrazo ? ` (${calc.semPrazo} entrega${calc.semPrazo === 1 ? '' : 's'} sem duração)` : ''}</span></div>
            <div class="timeline__weeks">${editavel
              ? `${calc.semanas ? '' : '<span class="etq etq--atencao" title="O PGT ainda não tem duração para estas entregas">informe</span> '}<input type="number" min="0" step="0.5" data-semanas="${e.id}" value="${valor}" placeholder="${calc.semanas || ''}" aria-label="Semanas de ${escHtml(e.nome)}"> <span class="small muted">sem.</span>`
              : `<span class="cr-pgt">${fmtSemanas(calc.semanas, true)}</span>`}</div>
            <div class="timeline__dates" data-datas="${e.id}"></div>
          </div>`;
        }).join('')}</div>` : '<p class="muted">Marque as etapas em Escopo para montar o cronograma.</p>'}
      </div>
    `;
  },
  bind(el, state, data, ctx) {
    const datas = () => {
      const etapas = etapasContratadas(state);
      const linhas = state.dataInicio ? OdisseCalc.montarCronograma(state.dataInicio, etapas.filter(e => e.semanas > 0)) : [];
      for (const e of etapas) {
        const box = el.querySelector(`[data-datas="${e.id}"]`);
        const l = linhas.find(x => x.id === e.id);
        if (box) box.textContent = l ? `${OdisseCalc.fmtData(l.inicio)} – ${OdisseCalc.fmtData(l.fim)}` : '—';
      }
    };
    el.querySelector('#f-data-inicio').oninput = e => {
      const limpo = dataValidaOuVazia(e.target.value);
      state.dataInicio = limpo;
      datas(); ctx.updateTicket();
    };
    el.querySelectorAll('input[data-semanas]').forEach(inp => {
      inp.oninput = e => {
        const v = e.target.value;
        if (v === '') delete state.semanasManual[e.target.dataset.semanas];
        else state.semanasManual[e.target.dataset.semanas] = Math.max(0, parseFloat(v) || 0);
        datas(); ctx.updateTicket();
      };
    });
    const pers = el.querySelector('#f-prazos-pers');
    if (pers) pers.onchange = () => { state.prazosPersonalizados = pers.checked; ctx.rerender(); };
    datas();
  },
  validate(state) {
    if (!state.dataInicio) return 'Informe a data de início.';
    return true;
  }
});

// -------------------------------------------------------------------------
// 5. Honorários e pagamento
// -------------------------------------------------------------------------
STEPS.push({
  id: 'pagamento',
  title: 'Honorários e pagamento',
  desc: 'Ajuste de mercado e condições de pagamento. A prévia ao lado acompanha cada mudança.',
  render(state, data) {
    const srv = Catalogo.servico(state.servicoId);
    const fatorAtual = state.fatorAjuste || 1.25;
    const entrada = state.pctEntrada != null ? state.pctEntrada : 0.35;
    const parcelas = Catalogo.parcelas(state.servicoId, state.etapasSelecionadas);
    return `
      ${srv && !srv.com_preco ? `<div class="field-group"><h3 class="bloco__titulo">Honorário</h3><div class="field">
        <label class="field__label">Valor fixo</label>
        <input type="text" inputmode="numeric" id="f-valor-fixo" value="${state.valorFixo ? OdisseCalc.fmtMoeda(state.valorFixo) : ''}" placeholder="Só números">
        <p class="field__hint">${escHtml(srv.nome)} não tem preço calculado nos Honorários.</p></div></div>` : `
      <div class="field-group"><h3 class="bloco__titulo">Ajuste de mercado</h3><div class="field">
        <label class="field__label">Fator de ajuste</label>
        <div class="segmented" data-seg="fator-preset">
          ${[1, 1.25, 2.25].map(v => `<input type="radio" name="fator-preset" id="fator-${v}" value="${v}" ${fatorAtual === v ? 'checked' : ''}><label for="fator-${v}">${v === 1 ? 'Sem ajuste' : '÷ ' + v}</label>`).join('')}
          <input type="radio" name="fator-preset" id="fator-custom" value="custom" ${![1, 1.25, 2.25].includes(fatorAtual) ? 'checked' : ''}><label for="fator-custom">Outro</label>
        </div>
        <input type="number" step="0.01" min="1" id="f-fator-custom" value="${fatorAtual}" style="margin-top:10px" ${[1, 1.25, 2.25].includes(fatorAtual) ? 'hidden' : ''}>
        <p class="field__hint">O valor da tabela do CAU é dividido por este fator. 1,25 e 2,25 são os dois patamares que o Odisse costuma praticar.</p>
      </div></div>`}
      <div class="field-group">
        <h3 class="bloco__titulo">Condições de pagamento</h3>
        <div class="row-2">
          <div class="field"><label class="field__label">Desconto à vista (%)</label><input type="number" min="0" max="100" step="1" id="f-desconto" value="${Math.round((state.descontoAvista != null ? state.descontoAvista : 0.08) * 100)}"></div>
          <div class="field"><label class="field__label">Entrada (%, no plano entrada + boletos)</label><input type="number" min="0" max="100" step="1" id="f-entrada" value="${Math.round(entrada * 100)}"></div>
        </div>
        <div class="row-2">
          <div class="field"><label class="field__label">Parcelas oferecidas no cartão</label>
            <select id="f-max-parcelas-cartao">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option value="${n}" ${(state.maxParcelasCartao || 8) === n ? 'selected' : ''}>${n}x</option>`).join('')}</select></div>
          <div class="field"><label class="field__label">Parcelas oferecidas no boleto</label>
            <select id="f-max-parcelas-boleto">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option value="${n}" ${(state.maxParcelasBoleto || 8) === n ? 'selected' : ''}>${n}x</option>`).join('')}</select></div>
        </div>
        ${parcelas.length ? `<p class="field__hint">Referência (entrada + peso das fases contratadas): ${parcelas.map(p => `${escHtml(p.nome)} ${Math.round(p.percentual * 100)}%`).join(' · ')}.</p>` : ''}
      </div>
    `;
  },
  bind(el, state, data, ctx) {
    const fixo = el.querySelector('#f-valor-fixo');
    if (fixo) fixo.oninput = e => {
      const d = e.target.value.replace(/\D/g, '');
      state.valorFixo = d ? parseInt(d, 10) / 100 : 0;
      e.target.value = d ? OdisseCalc.fmtMoeda(state.valorFixo) : '';
      ctx.updateTicket();
    };
    el.querySelectorAll('input[name="fator-preset"]').forEach(r => {
      r.onchange = e => {
        const custom = el.querySelector('#f-fator-custom');
        if (e.target.value === 'custom') { custom.hidden = false; return; }
        custom.hidden = true;
        state.fatorAjuste = parseFloat(e.target.value);
        ctx.updateTicket();
      };
    });
    const fc = el.querySelector('#f-fator-custom');
    if (fc) fc.oninput = e => { state.fatorAjuste = parseFloat(e.target.value) || 1; ctx.updateTicket(); };
    el.querySelector('#f-desconto').oninput = e => { state.descontoAvista = (parseFloat(e.target.value) || 0) / 100; ctx.updateTicket(); };
    el.querySelector('#f-entrada').oninput = e => { state.pctEntrada = (parseFloat(e.target.value) || 0) / 100; ctx.updateTicket(); };
    el.querySelector('#f-max-parcelas-cartao').onchange = e => { state.maxParcelasCartao = parseInt(e.target.value, 10) || 8; };
    el.querySelector('#f-max-parcelas-boleto').onchange = e => { state.maxParcelasBoleto = parseInt(e.target.value, 10) || 8; };
  },
  validate(state) {
    const srv = Catalogo.servico(state.servicoId);
    if (srv && !srv.com_preco && !(state.valorFixo > 0)) return 'Informe o valor do honorário (serviço sem preço calculado).';
    return true;
  }
});

// -------------------------------------------------------------------------
// 6. Cliente e emissão — para quem vai e quem do estúdio emite
// -------------------------------------------------------------------------
const SELETOR_ASSINANTES = 'https://universo.odisse.com.br/base/v1/assinantes.js';
let moduloAssinantes = null;

STEPS.push({
  id: 'cliente',
  title: 'Cliente e emissão',
  desc: 'O nome do projeto, para quem vai a proposta e o responsável técnico que a assina. A data da proposta é a do dia em que ela é finalizada.',
  render(state) {
    const c = state.cliente;
    const vinculo = state._simulacao ? '' : (state._oportunidadeId || state._clienteId)
      ? `<div class="card vinculo">
          <p class="small muted" style="margin:0 0 4px">Ligado ao Universo</p>
          <p style="margin:0"><span id="vinculo-texto">${state._oportunidadeId ? 'Oportunidade' : 'Cliente'} carregando…</span></p>
          ${state._revisaoDeCodigo ? `<p class="small" style="margin:6px 0 0">Revisão de <strong>${escHtml(state._revisaoDeCodigo)}</strong></p>` : ''}
          ${state.numeroProposta ? '' : '<button type="button" class="btn-link" id="btn-desligar">Desligar e começar como cliente novo</button>'}
        </div>`
      : `<div class="field"><label class="field__label">Cliente já cadastrado? Busque no Universo (opcional)</label>
          <input type="search" id="f-busca-cliente" placeholder="Nome, e-mail, telefone ou CNPJ" autocomplete="off">
          <div id="busca-cliente-res" class="busca-res"></div>
          <p class="field__hint">Sem busca, o cliente é cadastrado no Universo ao finalizar (com aviso se já houver alguém parecido).</p></div>`;
    return `
      <div class="field-group">
        <h3 class="bloco__titulo">Projeto</h3>
        <div class="field">
          <label class="field__label">Nome do projeto (opcional)</label>
          <input type="text" id="f-nome-projeto" value="${escHtml(state.nomeProjeto || '')}" placeholder="Ex.: Residência Silva">
          <p class="field__hint">Sai no assunto da proposta e vira o nome do projeto quando o contrato for assinado.</p>
        </div>
      </div>
      <div class="field-group">
        <h3 class="bloco__titulo">Cliente</h3>
        ${vinculo}
        <div class="field"><label class="field__label">Nome do cliente ou empresa${state._simulacao ? ' (opcional na simulação)' : ''}</label><input type="text" id="f-nome" value="${escHtml(c.nome || '')}"></div>
        <div class="row-2">
          <div class="field"><label class="field__label">E-mail</label><input type="email" id="f-email" value="${escHtml(c.email || '')}"></div>
          <div class="field"><label class="field__label">Telefone</label><input type="tel" id="f-telefone" value="${escHtml(c.telefone || '')}" placeholder="(83) 99999-9999"></div>
        </div>
        <div class="row-2">
          <div class="field"><label class="field__label">Representação</label>${segmented('representacao', [{ value: 'PF', label: 'Pessoa física' }, { value: 'PJ', label: 'Pessoa jurídica' }], c.representacao || 'PF')}</div>
          <div class="field"><label class="field__label">CPF / CNPJ</label><input type="text" id="f-doc" value="${escHtml(c.documento || '')}"></div>
        </div>
      </div>
      <div class="field-group">
        <h3 class="bloco__titulo">Responsável técnico</h3>
        <div class="field"><div id="f-assinantes"><p class="small muted">Carregando a equipe…</p></div>
          <p class="field__hint">Quem da equipe responde pela proposta e a assina (Equipe do Universo). A data é a do dia em que a proposta é finalizada; a rubrica entra no PDF só na emissão.</p></div>
      </div>
    `;
  },
  bind(el, state, data, ctx) {
    ligarVinculoUniverso(el, state, ctx);
    el.querySelector('#f-nome-projeto').oninput = e => { state.nomeProjeto = e.target.value; };
    el.querySelector('#f-nome').oninput = e => { state.cliente.nome = e.target.value; ctx.updateTicket(); };
    el.querySelector('#f-email').oninput = e => { state.cliente.email = e.target.value; };
    el.querySelector('#f-telefone').oninput = e => { e.target.value = state.cliente.telefone = maskTelefone(e.target.value); };
    const doc = el.querySelector('#f-doc');
    doc.oninput = e => { e.target.value = state.cliente.documento = maskDocumento(e.target.value, state.cliente.representacao); };
    el.querySelectorAll('input[name="representacao"]').forEach(r => {
      r.onchange = e => { state.cliente.representacao = e.target.value; doc.value = state.cliente.documento = maskDocumento(state.cliente.documento, e.target.value); };
    });

    // seletor comum de quem assina (Universo, base/v1)
    const caixa = el.querySelector('#f-assinantes');
    (async () => {
      try {
        moduloAssinantes = moduloAssinantes || await import(SELETOR_ASSINANTES);
        caixa.innerHTML = '';
        moduloAssinantes.seletorAssinantes(caixa, {
          uso: 'proposta',
          carregar: () => Universo.get('equipe/assinantes', { para: 'proposta' }),
          foto: (p) => Universo.bruto(`equipe/${p.id}/foto?variante=s`).then(r => r.blob()).then(b => URL.createObjectURL(b)),
          valor: state.assinantes || [],
          novo: !(state.assinantes || []).length,
          rotulo: '+ Responsável técnico',
          aoMudar: (copias) => { state.assinantes = copias; salvarRascunho(); renderGuia(); atualizarRevisao(); },
        });
      } catch (e) {
        caixa.innerHTML = `<p class="small muted">Não consegui carregar a equipe (${escHtml(e.message)}).</p>`;
      }
    })();
  },
  validate(state) {
    if (!state.cliente.nome && !state._simulacao) return 'Informe o nome do cliente.';
    if (!(state.assinantes || []).some(a => a && a.nome)) return 'Escolha o responsável técnico.';
    return true;
  }
});

// -------------------------------------------------------------------------
// 7. Revisão e PDF (o número sai só ao finalizar)
// -------------------------------------------------------------------------
STEPS.push({
  id: 'revisao',
  title: 'Revisão e PDF',
  desc: 'Confira o que falta, a prévia do documento e o cálculo. Emitir numera a proposta, registra no Universo com as versões do PGT, das Bases e dos Honorários, guarda o PDF como vai para o cliente e o baixa; depois disso os valores não mudam (para mudar, abra uma revisão pelo histórico ou pelo funil). Simulação recebe número da mesma sequência, fica no histórico marcada como simulação, sem cliente e fora do funil.',
  render(state) {
    const r = state._calcResult;
    const falta = pendencias(state).filter(p => p.i !== STEPS.length - 1);
    const fmt = OdisseCalc.fmtMoeda;
    const memoria = r && !r.semPreco ? `
      <div class="field-group">
        <h3 class="bloco__titulo">Memória de cálculo</h3>
        <div class="data-row"><span class="data-row__label">Base de honorários (BH = CUB × FA)</span><span class="data-row__value tabular">${fmt(r.bh)}/m²</span></div>
        <div class="data-row"><span class="data-row__label">Razão área projetada/construída (R)</span><span class="data-row__value tabular">${r.R.toFixed(3)}</span></div>
        <div class="data-row"><span class="data-row__label">Redutor de repetição (Rr)</span><span class="data-row__value tabular">${r.redutor}</span></div>
        <div class="data-row"><span class="data-row__label">Área de cálculo (A × R × Rr)</span><span class="data-row__value tabular">${r.areaCalculo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²</span></div>
        <div class="data-row"><span class="data-row__label">Custo estimado da obra (CEO = BH × área de cálculo)</span><span class="data-row__value tabular">${fmt(r.ceo)}</span></div>
        <div class="data-row"><span class="data-row__label">Fator percentual (fp)</span><span class="data-row__value tabular">${(r.fp * 100).toFixed(2)}%</span></div>
        <div class="data-row"><span class="data-row__label">Índice de complexidade (IC)</span><span class="data-row__value tabular">${r.ic.toFixed(3)}</span></div>
        <div class="data-row"><span class="data-row__label">Valor de tabela (CAU = CEO × fp × IC)</span><span class="data-row__value tabular">${fmt(r.valorCau)}</span></div>
        <div class="data-row"><span class="data-row__label">Modificador do serviço (M)</span><span class="data-row__value tabular">${(Catalogo.servico(state.servicoId) || {}).modificador || 1}</span></div>
        <div class="data-row"><span class="data-row__label">Ajuste de mercado (÷ ${state.fatorAjuste})</span><span class="data-row__value tabular">${fmt(r.valorMercado)}</span></div>
        <div class="data-row"><span class="data-row__label">Percentual do projeto (fases contratadas)</span><span class="data-row__value tabular">${fmtPct(state.reducaoEscopoPercentual)}</span></div>
        <div class="data-row"><span class="data-row__label"><strong>Honorário final</strong></span><span class="data-row__value tabular"><strong>${fmt(r.valorFinal)}</strong></span></div>
      </div>` : r ? `<div class="field-group"><h3 class="bloco__titulo">Honorário</h3><div class="data-row"><span class="data-row__label"><strong>Valor fixo</strong></span><span class="data-row__value tabular"><strong>${fmt(r.valorFinal)}</strong></span></div></div>` : '';
    return `
      ${falta.length ? `<div class="field-group pendencias"><h3 class="bloco__titulo">Falta para emitir</h3>
        ${falta.map(p => `<button type="button" class="pendencia" data-ir="${p.i}"><b>${escHtml(p.titulo)}</b> ${escHtml(p.msg)}</button>`).join('')}</div>` : ''}
      ${state._revisaoDeCodigo ? `<p class="field__hint aviso-revisao">Revisão da proposta <strong>${escHtml(state._revisaoDeCodigo)}</strong>: ao emitir, ela recebe o mesmo número com a revisão seguinte, e a anterior passa a constar como substituída.</p>` : ''}
      <div class="field-group">
        <h3 class="bloco__titulo">Prévia do documento</h3>
        <div class="previa-doc__barra">
          <span class="field__label" style="margin:0">Folha</span>
          <div class="seletor" id="previa-modelos" role="group" aria-label="Folha do documento"></div>
          <span class="field__hint" style="margin:0">${state.numeroProposta ? `Proposta ${escHtml(state.numeroProposta)}.` : 'Sem número: ele só é gerado ao emitir.'} A rubrica entra só no documento emitido.</span>
        </div>
        <div class="previa-doc" id="previa-doc"><p class="small muted">Montando a prévia…</p></div>
      </div>
      ${memoria}
    `;
  },
  bind(el, state, data, ctx) {
    el.querySelectorAll('[data-ir]').forEach(b => { b.onclick = () => irParaEtapa(parseInt(b.dataset.ir, 10)); });
  },
  validate() { return true; }
});
