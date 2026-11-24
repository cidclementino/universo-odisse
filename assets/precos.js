// Mapa de preços (#/precos) — quanto o mercado público paga por projetos.
//
// Uma leitura só (GET /api/precos → Radar, ponto de entrada Universo, precos()):
//   contratos  contratos só de projeto assinados (PNCP, Brasil inteiro), com os links do contrato e do
//              termo de referência e, quando o TR foi lido, a área, as fases e o prazo (palpites)
//   concursos  concursos em que o site oficial diz como o vencedor será contratado (valor do contrato)
// Combinação Painel: Filtros → Placar → Gráfico (faixas de valor) → Matriz (por estado) → Registro
// (contratos, 10 por página) → Registro (concursos) → notas. Abre na hora com a última cópia (memoria.js).

import { lerCopia, gravarCopia, igual } from './memoria.js';
import { numeros, segmentado } from '../base/v2/componentes.js';

const COPIA = 'precos';
const POR_PAGINA = 10;
const NORDESTE = ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'];
const ESCOPOS = [['', 'Todos'], ['arquitetura', 'Arquitetura'], ['interiores', 'Interiores'], ['urbanismo', 'Urbanismo'], ['restauro', 'Restauro'], ['paisagismo', 'Paisagismo']];
const ORDENS = [['recentes', 'Recentes'], ['maior', 'Maior valor'], ['menor', 'Menor valor']];
const FAIXAS = [[0, 10e3, 'até R$ 10 mil'], [10e3, 25e3, 'R$ 10–25 mil'], [25e3, 50e3, 'R$ 25–50 mil'], [50e3, 100e3, 'R$ 50–100 mil'],
  [100e3, 250e3, 'R$ 100–250 mil'], [250e3, 1e6, 'R$ 250 mil–1 mi'], [1e6, Infinity, 'acima de R$ 1 mi']];
const FASES = { levantamento: 'Levantamento', estudo_preliminar: 'Estudo preliminar', anteprojeto: 'Anteprojeto', projeto_legal: 'Legal', projeto_basico: 'Básico', projeto_executivo: 'Executivo', detalhamento: 'Detalhamento', as_built: 'As built', assistencia_obra: 'Assistência à obra' };
const ESFERA = { M: 'Municipal', E: 'Estadual', F: 'Federal', D: 'Distrital' };

const SVG = {
  fora: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 3H13v3.5M13 3 7.5 8.5M11 9.5V13H3V5h3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  esq: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dir: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const reais = (n, curto = false) => {
  if (n == null || !Number.isFinite(n)) return '—';
  if (curto && n >= 1e6) return `R$ ${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (curto && n >= 1e4) return `R$ ${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: n >= 1000 ? 0 : 2 });
};
const m2 = (n) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m²`;
const data = (iso) => (iso ? new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—');
const hora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
// Acentos estragados na origem ("ContrataÃ§Ã£o") voltam a ser UTF-8; texto todo em maiúsculas fica em frase.
function reparar(s) {
  if (!s || !/Ã[\u0080-\u00bf]/.test(s)) return s || '';
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from([...s].map((ch) => ch.charCodeAt(0) & 0xff))); } catch { return s; }
}
const capitalizar = (t) => { const s = reparar(t); return s && s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s; };

function quantil(ordenados, q) {
  if (!ordenados.length) return null;
  const pos = (ordenados.length - 1) * q;
  const a = Math.floor(pos), b = Math.ceil(pos);
  return ordenados[a] + (ordenados[b] - ordenados[a]) * (pos - a);
}
const porM2 = (c) => (c.valor && c.leitura?.area_m2 ? c.valor / c.leitura.area_m2 : null);

export function criarPrecos({ esc, api }) {
  let raiz = null;
  let dados = lerCopia(COPIA);
  let erro = '';
  const f = { busca: '', escopo: '', regiao: '', ordem: 'recentes', pagina: 0 };

  // ---- filtros ------------------------------------------------------------------

  function filtrados() {
    const q = semAcento(f.busca);
    return (dados?.contratos || []).filter((c) => {
      if (f.escopo && !(c.escopo || []).includes(f.escopo)) return false;
      if (f.regiao === 'NE' && !NORDESTE.includes(c.uf)) return false;
      if (f.regiao && f.regiao !== 'NE' && c.uf !== f.regiao) return false;
      if (q && !semAcento([c.objeto, c.orgao, c.municipio, c.uf, c.contratada].join(' ')).includes(q)) return false;
      return true;
    });
  }

  // filtros no Segmentado da v2 (Escopo, Ordem)
  const seletor = (nome, opcoes, atual, rotulo) => segmentado(opcoes.map(([id, r]) => ({ id, rotulo: r })), atual, nome, rotulo);

  function filtros() {
    const ufs = [...new Set((dados?.contratos || []).map((c) => c.uf).filter(Boolean))].sort();
    return `<div class="pre-filtros">
        <input class="pre-busca" type="search" placeholder="Buscar no objeto, órgão, cidade ou contratada" value="${esc(f.busca)}" aria-label="Buscar">
        ${seletor('escopo', ESCOPOS, f.escopo, 'Escopo')}
        <select class="pre-regiao" aria-label="Região">
          <option value="">Todo o Brasil</option>
          <option value="NE"${f.regiao === 'NE' ? ' selected' : ''}>Nordeste</option>
          ${ufs.map((u) => `<option value="${u}"${f.regiao === u ? ' selected' : ''}>${u}</option>`).join('')}
        </select>
        ${f.busca || f.escopo || f.regiao ? '<button type="button" class="pre-limpar" data-acao="limpar">Limpar filtros</button>' : ''}
      </div>`;
  }

  // ---- placar e gráfico ---------------------------------------------------------

  function placar(lista) {
    const valores = lista.map((c) => c.valor).filter((v) => v > 0).sort((a, b) => a - b);
    const comArea = lista.filter((c) => porM2(c));
    const m2s = comArea.map(porM2).sort((a, b) => a - b);
    const datas = lista.map((c) => c.assinatura).filter(Boolean).sort();
    return numeros([
      { rotulo: 'Contratos de projeto', valor: lista.length.toLocaleString('pt-BR'), apoio: esc(`assinados de ${data(datas[0])} a ${data(datas.at(-1))}`) },
      { rotulo: 'Valor do meio (mediana)', valor: reais(quantil(valores, 0.5), true), apoio: 'metade paga menos, metade mais' },
      { rotulo: 'Metade dos contratos entre', valor: valores.length ? `${reais(quantil(valores, 0.25), true)} e ${reais(quantil(valores, 0.75), true)}` : null, apoio: 'do 1º ao 3º quartil' },
      { rotulo: 'Preço por m² (mediana)', valor: m2s.length ? `${reais(quantil(m2s, 0.5))}/m²` : null, apoio: esc(`${comArea.length} de ${lista.length} com área lida do termo de referência`) },
    ], { estatico: true });
  }

  function grafico(lista) {
    const cont = FAIXAS.map(([a, b]) => lista.filter((c) => c.valor >= a && c.valor < b).length);
    const max = Math.max(1, ...cont);
    return `<div class="pre-grafico" role="img" aria-label="Contratos por faixa de valor">
        <h3 class="pre-sub">Contratos por faixa de valor</h3>
        ${FAIXAS.map(([, , rot], i) => `<div class="pre-barra">
          <span class="pre-barra__rot">${esc(rot)}</span>
          <span class="pre-barra__trilho"><i style="width:${(cont[i] / max) * 100}%"></i></span>
          <span class="pre-barra__n">${cont[i]}</span>
        </div>`).join('')}
      </div>`;
  }

  function porEstado(lista) {
    const grupos = {};
    for (const c of lista) if (c.uf && c.valor > 0) (grupos[c.uf] ||= []).push(c.valor);
    const linhas = Object.entries(grupos).map(([uf, v]) => [uf, v.sort((a, b) => a - b)]).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    if (!linhas.length) return '';
    return `<div class="pre-estados">
        <h3 class="pre-sub">Por estado</h3>
        <div class="pre-tabela"><table class="u-tabela">
          <thead><tr><th>Estado</th><th class="num">Contratos</th><th class="num">Mediana</th><th class="num">Menor</th><th class="num">Maior</th></tr></thead>
          <tbody>${linhas.map(([uf, v]) => `<tr><td><b>${uf}</b></td><td class="num">${v.length}</td><td class="num">${esc(reais(quantil(v, 0.5), true))}</td><td class="num">${esc(reais(v[0], true))}</td><td class="num">${esc(reais(v[v.length - 1], true))}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>`;
  }

  // ---- registro dos contratos ---------------------------------------------------

  function linhaContrato(c) {
    const l = c.leitura;
    // Sem área: leva ao cartão do contrato no Radar, onde o botão "Ler o termo de referência" lê o TR na hora.
    const noRadar = `/radar/licitacoes?fase=contratadas&id=${encodeURIComponent(c.id)}`;
    const estado = l ? (l.legivel === false ? 'TR não lido' : 'sem área no TR') : c.tr ? 'TR a ler' : 'sem TR';
    const area = l?.area_m2 ? `<b>${esc(m2(l.area_m2))}</b><small>${esc(reais(porM2(c)))}/m²</small>`
      : `<span class="pre-etq ${l?.legivel === false ? 'problema' : 'opcional'}" title="${esc(l?.erro || '')}">${estado}</span>
         <a class="pre-ler" href="${esc(noRadar)}" target="_blank" rel="noopener">${l?.legivel ? 'Ler de novo no Radar' : 'Ler o TR no Radar'}</a>`;
    const fases = l?.fases?.length ? `<span class="pre-linha__fases">${esc(l.fases.map((x) => FASES[x] || x).join(' · '))}</span>` : '';
    const links = [
      c.contrato ? `<a class="pre-etq link" href="${esc(c.contrato)}" target="_blank" rel="noopener">Contrato</a>` : '',
      c.tr ? `<a class="pre-etq link" href="${esc(c.tr)}" target="_blank" rel="noopener" title="${esc(c.tr_tipo || '')}">${/termo/i.test(c.tr_tipo || '') ? 'TR' : esc((c.tr_tipo || 'TR').split(' ')[0])}</a>` : '',
    ].join('');
    return `<article class="pre-linha${c.link ? ' clicavel' : ''}"${c.link ? ` data-link="${esc(c.link)}" tabindex="0"` : ''}>
        <div class="pre-linha__obj"><b title="${esc(c.objeto)}">${esc(capitalizar(c.objeto))}</b>
          <small>${esc([capitalizar(c.orgao), ESFERA[c.esfera]].filter(Boolean).join(' · '))}</small>
          <span class="pre-linha__etqs">${(c.escopo || []).map((e) => `<span class="pre-etq">${esc(ESCOPOS.find(([v]) => v === e)?.[1] || e)}</span>`).join('')}${links}</span></div>
        <div class="pre-linha__quem"><span>${esc(capitalizar(c.contratada) || '—')}</span>${c.pessoa === 'fisica' ? '<small>pessoa física</small>' : ''}</div>
        <div class="pre-linha__onde">${esc([c.municipio, c.uf].filter(Boolean).join('/'))}</div>
        <div class="pre-linha__area">${area}${fases}</div>
        <div class="pre-linha__valor"><b>${esc(reais(c.valor))}</b></div>
        <div class="pre-linha__data">${esc(data(c.assinatura))}</div>
      </article>`;
  }

  function registro(lista) {
    const ord = [...lista].sort((a, b) => (f.ordem === 'maior' ? b.valor - a.valor : f.ordem === 'menor' ? a.valor - b.valor : String(b.assinatura || '').localeCompare(String(a.assinatura || ''))));
    const paginas = Math.max(1, Math.ceil(ord.length / POR_PAGINA));
    f.pagina = Math.min(f.pagina, paginas - 1);
    const ini = f.pagina * POR_PAGINA;
    const vis = ord.slice(ini, ini + POR_PAGINA);
    return `<section class="pre-sec">
        <div class="pre-sec__cab">
          <h2 class="pre-sec__titulo">Contratos <span>${lista.length}</span></h2>
          <div class="pre-sec__lado">
            ${seletor('ordem', ORDENS, f.ordem, 'Ordem')}
            <span class="pre-pag">${ord.length ? `${ini + 1}–${ini + vis.length} de ${ord.length}` : '0'}</span>
            <button type="button" class="pre-caixa" data-acao="antes" aria-label="Anteriores"${f.pagina === 0 ? ' disabled' : ''}>${SVG.esq}</button>
            <button type="button" class="pre-caixa" data-acao="depois" aria-label="Seguintes"${f.pagina >= paginas - 1 ? ' disabled' : ''}>${SVG.dir}</button>
          </div>
        </div>
        <div class="pre-regua"><span>Projeto contratado</span><span>Contratada</span><span>Local</span><span>Área</span><span class="num">Valor</span><span class="num">Assinado</span></div>
        ${vis.length ? `<div class="pre-linhas">${vis.map(linhaContrato).join('')}</div>` : '<p class="pre-vazio">Nenhum contrato com esses filtros.</p>'}
      </section>`;
  }

  // ---- concursos ------------------------------------------------------------------

  function concursos() {
    const lista = dados?.concursos || [];
    const linha = (c) => {
      const texto = c.contratacao || c.linhas[0] || '';
      const valor = (texto.match(/R\$\s?[\d.]+(,\d{2})?/) || [])[0];
      return `<article class="pre-linha pre-linha--conc${c.link ? ' clicavel' : ''}"${c.link ? ` data-link="${esc(c.link)}" tabindex="0"` : ''}>
          <div class="pre-linha__obj"><b>${esc(c.nome)}</b><small>${esc([c.promotor, c.local].filter(Boolean).join(' · '))}</small></div>
          <div class="pre-linha__texto">${esc(texto.replace(/^\+\s*/, ''))}</div>
          <div class="pre-linha__valor">${valor ? `<b>${esc(valor)}</b>` : '<span class="pre-etq opcional">sem valor</span>'}</div>
        </article>`;
    };
    return `<section class="pre-sec">
        <div class="pre-sec__cab"><h2 class="pre-sec__titulo">Concursos <span>${lista.length}</span></h2></div>
        ${lista.length ? `<div class="pre-regua pre-regua--conc"><span>Concurso</span><span>Contratação do vencedor</span><span class="num">Contrato</span></div>
          <div class="pre-linhas">${lista.map(linha).join('')}</div>` : '<p class="pre-vazio">Nenhum concurso em acompanhamento diz ainda como o vencedor será contratado.</p>'}
      </section>`;
  }

  function notas() {
    return `<section class="pre-notas">
        <div><span class="u-rotulo">De onde vem</span><p>Contratos só de projeto assinados por órgãos públicos de todo o Brasil e publicados no PNCP, que o Radar coleta todo dia útil (a carga inicial cobriu 30 dias). Os concursos são os acompanhados no Radar cujo site oficial diz como o vencedor será contratado. O prêmio não entra: o preço do projeto é o contrato.</p></div>
        <div><span class="u-rotulo">O que entra</span><p>Só contratos cujo objeto é elaborar projeto de arquitetura, interiores, urbanismo, paisagismo, restauro ou plano diretor. Ficam fora obra, projeto e obra juntos, compra, só disciplinas complementares e valores simbólicos de credenciamento. Um contrato pode reunir vários projetos (credenciamento, por demanda): por isso os extremos.</p></div>
        <div><span class="u-rotulo">Área e preço por m²</span><p>A área vem da leitura do termo de referência, um palpite a conferir no documento (link TR). A coleta lê o TR dos contratos novos; para um contrato sem área, “Ler o TR no Radar” abre o cartão dele no Radar, onde o botão lê o documento na hora.</p></div>
        <div><span class="u-rotulo">Próximos passos</span><p>Converter os valores em CUBs por m² (com a tabela do CUB atualizada) para comparar com a Fórmula das propostas, separar por fase contratada e mostrar onde cai cada proposta do Odisse.</p></div>
      </section>`;
  }

  // ---- página --------------------------------------------------------------------

  function desenhar() {
    if (!raiz) return;
    const cab = `<div class="cab"><div><h1 class="u-titulo">Mapa de preços</h1></div>
        <div class="lado u-apoio">${dados?.em ? `Atualizado em ${esc(hora(dados.em))}` : ''}</div></div>`;
    if (!dados) {
      raiz.innerHTML = cab + (erro ? `<p class="pre-aviso erro">${esc(erro)}</p>` : '<p class="u-apoio">Carregando…</p>');
      return;
    }
    const lista = filtrados();
    raiz.innerHTML = cab + (erro ? `<p class="pre-aviso erro">${esc(erro)} Mostrando a última cópia.</p>` : '')
      + filtros() + placar(lista)
      + `<div class="pre-duas">${grafico(lista)}${porEstado(lista)}</div>`
      + registro(lista) + concursos() + notas();
  }

  // Só a parte filtrada se redesenha ao digitar (a busca não perde o foco).
  function redesenharMantendoBusca() {
    const busca = raiz.querySelector('.pre-busca');
    const pos = busca ? busca.selectionStart : null;
    const tinhaFoco = document.activeElement === busca;
    desenhar();
    if (tinhaFoco) { const b = raiz.querySelector('.pre-busca'); b.focus(); if (pos != null) b.setSelectionRange(pos, pos); }
  }

  async function buscar() {
    try {
      const r = await api('/api/precos');
      if (r.status !== 200) throw new Error(r.error || `o servidor respondeu ${r.status}`);
      const { status, ...novo } = r;
      erro = '';
      if (!igual(novo, dados)) { dados = novo; gravarCopia(COPIA, novo); }
    } catch (e) {
      erro = `Não foi possível ler o Radar agora (${e.message}).`;
    }
    desenhar();
  }

  function ligar(el) {
    raiz = el;
    desenhar();
    buscar();
    raiz.addEventListener('input', (ev) => {
      if (ev.target.matches('.pre-busca')) { f.busca = ev.target.value; f.pagina = 0; redesenharMantendoBusca(); }
    });
    raiz.addEventListener('change', (ev) => {
      if (ev.target.matches('.pre-regiao')) { f.regiao = ev.target.value; f.pagina = 0; desenhar(); }
    });
    raiz.addEventListener('click', (ev) => {
      const opc = ev.target.closest('[data-segmentado]');
      if (opc) { f[opc.dataset.segmentado] = opc.dataset.valor; f.pagina = 0; desenhar(); return; }
      const acao = ev.target.closest('[data-acao]')?.dataset.acao;
      if (acao === 'limpar') { Object.assign(f, { busca: '', escopo: '', regiao: '', pagina: 0 }); desenhar(); return; }
      if (acao === 'antes') { f.pagina = Math.max(0, f.pagina - 1); desenhar(); raiz.querySelector('.pre-sec')?.scrollIntoView({ block: 'start' }); return; }
      if (acao === 'depois') { f.pagina += 1; desenhar(); raiz.querySelector('.pre-sec')?.scrollIntoView({ block: 'start' }); return; }
      if (ev.target.closest('a, button, input, select')) return;
      if (String(getSelection?.() || '')) return;
      const linha = ev.target.closest('.pre-linha.clicavel');
      if (linha) window.open(linha.dataset.link, '_blank', 'noopener');
    });
    raiz.addEventListener('keydown', (ev) => {
      const linha = ev.target.closest?.('.pre-linha.clicavel');
      if (linha && ev.key === 'Enter' && ev.target === linha) window.open(linha.dataset.link, '_blank', 'noopener');
    });
  }

  return { ligar };
}
