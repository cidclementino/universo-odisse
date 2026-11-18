// Página Documentos do hub (#/documentos): emitir carta (com a opção ofício), declaração e memorando,
// e baixar as folhas em branco. O conteúdo fica no banco do Universo (/api/v1/documentos); o desenho
// da folha vem da Marca (marca.odisse.com.br/v1/documentos/documentos.js), que todas as ferramentas usam.
//
// Rotas: #/documentos (lista) · #/documentos/novo/<tipo>[?modelo=ficha] · #/documentos/<id>
//
// Quem assina: seletor comum (base/v1/assinantes.js) com a equipe que pode assinar documentos. O documento guarda a
// cópia de cada assinante. A rubrica (iniciais) sai abaixo da identificação: na prévia, só a caixa do lugar dela;
// a imagem é lida da Equipe só ao baixar o PDF (cada leitura vai para o histórico).

import { seletorAssinantes } from '../base/v1/assinantes.js';

const MONTADOR = 'https://marca.odisse.com.br/v1/documentos/documentos.js';

const TIPOS = {
  carta: { nome: 'Carta', sigla: 'CA' },
  oficio: { nome: 'Ofício', sigla: 'CA', tipo: 'carta', oficio: 1 },
  declaracao: { nome: 'Declaração', sigla: 'DE' },
  memorando: { nome: 'Memorando', sigla: 'MI' },
};
const NOME_TIPO = (d) => (d.tipo === 'carta' && d.oficio ? 'Ofício' : TIPOS[d.tipo]?.nome || d.tipo);
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const porExtenso = (d) => { if (!d) return ''; const [a, m, dia] = d.split('-').map(Number); return `${dia} de ${MESES[m - 1]} de ${a}`; };
const curta = (d) => (d ? d.split('-').reverse().join('/') : '');
const paragrafos = (t) => String(t || '').split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);

// Registro do banco → conteúdo para o montador da Marca. É aqui que o tipo decide os campos;
// a folha (Coluna ou Ficha) é só formatação. `rubricas` (equipe_id → endereço da imagem) só na emissão;
// sem ele, quem tem rubrica aparece com a caixa do lugar dela.
export function paraMontador(d, rubricas = null) {
  const ficha = d.modelo === 'ficha';
  const data = ficha ? curta(d.data) : [d.local, porExtenso(d.data)].filter(Boolean).join(', ');
  const num = { rotulo: 'Nº', valor: d.codigo || 'ao salvar' };
  const c = [];
  if (d.tipo === 'carta') {
    c.push({ rotulo: 'Para', valor: d.destinatario || '' }, { rotulo: 'Data', valor: data }, num);
    if (d.oficio && d.referencia) c.push({ rotulo: 'Referência', valor: d.referencia, largo: true });
    if (d.assunto) c.push({ rotulo: 'Assunto', valor: d.assunto, largo: true });
  } else if (d.tipo === 'memorando') {
    c.push({ rotulo: 'Para', valor: d.destinatario || '' }, { rotulo: 'De', valor: d.remetente || '' }, { rotulo: 'Data', valor: data }, num);
    if (d.assunto) c.push({ rotulo: 'Assunto', valor: d.assunto, largo: true });
  } else {
    c.push({ rotulo: 'Data', valor: data }, num);
    if (d.destinatario) c.splice(0, 0, { rotulo: 'Para', valor: d.destinatario });
  }
  let ass = [];
  try { ass = typeof d.assinaturas === 'string' ? JSON.parse(d.assinaturas) : d.assinaturas || []; } catch { ass = []; }
  return {
    modelo: d.modelo || 'coluna', miolo: 'texto', codigo: d.codigo || '', campos: c,
    titulo: d.tipo === 'declaracao' ? (d.titulo || 'Declaração') : d.titulo || '',
    saudacao: d.saudacao || '', paragrafos: paragrafos(d.corpo), fecho: d.fecho || '',
    assinaturas: ass.map((a) => ({ nome: a.nome, cargo: a.cargo, registro: a.registro,
      rubrica: !a.equipe_id || !a.rubrica ? undefined : rubricas ? rubricas[a.equipe_id] : 'caixa' })),
    anexos: d.oficio ? d.anexos || '' : '',
  };
}

// Folhas em branco (sem número): para baixar e usar fora do Universo.
const BRANCAS = [
  { id: 'coluna', nome: 'Coluna em branco', desc: 'Comunicados e textos livres.', doc: { modelo: 'coluna', miolo: 'vazio' } },
  { id: 'ficha', nome: 'Ficha em branco', desc: 'Tabela de campos para preencher à mão.', doc: { modelo: 'ficha', miolo: 'vazio',
    campos: [{ rotulo: 'Para', valor: '' }, { rotulo: 'Data', valor: '' }, { rotulo: 'Nº', valor: '' }, { rotulo: 'Assunto', valor: '', largo: true }] } },
  { id: 'levantamento', nome: 'Levantamento', desc: 'Ficha com quadrícula de pontos de 5 mm.', doc: { modelo: 'ficha', miolo: 'pontos',
    campos: [{ rotulo: 'Projeto', valor: '' }, { rotulo: 'Ambiente', valor: '' }, { rotulo: 'Data', valor: '' }, { rotulo: 'Folha', valor: '' }] } },
];

const CAMPOS = { // o que cada tipo mostra no formulário
  carta: ['modelo', 'oficio', 'data', 'local', 'destinatario', 'referencia', 'assunto', 'saudacao', 'corpo', 'fecho', 'assinaturas', 'anexos', 'observacoes'],
  declaracao: ['modelo', 'data', 'local', 'destinatario', 'titulo', 'corpo', 'fecho', 'assinaturas', 'observacoes'],
  memorando: ['modelo', 'data', 'remetente', 'destinatario', 'assunto', 'corpo', 'assinaturas', 'observacoes'],
};
const ROTULOS = {
  destinatario: ['Para', 'Uma informação por linha: nome, cargo, organização, endereço.'],
  remetente: ['De', ''], referencia: ['Referência', 'Processo, protocolo ou documento a que o ofício responde.'],
  assunto: ['Assunto', ''], titulo: ['Título', ''], saudacao: ['Saudação', 'Ex.: Prezado(a) Fulano,'],
  corpo: ['Texto', 'Separe os parágrafos com uma linha em branco. Texto longo continua em outra folha.'],
  fecho: ['Fecho', 'Ex.: Atenciosamente,'], anexos: ['Anexos', 'Um por linha.'], local: ['Local', ''],
  observacoes: ['Observações internas', 'Não aparecem no documento.'],
};

export function criarDocumentos({ esc, api, apiBinario, toque, lerOdisse }) {
  let avisoSaida = () => false;
  window.addEventListener('beforeunload', (ev) => { if (avisoSaida()) { ev.preventDefault(); ev.returnValue = ''; } });
  let copia = null; // conteúdo levado pelo Duplicar até o editor novo
  let mod = null; // módulo da Marca
  let rec = null;
  const carregarMontador = async () => {
    if (!mod) { mod = await import(MONTADOR); rec = await mod.recursos(); }
    return mod;
  };

  // ---- lista ----------------------------------------------------------------
  async function lista(raiz) {
    avisoSaida = () => false;
    raiz.innerHTML = `<div class="cab"><div><h1 class="u-titulo">Documentos</h1>
        <p class="u-apoio">Cartas, ofícios, declarações e memorandos do estúdio, numerados e guardados no Universo.
        A folha (Coluna ou Ficha) vem da Marca.</p></div>
        <div class="acoes-cab">${Object.entries(TIPOS).map(([id, t]) => `<a class="u-botao" href="#/documentos/novo/${id}">+ ${t.nome}</a>`).join('')}</div></div>
      <section class="bloco"><span class="u-rotulo">Folhas em branco</span>
        <p class="u-apoio">Sem número, para imprimir ou usar fora do Universo. O PDF sai pela janela de impressão: escolha “Salvar como PDF”.</p>
        <div class="cartoes compactos">${BRANCAS.map((b) => `<div class="u-cartao item"><div class="topo"><b>${esc(b.nome)}</b></div>
          <p>${esc(b.desc)}</p><div class="rodape"><button class="u-botao" data-branca="${b.id}">Baixar PDF</button></div></div>`).join('')}</div></section>
      <section class="bloco"><span class="u-rotulo">Emitidos</span>
        <div class="docs-filtros"><label class="u-campo"><span>Tipo</span><select data-f="tipo"><option value="">Todos</option>
          <option value="carta">Carta e ofício</option><option value="declaracao">Declaração</option><option value="memorando">Memorando</option></select></label>
          <label class="u-campo"><span>Buscar</span><input type="search" data-f="q" placeholder="código, assunto, destinatário"></label></div>
        <div data-lista><p class="u-apoio">Carregando…</p></div></section>`;
    raiz.querySelectorAll('[data-branca]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { const m = await carregarMontador(); const x = BRANCAS.find((y) => y.id === b.dataset.branca); await m.imprimir(x.doc, rec, `odisse-${x.id}`); }
      catch (e) { toque('Não foi possível montar a folha: ' + e.message); }
      b.disabled = false;
    }));
    const caixa = raiz.querySelector('[data-lista]');
    const carregar = async () => {
      const p = new URLSearchParams({ limite: '200' });
      const tipo = raiz.querySelector('[data-f="tipo"]').value, q = raiz.querySelector('[data-f="q"]').value.trim();
      if (tipo) p.set('tipo', tipo);
      if (q) p.set('q', q);
      const r = await api('/api/v1/documentos?' + p);
      if (r.status !== 200) { caixa.innerHTML = `<p class="u-apoio">Não foi possível ler os documentos (${esc(r.erro || r.status)}).</p>`; return; }
      if (!r.itens.length) { caixa.innerHTML = '<p class="u-apoio">Nenhum documento ainda.</p>'; return; }
      caixa.innerHTML = `<table class="u-tabela docs-tabela"><thead><tr><th>Nº</th><th>Tipo</th><th>Assunto</th><th>Para</th><th>Data</th></tr></thead><tbody>
        ${r.itens.map((d) => `<tr data-id="${esc(d.id)}"><td><a href="#/documentos/${esc(d.id)}">${esc(d.codigo)}</a></td><td>${esc(NOME_TIPO(d))}</td>
          <td>${esc(d.assunto || d.titulo || '')}</td><td>${esc((d.destinatario || '').split('\n')[0])}</td><td>${esc(curta(d.data))}</td></tr>`).join('')}
        </tbody></table>`;
    };
    let t;
    raiz.querySelectorAll('[data-f]').forEach((i) => i.addEventListener('input', () => { clearTimeout(t); t = setTimeout(carregar, 250); }));
    carregar();
  }

  // Rubricas para a emissão: lidas da Equipe agora (a atual de cada pessoa), uma leitura por assinante,
  // ligada ao documento no histórico. Quem não tem, ou não pode mais assinar documentos, sai sem.
  async function lerRubricas(d) {
    let ass = [];
    try { ass = JSON.parse(d.assinaturas || '[]'); } catch { ass = []; }
    const saida = {}, faltou = [];
    for (const a of ass) {
      if (!a.equipe_id || !a.rubrica || saida[a.equipe_id]) continue;
      const r = await apiBinario(`/api/v1/equipe/${a.equipe_id}/assinatura?uso=documento&registro=${encodeURIComponent(d.id)}`);
      if (r.ok) saida[a.equipe_id] = URL.createObjectURL(await r.blob());
      else faltou.push(a.nome);
    }
    if (faltou.length) toque(`Sem rubrica no PDF: ${faltou.join(', ')} (não encontrada na Equipe).`);
    return saida;
  }

  // ---- editor ---------------------------------------------------------------
  async function editor(raiz, id, novoTipo, base) {
    let reg;
    if (id) {
      raiz.innerHTML = '<p class="u-apoio">Carregando…</p>';
      const r = await api('/api/v1/documentos/' + id);
      if (r.status !== 200) { raiz.innerHTML = `<p class="u-apoio">Documento não encontrado (${esc(r.erro || r.status)}).</p>`; return; }
      reg = r.registro;
    } else {
      const t = TIPOS[novoTipo] || TIPOS.carta;
      const odisse = lerOdisse();
      reg = { tipo: t.tipo || novoTipo, oficio: t.oficio || 0, modelo: new URLSearchParams(location.hash.split('?')[1] || '').get('modelo') || 'coluna',
        data: hoje(), local: odisse?.endereco?.cidade || 'João Pessoa', assinaturas: '[]',
        saudacao: '', fecho: (t.tipo || novoTipo) === 'carta' ? 'Atenciosamente,' : '', titulo: novoTipo === 'declaracao' ? 'Declaração' : '' };
      if (base) Object.assign(reg, base, { id: undefined, codigo: undefined, numero: undefined, versao: undefined, data: hoje() });
    }
    let assin = [];
    try { assin = JSON.parse(reg.assinaturas || '[]'); } catch { assin = []; }
    let sujo = false;
    const campos = CAMPOS[reg.tipo];

    const campo = (k) => {
      const v = reg[k] ?? '';
      if (k === 'modelo') return `<div class="u-campo"><span>Folha</span><div class="docs-escolha">
        ${['coluna', 'ficha'].map((m) => `<label><input type="radio" name="modelo" value="${m}"${reg.modelo === m ? ' checked' : ''}> ${m === 'coluna' ? 'Coluna' : 'Ficha'}</label>`).join('')}</div></div>`;
      if (k === 'oficio') return `<label class="docs-check"><input type="checkbox" name="oficio"${reg.oficio ? ' checked' : ''}> Ofício (acrescenta referência e anexos)</label>`;
      if (k === 'data') return `<label class="u-campo"><span>Data</span><input type="date" name="data" value="${esc(v)}" required></label>`;
      if (k === 'assinaturas') return `<div class="u-campo"><span>Assinaturas</span><div data-assin></div>
        <small>A rubrica de quem tem iniciais na Equipe sai abaixo da identificação, só no PDF.</small></div>`;
      const [rot, ajuda] = ROTULOS[k] || [k, ''];
      const oficioSo = ['referencia', 'anexos'].includes(k) ? ` data-oficio${reg.oficio ? '' : ' hidden'}` : '';
      const longo = ['destinatario', 'remetente', 'corpo', 'anexos', 'observacoes'].includes(k);
      return `<label class="u-campo"${oficioSo}><span>${esc(rot)}</span>${longo
        ? `<textarea name="${k}" rows="${k === 'corpo' ? 14 : 3}">${esc(v)}</textarea>`
        : `<input name="${k}" value="${esc(v)}">`}${ajuda ? `<small>${esc(ajuda)}</small>` : ''}</label>`;
    };

    raiz.innerHTML = `<div class="cab"><div><a class="u-apoio" href="#/documentos">← Documentos</a>
        <h1 class="u-titulo">${esc(NOME_TIPO(reg))} ${reg.codigo ? esc(reg.codigo) : '<span class="u-apoio">· novo</span>'}</h1></div>
        <div class="acoes-cab"><span class="u-apoio" data-estado></span>
          <button class="u-botao" data-acao="duplicar"${reg.id ? '' : ' hidden'}>Duplicar</button>
          <button class="u-botao perigo" data-acao="arquivar"${reg.id ? '' : ' hidden'}>Arquivar</button>
          <button class="u-botao" data-acao="pdf">Baixar PDF</button>
          <button class="u-botao forte" data-acao="salvar">${reg.id ? 'Salvar' : 'Salvar e numerar'}</button></div></div>
      <div class="docs-editor"><form class="docs-form" autocomplete="off">${campos.map(campo).join('')}</form>
        <div class="docs-previa"><div class="docs-escala"><div data-folhas></div></div></div></div>`;

    const form = raiz.querySelector('form');
    const estado = raiz.querySelector('[data-estado]');
    const caixaAssin = raiz.querySelector('[data-assin]');
    if (caixaAssin) {
      seletorAssinantes(caixaAssin, {
        uso: 'documento',
        valor: assin,
        novo: !reg.id && !base,
        carregar: async () => {
          const r = await api('/api/v1/equipe/assinantes?para=documento');
          if (r.status !== 200) throw new Error(r.erro || String(r.status));
          return r.itens;
        },
        foto: async (p) => {
          const r = await apiBinario(`/api/v1/equipe/${p.id}/foto?variante=s`);
          return r.ok ? URL.createObjectURL(await r.blob()) : null;
        },
        aoMudar: (lista) => { assin = lista; mudou(); },
      });
    }

    const ler = () => {
      const f = new FormData(form);
      const d = { ...reg };
      for (const k of campos) {
        if (k === 'assinaturas') d.assinaturas = JSON.stringify(assin.filter((a) => a.equipe_id || a.nome || a.cargo || a.registro));
        else if (k === 'oficio') d.oficio = form.elements.oficio.checked ? 1 : 0;
        else d[k] = (f.get(k) ?? '').toString();
      }
      return d;
    };

    // prévia: montada em tamanho real e reduzida por transformação (a paginação é a mesma do PDF)
    const caixaFolhas = raiz.querySelector('[data-folhas]');
    const escala = raiz.querySelector('.docs-escala');
    let tPrevia, rodada = 0;
    const previa = async () => {
      const minha = ++rodada;
      try {
        const m = await carregarMontador();
        const n = await m.montar(caixaFolhas, paraMontador(ler()), rec);
        if (minha !== rodada) return;
        const k = Math.min(1, (escala.parentElement.clientWidth - 2) / 794);
        caixaFolhas.style.transform = `scale(${k})`;
        escala.style.height = `${(n * 1123 + (n - 1) * 24) * k}px`;
      } catch (e) {
        caixaFolhas.innerHTML = `<p class="u-apoio">Não foi possível montar a prévia: ${esc(e.message)}</p>`;
      }
    };
    const mudou = () => { sujo = true; estado.textContent = 'não salvo'; clearTimeout(tPrevia); tPrevia = setTimeout(previa, 250); };
    form.addEventListener('input', (ev) => {
      if (ev.target.name === 'oficio') form.querySelectorAll('[data-oficio]').forEach((x) => { x.hidden = !ev.target.checked; });
      if (ev.target.closest('[data-assin]')) return; // o seletor avisa pelo aoMudar
      mudou();
    });
    window.addEventListener('resize', () => { clearTimeout(tPrevia); tPrevia = setTimeout(previa, 150); }, { once: true });

    const salvar = async () => {
      const d = ler();
      const corpo = {};
      for (const k of campos) corpo[k] = d[k] === '' ? null : d[k];
      corpo.oficio = d.oficio ? 1 : 0;
      let r;
      if (reg.id) r = await api('/api/v1/documentos/' + reg.id, { method: 'PATCH', body: JSON.stringify({ versao: reg.versao, ...corpo }) });
      else r = await api('/api/v1/documentos', { method: 'POST', body: JSON.stringify({ tipo: reg.tipo, ...corpo }) });
      if (r.status === 409 && r.erro === 'conflito') { toque('Alguém salvou este documento antes. Recarregue a página.'); return null; }
      if (r.status >= 400) { toque('Não foi possível salvar: ' + (r.erro || r.status) + (r.campo ? ` (${r.campo})` : '')); return null; }
      const novo = !reg.id;
      reg = r.registro; sujo = false; estado.textContent = 'salvo';
      if (novo) { history.replaceState(null, '', '#/documentos/' + reg.id); editor(raiz, reg.id); return reg; }
      return reg;
    };

    raiz.querySelector('.acoes-cab').addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-acao]');
      if (!b) return;
      b.disabled = true;
      try {
        if (b.dataset.acao === 'salvar') { if (await salvar()) toque('Salvo'); }
        if (b.dataset.acao === 'pdf') {
          if (!reg.id || sujo) {
            if (!confirm(reg.id ? 'Salvar as mudanças antes de baixar o PDF?' : 'Para ter número, o documento precisa ser salvo. Salvar e numerar agora?')) return;
            if (!(await salvar())) return;
          }
          const m = await carregarMontador();
          const rubricas = await lerRubricas(reg);
          try {
            await m.imprimir(paraMontador(reg, rubricas), rec, `${reg.codigo} ${reg.assunto || reg.titulo || NOME_TIPO(reg)}`.trim());
          } finally { Object.values(rubricas).forEach((u) => URL.revokeObjectURL(u)); }
        }
        if (b.dataset.acao === 'duplicar') {
          if (sujo && !confirm('As mudanças não salvas vão só para a cópia. Continuar?')) return;
          copia = ler(); sujo = false;
          location.hash = `#/documentos/novo/${reg.tipo === 'carta' && reg.oficio ? 'oficio' : reg.tipo}`;
        }
        if (b.dataset.acao === 'arquivar') {
          if (!confirm(`Arquivar ${reg.codigo}? O número não volta a ser usado.`)) return;
          const r = await api(`/api/v1/documentos/${reg.id}/arquivar`, { method: 'POST', body: JSON.stringify({ versao: reg.versao }) });
          if (r.status >= 400) toque('Não foi possível arquivar: ' + (r.erro || r.status));
          else location.hash = '#/documentos';
        }
      } finally { b.disabled = false; }
    });
    avisoSaida = () => sujo;
    previa();
  }

  return {
    ligar(raiz) {
      const partes = location.hash.split('?')[0].split('/').slice(2); // ['novo','carta'] | ['doc_…'] | []
      if (partes[0] === 'novo') { const base = copia; copia = null; return editor(raiz, null, partes[1] || 'carta', base); }
      if (partes[0]) return editor(raiz, partes[0]);
      return lista(raiz);
    },
  };
}
