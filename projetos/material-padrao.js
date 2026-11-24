// ==========================================================================
// Padrão de material — as duas vistas de um mesmo padrão:
//   * FORMULÁRIO digital, em Blocos (é o que se preenche no cartão do projeto, no dia a dia);
//   * FOLHA (o PDF), montada pelo montador da Marca: vazia por padrão, ou com o que foi preenchido.
// Usado pelo editor do PGT (pgt-materiais.js) e, depois, pelo cartão do Escopo. Sem dependências da página.
//
//   MP.doc(padrao, valores?)  → conteúdo para o montador da Marca (vazio: linhas e caixas para escrever à mão)
//   MP.formulario(padrao, { valores, dados, edita }) → HTML dos Blocos (dados = os automáticos do projeto)
//   MP.ler(raiz, padrao)      → valores digitados no formulário
//   MP.montar(caixa, doc)     → monta a folha na caixa (carrega o montador da Marca uma vez)
// ==========================================================================

const MP = (() => {
  const MONTADOR = 'https://marca.odisse.com.br/v1/documentos/documentos.js';
  const TIPOS = [['formulario', 'Formulário'], ['checklist', 'Checklist'], ['modelo', 'Modelo de documento']];
  const CAMPOS = [['secao', 'Seção'], ['texto', 'Texto curto'], ['texto_longo', 'Texto longo'], ['data', 'Data'], ['numero', 'Número'],
    ['escolha', 'Escolha'], ['marcar', 'Item de checklist'], ['tabela', 'Tabela'], ['pessoas', 'Pessoas'], ['assinatura', 'Assinatura'], ['automatico', 'Dado do projeto']];
  const AUTO = [['projeto', 'Projeto (código e nome)'], ['cliente', 'Cliente'], ['endereco', 'Endereço do imóvel'], ['etapa', 'Etapa'],
    ['cartao', 'Entrega ou evento'], ['data', 'Data'], ['responsavel', 'Responsável']];
  const EXEMPLO = { projeto: 'OA-AAAA-000 · Nome do projeto', cliente: 'Nome do cliente', endereco: 'Endereço do imóvel', etapa: 'Etapa',
    cartao: 'Entrega ou evento', data: 'dd/mm/aaaa', responsavel: 'Responsável' };
  const nome = (lista, id) => (lista.find((x) => x[0] === id) || [id, id])[1];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const colunasDe = (c) => (c.tipo === 'pessoas' ? ['Nome', 'Papel', 'Contato'] : (c.colunas && c.colunas.length ? c.colunas : ['Coluna 1', 'Coluna 2']));
  const fmtData = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v.split('-').reverse().join('/') : v);

  // ---------------------------------------------------------------- folha (montador da Marca)
  function doc(m, valores = null, dados = null) {
    const V = valores || {};
    const preenchido = !!valores;
    const campos = []; const blocos = []; const assinaturas = [];
    let lista = null;
    for (const c of m.campos || []) {
      if (c.tipo !== 'marcar') lista = null;
      const rot = c.rotulo || nome(CAMPOS, c.tipo);
      const v = V[c.id];
      if (c.tipo === 'automatico') campos.push({ rotulo: rot, valor: (dados && dados[c.fonte]) || EXEMPLO[c.fonte] || '' });
      else if (c.tipo === 'secao') blocos.push({ tipo: 'secao', texto: rot });
      else if (c.tipo === 'texto') blocos.push({ tipo: 'paragrafo', texto: `${rot}: ${preenchido ? (v || '—') : '_'.repeat(44)}` });
      else if (c.tipo === 'data') blocos.push({ tipo: 'paragrafo', texto: `${rot}: ${preenchido ? (fmtData(v) || '—') : '____/____/________'}` });
      else if (c.tipo === 'numero') blocos.push({ tipo: 'paragrafo', texto: `${rot}: ${preenchido ? (v != null && v !== '' ? v : '—') : '______________'}${c.unidade ? ' ' + c.unidade : ''}` });
      else if (c.tipo === 'texto_longo') {
        if (preenchido) { blocos.push({ tipo: 'paragrafo', texto: rot, negrito: true }); blocos.push({ tipo: 'paragrafo', texto: v || '—' }); }
        else blocos.push({ tipo: 'tabela', colunas: [{ titulo: rot }], linhas: Array.from({ length: c.linhas || 4 }, () => [' ']) });
      } else if (c.tipo === 'escolha') {
        blocos.push({ tipo: 'paragrafo', texto: rot, negrito: true });
        blocos.push({ tipo: 'lista', itens: (c.opcoes || []).map((o) => `${preenchido && v === o ? '☒' : '☐'}  ${o}`) });
      } else if (c.tipo === 'marcar') {
        if (!lista) { lista = { tipo: 'lista', itens: [] }; blocos.push(lista); }
        lista.itens.push(`${preenchido && v ? '☒' : '☐'}  ${rot}`);
      } else if (c.tipo === 'tabela' || c.tipo === 'pessoas') {
        const cols = colunasDe(c);
        const linhas = preenchido && Array.isArray(v) && v.length ? v.map((l) => cols.map((_, i) => (l[i] || ' ')))
          : Array.from({ length: c.linhas || (c.tipo === 'pessoas' ? 4 : 3) }, () => cols.map(() => ' '));
        blocos.push({ tipo: 'paragrafo', texto: rot, negrito: true });
        blocos.push({ tipo: 'tabela', colunas: cols.map((t) => ({ titulo: t })), linhas });
      } else if (c.tipo === 'assinatura') assinaturas.push({ nome: rot, cargo: '' });
    }
    return { modelo: m.folha === 'coluna' ? 'coluna' : 'ficha', miolo: m.miolo || 'texto', codigo: (dados && dados.codigo) || 'OA-AAAA-000', titulo: m.nome, campos, blocos, assinaturas };
  }
  let mod = null; let rec = null;
  async function montar(caixa, d) {
    if (!mod) { mod = await import(MONTADOR); rec = await mod.recursos(); }
    return mod.montar(caixa, d, rec);
  }

  // ---------------------------------------------------------------- formulário digital (Blocos)
  // Cada Seção abre um Bloco; o que vem antes da primeira Seção fica no Bloco "Geral"; os dados do projeto num
  // Bloco próprio, só para ler. Campos curtos lado a lado (duas colunas), longos na largura toda.
  function formulario(m, { valores = {}, dados = null, edita = true } = {}) {
    const dis = edita ? '' : 'disabled';
    const autos = (m.campos || []).filter((c) => c.tipo === 'automatico');
    const grupos = []; let g = null;
    for (const c of m.campos || []) {
      if (c.tipo === 'automatico') continue;
      if (c.tipo === 'secao') { g = { titulo: c.rotulo || 'Seção', itens: [] }; grupos.push(g); continue; }
      if (!g) { g = { titulo: 'Geral', itens: [] }; grupos.push(g); }
      g.itens.push(c);
    }
    const campo = (c) => {
      const rot = esc(c.rotulo || nome(CAMPOS, c.tipo));
      const v = valores[c.id];
      const nm = `data-mp="${c.id}"`;
      if (c.tipo === 'texto') return `<label class="u-campo mp-campo"><span>${rot}</span><input type="text" ${nm} value="${esc(v || '')}" ${dis}></label>`;
      if (c.tipo === 'data') return `<label class="u-campo mp-campo"><span>${rot}</span><input type="date" ${nm} value="${esc(v || '')}" ${dis}></label>`;
      if (c.tipo === 'numero') return `<label class="u-campo mp-campo"><span>${rot}</span><span class="pg-unidade mp-unidade"><input type="number" ${nm} value="${esc(v ?? '')}" ${dis}>${c.unidade ? `<i>${esc(c.unidade)}</i>` : ''}</span></label>`;
      if (c.tipo === 'texto_longo') return `<label class="u-campo mp-campo mp-largo"><span>${rot}</span><textarea rows="${Math.min(8, c.linhas || 4)}" ${nm} ${dis}>${esc(v || '')}</textarea></label>`;
      if (c.tipo === 'escolha') {
        const ops = c.opcoes || [];
        return `<div class="u-campo mp-campo${ops.length > 4 ? '' : ''}"><span>${rot}</span>${ops.length <= 4
          ? `<span class="pg-seletor mp-seletor" role="radiogroup" aria-label="${rot}" ${nm}>${ops.map((o) => `<button type="button" role="radio" data-mp-op="${esc(o)}" aria-checked="${v === o}" ${dis}>${esc(o)}</button>`).join('')}</span>`
          : `<select ${nm} ${dis}><option value=""></option>${ops.map((o) => `<option ${v === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`}</div>`;
      }
      if (c.tipo === 'marcar') return `<label class="mp-marcar"><input type="checkbox" ${nm} ${v ? 'checked' : ''} ${dis}><span>${rot}</span></label>`;
      if (c.tipo === 'tabela' || c.tipo === 'pessoas') {
        const cols = colunasDe(c);
        const linhas = Array.isArray(v) && v.length ? v : Array.from({ length: Math.min(c.linhas || 3, 6) }, () => cols.map(() => ''));
        return `<div class="u-campo mp-campo mp-largo"><span>${rot}</span><div class="mp-tabela" ${nm} style="--cols:${cols.length}">
          ${cols.map((t) => `<b>${esc(t)}</b>`).join('')}
          ${linhas.map((l) => cols.map((_, i) => `<input type="text" value="${esc(l[i] || '')}" aria-label="${esc(cols[i])}" ${dis}>`).join('')).join('')}</div>
          ${edita ? `<button type="button" class="mp-linha-mais" data-mp-mais="${c.id}">+ linha</button>` : ''}</div>`;
      }
      if (c.tipo === 'assinatura') return `<div class="mp-assinatura"><span class="mp-assinatura__caixa">${v ? `assinado · ${esc(v)}` : 'assinatura'}</span><span>${rot}</span></div>`;
      return '';
    };
    const blocoHtml = (titulo, corpo) => `<section class="pg-bloco mp-bloco"><div class="pg-bloco-cab"><h3 class="pg-bloco-h">${titulo}</h3></div><div class="pg-bloco-corpo">${corpo}</div></section>`;
    const corpoGrupo = (itens) => {
      // itens de checklist seguidos ficam juntos numa lista; assinaturas lado a lado
      let html = ''; let i = 0;
      while (i < itens.length) {
        const c = itens[i];
        if (c.tipo === 'marcar' || c.tipo === 'assinatura') {
          const tipo = c.tipo; let j = i; const grupo = [];
          while (j < itens.length && itens[j].tipo === tipo) grupo.push(itens[j++]);
          html += `<div class="mp-largo ${tipo === 'marcar' ? 'mp-lista' : 'mp-assinaturas'}">${grupo.map(campo).join('')}</div>`;
          i = j; continue;
        }
        html += campo(c); i++;
      }
      return `<div class="mp-grade">${html}</div>`;
    };
    return `<div class="mp-form">
      ${autos.length ? blocoHtml('Dados do projeto', `<div class="mp-grade">${autos.map((c) => `<div class="u-campo mp-campo"><span>${esc(c.rotulo || nome(AUTO, c.fonte))}</span><span class="mp-auto">${esc((dados && dados[c.fonte]) || EXEMPLO[c.fonte] || '')}</span></div>`).join('')}</div>`) : ''}
      ${grupos.map((x) => blocoHtml(esc(x.titulo), x.itens.length ? corpoGrupo(x.itens) : '<p class="pg-apoio">Sem campos nesta seção.</p>')).join('')}
      ${!autos.length && !grupos.length ? '<div class="pg-vazio">Sem campos ainda.</div>' : ''}
    </div>`;
  }
  // liga o que o formulário precisa para funcionar (escolha, + linha); aoMudar recebe os valores
  function ligar(raiz, m, aoMudar) {
    raiz.querySelectorAll('.mp-seletor').forEach((s) => s.querySelectorAll('[data-mp-op]').forEach((b) => b.onclick = () => {
      const on = b.getAttribute('aria-checked') === 'true';
      s.querySelectorAll('[data-mp-op]').forEach((x) => x.setAttribute('aria-checked', 'false'));
      if (!on) b.setAttribute('aria-checked', 'true');
      aoMudar && aoMudar(ler(raiz, m));
    }));
    raiz.querySelectorAll('[data-mp-mais]').forEach((b) => b.onclick = () => {
      const t = raiz.querySelector(`.mp-tabela[data-mp="${b.dataset.mpMais}"]`);
      const n = Number(getComputedStyle(t).getPropertyValue('--cols')) || 2;
      for (let i = 0; i < n; i++) t.insertAdjacentHTML('beforeend', '<input type="text">');
      aoMudar && aoMudar(ler(raiz, m));
    });
    raiz.addEventListener('input', () => aoMudar && aoMudar(ler(raiz, m)));
  }
  function ler(raiz, m) {
    const v = {};
    for (const c of m.campos || []) {
      const el = raiz.querySelector(`[data-mp="${c.id}"]`);
      if (!el) continue;
      if (c.tipo === 'marcar') v[c.id] = el.checked;
      else if (c.tipo === 'escolha') v[c.id] = el.matches('select') ? el.value : el.querySelector('[aria-checked="true"]')?.dataset.mpOp || '';
      else if (c.tipo === 'tabela' || c.tipo === 'pessoas') {
        const n = colunasDe(c).length; const ins = [...el.querySelectorAll('input')].map((i) => i.value);
        const linhas = []; for (let i = 0; i < ins.length; i += n) linhas.push(ins.slice(i, i + n));
        v[c.id] = linhas.filter((l) => l.some((x) => x.trim()));
      } else v[c.id] = el.value;
    }
    return v;
  }
  return { TIPOS, CAMPOS, AUTO, EXEMPLO, nome, doc, montar, formulario, ligar, ler };
})();
