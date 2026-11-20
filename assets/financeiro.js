// Financeiro (#/financeiro; Cid, 20/11): seção própria do menu principal, com atalho em Ferramentas › Gestão.
// Primeira parte: Despesas fixas, com a previsão de custos do ano. Um CNPJ só: sem rateio por núcleo.
//
// Página (Registro com edição na linha; design.md § 0):
//   Abas em caixa (Financeiro | Despesas fixas) · título · cotação do dólar no canto
//   Placar: custo fixo por mês · sem pessoal · pessoal · previsão do ano · vencem em 7 dias
//   Filtros: busca · Seletor Ativas | Encerradas | Todas
//   Despesas: Régua, linha de criar sempre aberta (nome, valor, dia; Enter grava e abre a próxima; colar várias
//     linhas de uma planilha abre a prévia), grupos por categoria com o total do mês, e cada despesa editada na
//     própria linha (grava ao sair do campo; Esc desfaz). Detalhes recolhidos na linha (chevron à direita).
//   Pessoal: seção própria, sempre começa recolhida; fora da cópia do navegador.
//   Previsão de custos do ano: Seletor do ano, Gráfico dos 12 meses e Matriz categoria × mês.
//   Notas no fim.
// Moeda: R$ por padrão; um clique na etiqueta troca para US$. O valor fica em dólar; as somas convertem pela
// cotação do dia (PTAX) e ganham um * de previsão.
// Uma leitura só (GET /api/v1/financeiro/despesas); gravação pelas rotas comuns (despesas-fixas).

import { lerCopia, gravarCopia } from './memoria.js';
import {
  MESES, PERIODICIDADES, FORMAS, valorNoMes, emReais, custoMensal, previsaoAnual, proximoVencimento,
  diasAte, lerValor, moedaDoTexto, interpretarColagem, sugerirCategoria, reais, comMoeda,
} from './financeiro-calculo.js';

const COPIA = 'financeiro:despesas';
const LEMBRAR = 'financeiro:';

const SVG = {
  seta: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copiar: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  encerrar: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 8h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  reativar: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.8v2.6h2.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mais: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
};

const dataBr = (d) => (d ? d.split('-').reverse().join('/') : '');
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const nomeMes = (m) => MESES[m - 1];
const sem = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function criarFinanceiro({ esc, api, toque }) {
  let D = lerCopia(COPIA);            // { hoje, mes, cotacao, despesas, categorias, semPessoal? }
  let pagina = null;
  let buscando = null;
  const filtro = { q: '', situacao: 'ativas' };
  let ano = null;
  let pessoalAberto = false;          // começa sempre recolhida (dado restrito fechado até pedir)
  const abertos = new Set();          // despesas com os detalhes abertos
  const moedaNova = { geral: 'brl', pessoal: 'brl' };
  let armado = null;                  // arquivar pede um segundo clique
  const fechados = (() => { try { return new Set(JSON.parse(localStorage.getItem(LEMBRAR + 'fechados') || '[]')); } catch { return new Set(); } })();
  const lembrarFechados = () => { try { localStorage.setItem(LEMBRAR + 'fechados', JSON.stringify([...fechados])); } catch {} };

  const hoje = () => D?.hoje || hojeBR();
  // na página, encerrada = com fim até hoje (as contas seguem contando o próprio dia do fim)
  const fechada = (d) => !!d.fim && d.fim <= hoje();
  const cot = () => D?.cotacao || null;
  const achar = (id) => D?.despesas.find((d) => d.id === id);
  const doGrupo = (g) => (D?.despesas || []).filter((d) => (d.grupo || 'geral') === g);
  const estrela = (est) => (est ? '<sup class="fin-est" title="Previsão: tem valor em dólar convertido pela cotação do dia">*</sup>' : '');
  const brl = (centavos, est, o) => `R$ ${reais(centavos, o)}${estrela(est)}`;

  // ---- leitura -----------------------------------------------------------------

  async function carregar() {
    if (buscando) return buscando;
    buscando = (async () => {
      const r = await api('/api/v1/financeiro/despesas').catch((e) => ({ status: 0, erro: e.message }));
      if (r.status !== 200) { if (!D) desenhar(r.erro || `resposta ${r.status}`); return; }
      const { status, ...novo } = r;
      const mudou = JSON.stringify(novo) !== JSON.stringify(D);
      D = novo;
      // Pessoal fica fora da cópia guardada neste computador
      gravarCopia(COPIA, { ...D, despesas: D.despesas.filter((d) => d.grupo !== 'pessoal'), semPessoal: true });
      if (mudou) desenhar();
    })().finally(() => { buscando = null; });
    return buscando;
  }

  // ---- peças -------------------------------------------------------------------

  const caixa = (acao, svg, rotulo, extra = '') =>
    `<button type="button" class="fin-caixa" data-acao="${acao}"${extra} aria-label="${esc(rotulo)}" title="${esc(rotulo)}">${svg}</button>`;
  const seta = (aberto) => `<span class="bol-seta${aberto ? ' aberta' : ''}" aria-hidden="true">${SVG.seta}</span>`;
  const opcoes = (lista, atual, vazio) => (vazio !== undefined ? `<option value="">${esc(vazio)}</option>` : '') +
    lista.map(([v, n]) => `<option value="${esc(v)}"${String(atual ?? '') === String(v) ? ' selected' : ''}>${esc(n)}</option>`).join('');
  const opcoesMes = (atual, vazio) => opcoes(MESES.map((n, i) => [i + 1, n]), atual, vazio);

  function categoriasDe(g) {
    const usadas = doGrupo(g).map((d) => d.categoria).filter(Boolean);
    return [...new Set([...(D?.categorias?.[g] || []), ...usadas])];
  }

  function proximo(d) {
    if (fechada(d)) return `<span class="ini-etq opcional">encerrada em ${dataBr(d.fim)}</span>`;
    const p = proximoVencimento(d, hoje());
    if (!p) return '<span class="u-apoio">—</span>';
    const n = diasAte(p, hoje());
    const ate = d.fim ? `<small class="fin-ate">até ${dataBr(d.fim)}</small>` : '';
    if (n <= 7) return `<span class="ini-etq atencao" title="${dataBr(p)}">${n === 0 ? 'vence hoje' : n === 1 ? 'amanhã' : `em ${n} dias`}</span>${ate}`;
    return `<span class="fin-data">${dataBr(p).slice(0, p.slice(0, 4) === hoje().slice(0, 4) ? 5 : 10)}</span>${ate}`;
  }

  function campoValor(id, valor, moeda, grupo) {
    const usd = moeda === 'usd';
    return `<span class="fin-valor-cx${usd ? ' usd' : ''}">
        <button type="button" class="fin-moeda" data-acao="moeda"${grupo ? ` data-grupo="${grupo}"` : ''} title="Trocar a moeda" aria-label="Moeda: ${usd ? 'dólar' : 'real'}. Trocar">${usd ? 'US$' : 'R$'}</button>
        <input class="fin-campo num" data-campo="valor" inputmode="decimal" autocomplete="off" value="${valor === null || valor === undefined ? '' : esc(reais(valor))}"
          ${id ? '' : 'placeholder="0,00"'} aria-label="Valor">
      </span>`;
  }

  function linhaDespesa(d) {
    const fim = fechada(d);
    const aberto = abertos.has(d.id);
    const { valor, moeda } = { valor: d.valor, moeda: d.moeda };
    const conv = moeda === 'usd'
      ? (cot()?.valor ? `<small class="fin-conv">≈ ${brl(Math.round(valor * cot().valor), true)}</small>` : '<small class="fin-conv">sem cotação</small>')
      : '';
    const naoMensal = d.periodicidade !== 'mensal';
    return `<div class="fin-item${fim ? ' encerrada' : ''}${aberto ? ' aberto' : ''}" data-id="${esc(d.id)}">
      <div class="fin-linha">
        <span class="fin-c-nome"><input class="fin-campo fin-nome" data-campo="nome" value="${esc(d.nome)}" aria-label="Despesa" autocomplete="off"></span>
        <span class="fin-c-cat"><input class="fin-campo fin-etq" data-campo="categoria" value="${esc(d.categoria || '')}" list="fin-cats-${d.grupo}" placeholder="categoria" aria-label="Categoria" autocomplete="off"></span>
        <span class="fin-c-valor">${campoValor(d.id, valor, moeda)}${conv}</span>
        <span class="fin-c-per"><select class="fin-sel" data-campo="periodicidade" aria-label="Periodicidade">${opcoes(PERIODICIDADES, d.periodicidade)}</select>
          ${naoMensal ? `<select class="fin-sel fin-sel-mes" data-campo="mes" aria-label="${d.periodicidade === 'anual' ? 'Mês do pagamento' : 'Mês do primeiro pagamento'}" title="${d.periodicidade === 'anual' ? 'Mês do pagamento' : 'Mês do primeiro pagamento do ano'}">${opcoesMes(d.mes)}</select>` : ''}</span>
        <span class="fin-c-dia"><input class="fin-campo num" data-campo="dia" inputmode="numeric" value="${esc(d.dia)}" aria-label="Dia do vencimento" autocomplete="off"></span>
        <span class="fin-c-prox">${proximo(d)}</span>
        <span class="fin-c-cmd">
          ${caixa('duplicar', SVG.copiar, 'Duplicar')}
          ${fim ? caixa('reativar', SVG.reativar, 'Reativar') : caixa('encerrar', SVG.encerrar, 'Encerrar a partir de hoje')}
          ${caixa('detalhes', seta(aberto), aberto ? 'Fechar os detalhes' : 'Abrir os detalhes', ` aria-expanded="${aberto}"`)}
        </span>
      </div>
      ${aberto ? detalhes(d) : ''}
    </div>`;
  }

  function detalhes(d) {
    const vs = [...(d.valores || [])].reverse();
    const hist = vs.length > 1
      ? `<ul class="fin-hist">${vs.map((v) => `<li><b>${esc(comMoeda(v.valor, v.moeda))}</b> desde ${esc(nomeMes(+v.desde.slice(5)))}/${v.desde.slice(0, 4)}</li>`).join('')}</ul>`
      : '<p class="u-apoio">Só o valor atual. Quando o valor mudar, o anterior fica guardado aqui, com o mês.</p>';
    const outro = d.grupo === 'pessoal' ? ['geral', 'Mover para Despesas'] : ['pessoal', 'Mover para Pessoal'];
    return `<div class="fin-det">
      <div class="fin-det-col">
        <label class="u-campo"><span>Forma de pagamento</span><select data-campo="forma">${opcoes(FORMAS, d.forma, '—')}</select></label>
        <label class="u-campo"><span>Fornecedor</span><input data-campo="fornecedor" value="${esc(d.fornecedor || '')}" autocomplete="off"></label>
        <div class="fin-dupla">
          <label class="u-campo"><span>Início</span><input type="date" data-campo="inicio" value="${esc(d.inicio || '')}"></label>
          <label class="u-campo"><span>Fim</span><input type="date" data-campo="fim" value="${esc(d.fim || '')}"></label>
        </div>
      </div>
      <div class="fin-det-col">
        <div class="fin-dupla">
          <label class="u-campo"><span>Reajuste em</span><select data-campo="reajuste_mes">${opcoesMes(d.reajuste_mes, '—')}</select></label>
          <label class="u-campo"><span>Índice</span><input data-campo="reajuste_indice" value="${esc(d.reajuste_indice || '')}" placeholder="IGP-M, IPCA…" autocomplete="off"></label>
        </div>
        <label class="u-campo"><span>Observações</span><textarea data-campo="observacoes" rows="3">${esc(d.observacoes || '')}</textarea></label>
      </div>
      <div class="fin-det-col">
        <span class="fin-det-rot">Valores</span>${hist}
        <div class="fin-det-acoes">
          <button type="button" class="u-botao" data-acao="mover" data-para="${outro[0]}">${outro[1]}</button>
          <button type="button" class="u-botao perigo" data-acao="arquivar">${armado === d.id ? 'Confirmar: arquivar' : 'Arquivar (cadastrada por engano)'}</button>
        </div>
      </div>
    </div>`;
  }

  function linhaCriar(g) {
    return `<div class="fin-item fin-criar" data-grupo="${g}">
      <div class="fin-linha">
        <span class="fin-c-nome"><input class="fin-campo fin-nome" data-novo="nome" placeholder="${g === 'pessoal' ? 'Novo: pró-labore, salário, encargo…' : 'Nova despesa'}" aria-label="Nova despesa: nome" autocomplete="off"></span>
        <span class="fin-c-cat"><input class="fin-campo fin-etq" data-novo="categoria" list="fin-cats-${g}" placeholder="categoria" aria-label="Nova despesa: categoria" autocomplete="off"></span>
        <span class="fin-c-valor">${campoValor(null, null, moedaNova[g], g).replace('data-campo="valor"', 'data-novo="valor"')}</span>
        <span class="fin-c-per"><select class="fin-sel" data-novo="periodicidade" aria-label="Nova despesa: periodicidade">${opcoes(PERIODICIDADES, 'mensal')}</select></span>
        <span class="fin-c-dia"><input class="fin-campo num" data-novo="dia" inputmode="numeric" placeholder="dia" aria-label="Nova despesa: dia do vencimento" autocomplete="off"></span>
        <span class="fin-c-prox fin-dica">Enter grava</span>
        <span class="fin-c-cmd">${caixa('criar', SVG.mais, 'Acrescentar despesa')}</span>
      </div>
    </div>`;
  }

  const regua = () => `<div class="fin-regua"><span>Despesa</span><span>Categoria</span><span class="num">Valor</span><span>Periodicidade</span><span class="num">Dia</span><span>Próximo</span><span></span></div>`;

  function passaFiltro(d) {
    const fim = fechada(d);
    if (filtro.situacao === 'ativas' && fim) return false;
    if (filtro.situacao === 'encerradas' && !fim) return false;
    if (filtro.q) {
      const alvo = sem(`${d.nome} ${d.categoria || ''} ${d.fornecedor || ''}`);
      if (!sem(filtro.q).split(/\s+/).every((t) => alvo.includes(t))) return false;
    }
    return true;
  }

  function registro(g) {
    const todas = doGrupo(g);
    const lista = todas.filter(passaFiltro);
    const grupos = new Map();
    for (const d of lista) {
      const k = d.categoria || 'Sem categoria';
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(d);
    }
    const blocos = [...grupos.entries()]
      .sort((a, b) => (a[0] === 'Sem categoria') - (b[0] === 'Sem categoria') || a[0].localeCompare(b[0], 'pt'))
      .map(([cat, ds]) => {
        const soma = custoMensal(ds, cot(), hoje());
        ds.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
        return `<div class="fin-grupo"><b>${esc(cat)}</b><span class="fin-conta">${ds.length}</span>
            <span class="fin-grupo-soma">${soma.total || soma.estimado.total ? `${brl(soma.total, soma.estimado.total)}<small> por mês</small>` : ''}</span></div>
          ${ds.map(linhaDespesa).join('')}`;
      }).join('');
    const vazio = !todas.length
      ? '<p class="fin-vazio">Nenhuma despesa ainda. Escreva o nome, o valor e o dia na linha acima e aperte Enter. Para várias de uma vez, cole as linhas de uma planilha (nome, valor, dia) no campo do nome.</p>'
      : !lista.length ? '<p class="fin-vazio">Nada com esse filtro.</p>' : '';
    return `<datalist id="fin-cats-${g}">${categoriasDe(g).map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
      ${regua()}${linhaCriar(g)}${blocos}${vazio}`;
  }

  // ---- Placar e previsão ---------------------------------------------------------

  function placar() {
    const t = custoMensal(D.despesas, cot(), hoje());
    const anoAtual = +hoje().slice(0, 4);
    const pv = previsaoAnual(D.despesas, anoAtual, cot());
    const em7 = D.despesas.filter((d) => !fechada(d)).map((d) => ({ d, p: proximoVencimento(d, hoje()) }))
      .filter((x) => x.p && diasAte(x.p, hoje()) <= 7);
    const soma7 = em7.reduce((s, x) => { const v = valorNoMes(x.d, x.p.slice(0, 7)); const r = emReais(v.valor, v.moeda, cot()); s.v += r.brl; s.e ||= r.estimado; return s; }, { v: 0, e: false });
    const semP = D.semPessoal;
    const num = (rot, valor, pe) => `<div class="pas-num-cx"><span class="pas-rot">${rot}</span><b>${valor}</b><span class="pas-pe">${pe}</span></div>`;
    return `<div class="pas-placar fin-placar">
      ${num('Custo fixo por mês', semP ? '…' : brl(t.total, t.estimado.total, { centavosSempre: false }), 'despesas ativas, levadas ao mês')}
      ${num('Sem pessoal', brl(t.geral, t.estimado.geral, { centavosSempre: false }), 'espaço, software, taxas e o resto')}
      ${num('Pessoal', semP ? '…' : brl(t.pessoal, t.estimado.pessoal, { centavosSempre: false }), 'pró-labore, salários e encargos')}
      ${num(`Previsão ${anoAtual}`, semP ? '…' : brl(pv.total, pv.estimado, { centavosSempre: false }), 'jan a dez, cada uma no mês do pagamento')}
      ${num('Vencem em 7 dias', em7.length || '0', em7.length ? brl(soma7.v, soma7.e) : 'nenhuma')}
    </div>`;
  }

  // Gráfico dos 12 meses (colunas em HTML: o texto não escala com a largura)
  function graficoMeses(pv, anoAtual, mesAtual) {
    const max = Math.max(...pv.meses, 1);
    return `<div class="fin-grafico" role="img" aria-label="Previsão de custos de ${pv.ano}, mês a mês">
      ${pv.meses.map((v, i) => {
        const cls = pv.ano === anoAtual && i + 1 === mesAtual ? ' atual' : pv.ano === anoAtual && i + 1 < mesAtual ? ' passado' : '';
        const h = v ? Math.max(2, Math.round((v / max) * 100)) : 0;
        return `<div class="fin-col${cls}" title="${nomeMes(i + 1)}: R$ ${reais(v)}${pv.est[i] ? ' (previsão)' : ''}">
          <span class="fin-col-v">${v ? (v / 100000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : ''}</span>
          <span class="fin-col-trilho"><i style="height:${h}%"></i></span><span class="fin-col-m">${nomeMes(i + 1)}</span></div>`;
      }).join('')}
    </div>`;
  }

  function previsao() {
    const anoAtual = +hoje().slice(0, 4);
    const mesAtual = +hoje().slice(5, 7);
    const a = ano || anoAtual;
    const pv = previsaoAnual(D.despesas, a, cot(), { pessoalPorCategoria: pessoalAberto });
    const aberto = !fechados.has('previsao');
    const seletor = `<span class="pre-seletor fin-anos" role="group" aria-label="Ano">${[anoAtual, anoAtual + 1].map((y) =>
      `<button type="button" data-acao="ano" data-ano="${y}" class="${y === a ? 'ativo' : ''}" aria-pressed="${y === a}">${y}</button>`).join('')}</span>`;
    const cel = (v, est, i) => {
      const cls = a === anoAtual && i + 1 < mesAtual ? ' passado' : a === anoAtual && i + 1 === mesAtual ? ' atual' : '';
      return `<td class="num${cls}">${v ? reais(v, { centavosSempre: false }) + estrela(est) : '<span class="fin-zero">—</span>'}</td>`;
    };
    const corpo = pv.linhas.map((l) => `<tr${l.grupo === 'pessoal' ? ' class="fin-l-pessoal"' : ''}><th scope="row">${esc(l.categoria)}</th>
        ${l.meses.map((v, i) => cel(v, l.est[i], i)).join('')}<td class="num fin-tot">${reais(l.total, { centavosSempre: false })}${estrela(l.estimado)}</td></tr>`).join('');
    const tabela = pv.linhas.length ? `<div class="fin-matriz-cx"><table class="u-tabela fin-matriz">
        <thead><tr><th>R$</th>${MESES.map((m, i) => `<th class="num${a === anoAtual && i + 1 === mesAtual ? ' atual' : ''}">${m}</th>`).join('')}<th class="num">Total</th></tr></thead>
        <tbody>${corpo}</tbody>
        <tfoot><tr><th scope="row">Total</th>${pv.meses.map((v, i) => cel(v, pv.est[i], i)).join('')}<td class="num fin-tot">${reais(pv.total, { centavosSempre: false })}${estrela(pv.estimado)}</td></tr></tfoot>
      </table></div>` : '<p class="fin-vazio">A previsão aparece quando houver despesas cadastradas.</p>';
    return `<section class="fin-sec">
      <div class="fin-sec-cab">
        <button type="button" class="bol-titulo" data-acao="recolher" data-bloco="previsao" aria-expanded="${aberto}"><h2>Previsão de custos ${a}</h2>
          ${pv.total ? `<span class="fin-sec-soma">${brl(pv.total, pv.estimado, { centavosSempre: false })}</span>` : ''}</button>
        ${aberto ? seletor : ''}
        <button type="button" class="bol-caixa" data-acao="recolher" data-bloco="previsao" aria-label="${aberto ? 'Recolher' : 'Abrir'} a previsão">${seta(aberto)}</button>
      </div>
      ${aberto ? `<div class="fin-prev">
        ${pv.falta ? '<p class="fin-aviso">Sem a cotação do dólar, as despesas em US$ ficaram fora da previsão. Ela volta na próxima leitura.</p>' : ''}
        ${pv.linhas.length ? graficoMeses(pv, anoAtual, mesAtual) : ''}
        ${tabela}
      </div>` : ''}
    </section>`;
  }

  // ---- página --------------------------------------------------------------------

  const abas = () => `<nav class="abas-caixa-linha" aria-label="Financeiro"><span class="u-rotulo">Financeiro</span>
      <span class="abas-caixa"><a href="#/financeiro" class="ativa" aria-current="page">Despesas fixas</a></span></nav>`;

  function desenhar(erro) {
    if (!pagina?.isConnected) return;
    const c = cot();
    const lado = c?.valor ? `Dólar R$ ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 4 })} · PTAX de ${dataBr(c.data)}` : '';
    const cab = `${abas()}<div class="cab"><h1 class="u-titulo">Despesas fixas</h1>${lado ? `<div class="lado u-apoio">${esc(lado)}</div>` : ''}</div>`;
    if (!D) { pagina.innerHTML = cab + `<p class="u-apoio">${erro ? 'Não foi possível carregar: ' + esc(erro) : 'Carregando…'}</p>`; return; }

    // guarda o foco e o que está sendo digitado, para redesenhar sem perder nada
    const ativo = document.activeElement;
    const chave = ativo && pagina.contains(ativo) ? chaveDe(ativo) : null;
    const emCurso = chave ? { valor: ativo.value, ini: ativo.selectionStart, fim: ativo.selectionEnd } : null;
    const novos = {};
    pagina.querySelectorAll('.fin-criar').forEach((l) => {
      novos[l.dataset.grupo] = Object.fromEntries([...l.querySelectorAll('[data-novo]')].map((i) => [i.dataset.novo, i.value]));
    });
    const y = window.scrollY;

    const nPessoal = doGrupo('pessoal').filter((d) => !fechada(d)).length;
    pagina.innerHTML = cab + placar() + `
      <div class="bol-filtros fin-filtros">
        <input class="fin-busca" type="search" data-filtro="q" placeholder="Buscar despesa, categoria ou fornecedor" value="${esc(filtro.q)}" aria-label="Buscar">
        <span class="pre-seletor" role="group" aria-label="Situação">${[['ativas', 'Ativas'], ['encerradas', 'Encerradas'], ['todas', 'Todas']].map(([v, n]) =>
          `<button type="button" data-acao="situacao" data-v="${v}" class="${filtro.situacao === v ? 'ativo' : ''}" aria-pressed="${filtro.situacao === v}">${n}</button>`).join('')}</span>
        ${filtro.q || filtro.situacao !== 'ativas' ? '<button type="button" class="fin-limpar" data-acao="limpar">limpar</button>' : ''}
      </div>
      <section class="fin-sec fin-sec-primeira">
        <div class="fin-sec-cab"><h2 class="fin-sec-titulo">Despesas</h2><span class="fin-conta">${doGrupo('geral').filter((d) => !fechada(d)).length} ativas</span></div>
        ${registro('geral')}
      </section>
      <section class="fin-sec">
        <div class="fin-sec-cab">
          <button type="button" class="bol-titulo" data-acao="pessoal" aria-expanded="${pessoalAberto}"><h2>Pessoal</h2>
            <span class="fin-conta">${D.semPessoal ? '' : `${nPessoal} ${nPessoal === 1 ? 'ativa' : 'ativas'}`}</span></button>
          <button type="button" class="bol-caixa" data-acao="pessoal" aria-label="${pessoalAberto ? 'Recolher' : 'Abrir'} Pessoal">${seta(pessoalAberto)}</button>
        </div>
        ${pessoalAberto ? (D.semPessoal ? '<p class="u-apoio">Carregando…</p>' : registro('pessoal')) : ''}
      </section>
      ${previsao()}
      <section class="pas-notas">
        <div><h3 class="u-rotulo">Cadastro</h3>
          <p>Nome, valor e dia bastam: a despesa entra mensal e em reais, com a categoria sugerida pelo nome. Enter grava e abre a próxima. Para várias de uma vez, cole as linhas de uma planilha (nome, valor, dia) no campo do nome.</p>
          <p>Cada campo grava ao sair dele; Esc desfaz. <b>Encerrar</b> deixa a despesa de fora a partir de hoje; <b>arquivar</b> é para o que foi cadastrado por engano.</p></div>
        <div><h3 class="u-rotulo">Valores e dólar</h3>
          <p>Mudou o valor, o anterior fica guardado com o mês desde quando valia, e a previsão dos meses passados usa o valor da época.</p>
          <p>Um clique na etiqueta R$ troca para US$. O valor fica em dólar; nas somas ele vira real pela <b>PTAX de venda do Banco Central</b> do dia${c?.data ? ` (a de ${dataBr(c.data)})` : ''}, e o total ganha um <b>*</b>: é previsão.</p></div>
        <div><h3 class="u-rotulo">Previsão do ano</h3>
          <p>Cada despesa entra no mês em que é paga: mensal todo mês; trimestral e semestral a partir do mês dela; anual no mês dela, entre o início e o fim. Os reajustes futuros não entram.</p>
          <p>O <b>custo por mês</b> leva tudo ao mês (trimestral ÷ 3, semestral ÷ 6, anual ÷ 12). <b>Pessoal</b> abre recolhido, não fica guardado neste computador e, fechado, aparece numa linha só na previsão.</p></div>
      </section>`;

    for (const [g, vals] of Object.entries(novos)) {
      const l = pagina.querySelector(`.fin-criar[data-grupo="${g}"]`);
      if (l) for (const [k, v] of Object.entries(vals)) { const i = l.querySelector(`[data-novo="${k}"]`); if (i && v) i.value = v; }
    }
    if (chave) {
      const el = pagina.querySelector(chave);
      if (el) {
        if (emCurso && 'value' in el && el.tagName !== 'SELECT') {
          el.value = emCurso.valor;
          el.dataset.sujo = el.value !== valorOriginal(el) ? '1' : '';
        }
        el.focus({ preventScroll: true });
        try { if (emCurso?.ini !== null && emCurso?.ini !== undefined) el.setSelectionRange(emCurso.ini, emCurso.fim); } catch {}
      }
    }
    window.scrollTo(0, y);
    sugerir();
  }

  function chaveDe(el) {
    if (el.dataset.filtro) return `[data-filtro="${el.dataset.filtro}"]`;
    const criar = el.closest('.fin-criar');
    if (criar && el.dataset.novo) return `.fin-criar[data-grupo="${criar.dataset.grupo}"] [data-novo="${el.dataset.novo}"]`;
    const item = el.closest('.fin-item[data-id]');
    if (item && el.dataset.campo) return `.fin-item[data-id="${item.dataset.id}"] [data-campo="${el.dataset.campo}"]`;
    if (item && el.dataset.acao) return `.fin-item[data-id="${item.dataset.id}"] [data-acao="${el.dataset.acao}"]`;
    return null;
  }

  // valor guardado de um campo da linha, como aparece no campo
  function valorOriginal(el) {
    const d = achar(el.closest('.fin-item')?.dataset.id);
    if (!d) return '';
    const c = el.dataset.campo;
    if (c === 'valor') return reais(d.valor);
    return d[c] === null || d[c] === undefined ? '' : String(d[c]);
  }

  // categoria sugerida na linha de criar (placeholder), enquanto o nome é digitado
  function sugerir() {
    pagina?.querySelectorAll('.fin-criar').forEach((l) => {
      const nome = l.querySelector('[data-novo="nome"]').value;
      const cat = l.querySelector('[data-novo="categoria"]');
      cat.placeholder = sugerirCategoria(nome, l.dataset.grupo, D?.despesas || []) || 'categoria';
    });
  }

  // ---- gravação ------------------------------------------------------------------

  function guardarValorLocal(d) {
    const desde = d.inicio && d.inicio.slice(0, 7) > D.mes ? d.inicio.slice(0, 7) : D.mes;
    d.valores = (d.valores || []).filter((v) => v.desde !== desde);
    d.valores.push({ desde, valor: d.valor, moeda: d.moeda });
    d.valores.sort((a, b) => a.desde.localeCompare(b.desde));
  }

  async function salvar(id, campos, aviso) {
    const d = achar(id);
    if (!d) return;
    const r = await api(`/api/v1/despesas-fixas/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ versao: d.versao, ...campos }) })
      .catch((e) => ({ status: 0, erro: e.message }));
    if (r.status === 200) {
      const valores = d.valores;
      Object.assign(d, r.registro, { valores });
      if ('valor' in campos || 'moeda' in campos) guardarValorLocal(d);
      if (aviso) toque(aviso);
      desenhar();
      gravarCopia(COPIA, { ...D, despesas: D.despesas.filter((x) => x.grupo !== 'pessoal'), semPessoal: true });
      return true;
    }
    if (r.status === 409) { toque('Mudou em outro lugar: recarreguei a lista'); D = null; await carregar(); return false; }
    toque(r.erro || 'Não foi possível salvar');
    desenhar();
    return false;
  }

  function lerCampo(el) {
    const c = el.dataset.campo;
    const v = el.value;
    if (c === 'valor') {
      const n = lerValor(v);
      if (n === null) throw new Error('Valor: escreva um número, como 1.234,56');
      const m = moedaDoTexto(v);
      return m ? { valor: n, moeda: m } : { valor: n };
    }
    if (c === 'dia') {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 31) throw new Error('Dia: de 1 a 31');
      return { dia: n };
    }
    if (c === 'nome' && !v.trim()) throw new Error('A despesa precisa de um nome');
    if (['mes', 'reajuste_mes'].includes(c)) return { [c]: v ? Number(v) : null };
    return { [c]: v.trim() === '' ? null : v };
  }

  async function aoMudar(ev) {
    const el = ev.target;
    if (el.dataset.filtro) return;
    if (el.dataset.novo === 'periodicidade' || el.dataset.novo) return;
    const item = el.closest('.fin-item[data-id]');
    if (!item || !el.dataset.campo) return;
    el.dataset.sujo = '';
    let campos;
    try { campos = lerCampo(el); } catch (e) { toque(e.message); el.value = valorOriginal(el); return; }
    const d = achar(item.dataset.id);
    if (!d) return;
    const muda = Object.entries(campos).some(([k, v]) => d[k] !== v);
    if (!muda) { if ('valor' in campos) el.value = reais(d.valor); return; }
    await salvar(d.id, campos, campos.fim ? 'Encerrada: deixa de contar depois desse dia' : null);
  }

  async function criar(g) {
    const l = pagina.querySelector(`.fin-criar[data-grupo="${g}"]`);
    const val = (k) => l.querySelector(`[data-novo="${k}"]`);
    const nome = val('nome').value.trim();
    const valorTxt = val('valor').value;
    const valor = lerValor(valorTxt);
    const dia = Number(val('dia').value);
    const falta = !nome ? 'nome' : valor === null ? 'valor' : !(Number.isInteger(dia) && dia >= 1 && dia <= 31) ? 'dia' : null;
    if (falta) {
      toque({ nome: 'Falta o nome', valor: 'Falta o valor (ex.: 1.234,56)', dia: 'Falta o dia do vencimento (1 a 31)' }[falta]);
      val(falta).focus();
      return;
    }
    const moeda = moedaDoTexto(valorTxt) || moedaNova[g];
    const corpo = {
      nome, valor, dia, moeda, grupo: g, periodicidade: val('periodicidade').value,
      categoria: val('categoria').value.trim() || sugerirCategoria(nome, g, D.despesas) || null,
    };
    const b = l.querySelector('[data-acao="criar"]');
    b.disabled = true;
    const r = await api('/api/v1/despesas-fixas', { method: 'POST', body: JSON.stringify(corpo) }).catch((e) => ({ status: 0, erro: e.message }));
    b.disabled = false;
    if (r.status !== 201) { toque(r.erro || 'Não foi possível acrescentar'); return; }
    const d = { ...r.registro, valores: [] };
    guardarValorLocal(d);
    D.despesas.push(d);
    l.querySelectorAll('[data-novo]').forEach((i) => { i.value = i.tagName === 'SELECT' ? 'mensal' : ''; });
    moedaNova[g] = 'brl';
    if (filtro.situacao === 'encerradas') filtro.situacao = 'ativas';
    val('nome').focus();
    desenhar();
    pagina.querySelector(`.fin-criar[data-grupo="${g}"] [data-novo="nome"]`)?.focus();
    toque(`${nome} acrescentada`);
  }

  async function duplicar(id) {
    const d = achar(id);
    const campos = ['grupo', 'categoria', 'moeda', 'valor', 'periodicidade', 'dia', 'mes', 'forma', 'fornecedor', 'reajuste_mes', 'reajuste_indice', 'observacoes'];
    const corpo = Object.fromEntries(campos.map((k) => [k, d[k]]));
    corpo.nome = `${d.nome} (cópia)`;
    const r = await api('/api/v1/despesas-fixas', { method: 'POST', body: JSON.stringify(corpo) }).catch((e) => ({ status: 0, erro: e.message }));
    if (r.status !== 201) { toque(r.erro || 'Não foi possível duplicar'); return; }
    const n = { ...r.registro, valores: [] };
    guardarValorLocal(n);
    D.despesas.push(n);
    desenhar();
    const campo = pagina.querySelector(`.fin-item[data-id="${n.id}"] [data-campo="nome"]`);
    campo?.focus(); campo?.select();
  }

  async function arquivar(id) {
    const d = achar(id);
    const r = await api(`/api/v1/despesas-fixas/${encodeURIComponent(id)}/arquivar`, { method: 'POST', body: JSON.stringify({ versao: d.versao }) })
      .catch((e) => ({ status: 0, erro: e.message }));
    armado = null;
    if (r.status !== 200) { toque(r.erro || 'Não foi possível arquivar'); desenhar(); return; }
    D.despesas = D.despesas.filter((x) => x.id !== id);
    abertos.delete(id);
    toque(`${d.nome} arquivada`);
    desenhar();
  }

  // ---- colar várias linhas -------------------------------------------------------

  function previaColagem(g, texto) {
    const linhas = interpretarColagem(texto).map((l) => ({ ...l, categoria: sugerirCategoria(l.nome, g, D.despesas) }));
    const boas = linhas.filter((l) => l.ok);
    const dlg = document.createElement('dialog');
    dlg.className = 'fin-dialogo';
    dlg.innerHTML = `<form method="dialog">
      <div class="fin-dlg-cab"><h2>Acrescentar ${boas.length} ${boas.length === 1 ? 'despesa' : 'despesas'}${g === 'pessoal' ? ' em Pessoal' : ''}</h2>
        <button type="button" class="fin-caixa" data-fechar aria-label="Fechar"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4 12 12M12 4 4 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></div>
      <div class="fin-dlg-corpo"><table class="u-tabela"><thead><tr><th>Despesa</th><th class="num">Valor</th><th class="num">Dia</th><th>Categoria</th><th></th></tr></thead>
        <tbody>${linhas.map((l) => `<tr${l.ok ? '' : ' class="fin-ruim"'}><td>${esc(l.nome || '—')}</td>
          <td class="num">${l.valor === null ? '—' : esc(comMoeda(l.valor, l.moeda))}</td><td class="num">${l.dia ?? '—'}</td>
          <td>${l.categoria ? `<span class="ini-etq cre-etq-nevoa">${esc(l.categoria)}</span>` : '<span class="u-apoio">—</span>'}</td>
          <td>${l.ok ? '' : '<span class="ini-etq problema">falta valor ou dia</span>'}</td></tr>`).join('')}</tbody></table>
        <p class="u-apoio">Cada linha: nome, valor e dia, separados por tabulação (como sai da planilha) ou ponto e vírgula. Entram mensais; o que tiver US$ no valor entra em dólar. As linhas marcadas ficam de fora.</p></div>
      <div class="fin-dlg-pe"><button type="button" class="u-botao" data-fechar>Cancelar</button>
        <button type="submit" class="u-botao forte" ${boas.length ? '' : 'disabled'}>Acrescentar ${boas.length}</button></div>
    </form>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('click', (e) => { if (e.target.closest('[data-fechar]')) dlg.close(); });
    dlg.addEventListener('close', () => dlg.remove());
    dlg.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const bt = dlg.querySelector('[type="submit"]');
      bt.disabled = true; bt.textContent = 'Acrescentando…';
      const itens = boas.map((l) => ({ nome: l.nome, valor: l.valor, dia: l.dia, moeda: l.moeda, grupo: g, categoria: l.categoria, periodicidade: 'mensal' }));
      const r = await api('/api/v1/financeiro/despesas/lote', { method: 'POST', body: JSON.stringify({ itens }) }).catch((er) => ({ status: 0, erro: er.message }));
      dlg.close();
      if (r.status !== 201) { toque(r.erro || 'Não foi possível acrescentar'); return; }
      toque(`${r.criadas.length} acrescentadas${r.erros.length ? `; ${r.erros.length} com erro` : ''}`);
      await carregar();
    });
    dlg.showModal();
  }

  // ---- eventos -------------------------------------------------------------------

  async function aoClicar(ev) {
    const b = ev.target.closest('[data-acao]');
    if (!b || b.disabled) return;
    const acao = b.dataset.acao;
    const id = b.closest('.fin-item[data-id]')?.dataset.id;
    if (acao !== 'arquivar') armado = null;
    if (acao === 'situacao') { filtro.situacao = b.dataset.v; return desenhar(); }
    if (acao === 'limpar') { filtro.q = ''; filtro.situacao = 'ativas'; return desenhar(); }
    if (acao === 'ano') { ano = +b.dataset.ano; return desenhar(); }
    if (acao === 'pessoal') { pessoalAberto = !pessoalAberto; return desenhar(); }
    if (acao === 'recolher') {
      const k = b.dataset.bloco;
      fechados.has(k) ? fechados.delete(k) : fechados.add(k);
      lembrarFechados();
      return desenhar();
    }
    if (acao === 'criar') return criar(b.closest('.fin-criar').dataset.grupo);
    if (acao === 'moeda') {
      if (!id) {
        const g = b.dataset.grupo;
        moedaNova[g] = moedaNova[g] === 'usd' ? 'brl' : 'usd';
        b.textContent = moedaNova[g] === 'usd' ? 'US$' : 'R$';
        b.closest('.fin-valor-cx').classList.toggle('usd', moedaNova[g] === 'usd');
        return;
      }
      const d = achar(id);
      return salvar(id, { moeda: d.moeda === 'usd' ? 'brl' : 'usd' });
    }
    if (!id) return;
    if (acao === 'detalhes') { abertos.has(id) ? abertos.delete(id) : abertos.add(id); return desenhar(); }
    if (acao === 'duplicar') return duplicar(id);
    if (acao === 'encerrar') return salvar(id, { fim: hoje() }, 'Encerrada: deixa de contar a partir de amanhã');
    if (acao === 'reativar') return salvar(id, { fim: null }, 'Reativada');
    if (acao === 'mover') return salvar(id, { grupo: b.dataset.para, categoria: null }, b.dataset.para === 'pessoal' ? 'Movida para Pessoal' : 'Movida para Despesas');
    if (acao === 'arquivar') {
      if (armado !== id) { armado = id; desenhar(); setTimeout(() => { if (armado === id) { armado = null; desenhar(); } }, 4000); return; }
      return arquivar(id);
    }
  }

  function aoTeclar(ev) {
    const el = ev.target;
    if (el.dataset.novo && ev.key === 'Enter') { ev.preventDefault(); return criar(el.closest('.fin-criar').dataset.grupo); }
    if (!el.dataset.campo || el.tagName === 'SELECT') return;
    if (ev.key === 'Enter' && el.tagName !== 'TEXTAREA') { ev.preventDefault(); el.blur(); }
    if (ev.key === 'Escape') { el.value = valorOriginal(el); el.dataset.sujo = ''; el.blur(); }
  }

  function aoDigitar(ev) {
    const el = ev.target;
    if (el.dataset.filtro === 'q') {
      filtro.q = el.value;
      clearTimeout(aoDigitar.t);
      aoDigitar.t = setTimeout(desenhar, 200);
      return;
    }
    if (el.dataset.novo === 'nome') sugerir();
    if (el.dataset.campo) el.dataset.sujo = '1';
  }

  function aoColar(ev) {
    const el = ev.target;
    if (el.dataset.novo !== 'nome') return;
    const texto = ev.clipboardData?.getData('text') || '';
    if (!/\r?\n./.test(texto.trim())) return; // uma linha só: cola normal
    ev.preventDefault();
    previaColagem(el.closest('.fin-criar').dataset.grupo, texto);
  }

  function ligar(raiz) {
    pagina = raiz;
    raiz.addEventListener('click', aoClicar);
    raiz.addEventListener('change', aoMudar);
    raiz.addEventListener('keydown', aoTeclar);
    raiz.addEventListener('input', aoDigitar);
    raiz.addEventListener('paste', aoColar);
    desenhar();
    carregar();
  }

  return { ligar, carregar };
}
