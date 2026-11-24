// Biblioteca › Estrutura de pastas (#/pastas; Cid, 19/11): a norma de cada estrutura de pastas do Drive e o
// retrato do Drive tirado num dia, lidos juntos para manter as pastas organizadas.
//
// Uma leitura só: GET /api/pastas (R2 privado; ver worker/pastas.js). Os repositórios são públicos e há nomes
// de clientes nas pastas, por isso nada disto fica no git. Retrato fixo do dia em que foi tirado, até a conta
// Google ser ligada (aí o servidor lê o Drive sozinho).
// Desenho: Trilha → título → Seletor (estrutura) + Seletor (Tudo / Só o que difere) → Placar → Régua + Sanfona
// (árvore de pastas; cada pasta com subpastas abre e fecha no lugar, estado lembrado) → notas no fim.
//
// Conferência, pasta a pasta:
//   falta         a norma prevê e o Drive não tem (linha tracejada)
//   sem norma     o Drive tem e a norma não prevê; só onde a norma lista as subpastas daquele nível
//                 (onde a norma não lista nada, as subpastas são livres)
//   nome difere   mesma pasta, escrita diferente (acento, maiúscula)
//   acento/espaço o nome fere a regra da estrutura (só onde a norma pede nomes sem acento e sem espaço)
//   N além do previsto  arquivos soltos acima do que a norma admite na pasta

import { lerCopia, gravarCopia, igual } from './memoria.js';
import { numeros } from '../base/v2/componentes.js';

const COPIA = 'pastas';
const LEMBRAR = 'universo:pastas:';

const SVG = {
  seta: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pasta: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.75 4.25c0-.55.45-1 1-1h3.4l1.5 1.5h5.6c.55 0 1 .45 1 1v6.5c0 .55-.45 1-1 1H2.75c-.55 0-1-.45-1-1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
};

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const foraDaRegra = (n) => /[^\x20-\x7e]|\s/.test(n);
const data = (iso) => (iso ? new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—');
const mil = (n) => n.toLocaleString('pt-BR');
const lembrar = {
  ler(k, padrao) { try { const v = localStorage.getItem(LEMBRAR + k); return v == null ? padrao : JSON.parse(v); } catch { return padrao; } },
  gravar(k, v) { try { localStorage.setItem(LEMBRAR + k, JSON.stringify(v)); } catch {} },
};

// Junta norma e retrato numa árvore só, com a conferência de cada pasta.
function juntar(norma, retrato, regraNomes, caminho = '') {
  const filhosNorma = norma?.f || [];
  const listaNorma = filhosNorma.length > 0; // a norma diz quais subpastas este nível tem
  const usados = new Set();
  const nos = (retrato?.f || []).map((r) => {
    let n = filhosNorma.find((x) => x.n === r.n);
    let nomeDifere = null;
    if (!n) {
      n = filhosNorma.find((x) => !usados.has(x) && semAcento(x.n) === semAcento(r.n));
      if (n) nomeDifere = n.n;
    }
    if (n) usados.add(n);
    const id = caminho + '/' + r.n;
    const no = juntar(n || null, r, regraNomes, id);
    return {
      ...no, id, nome: r.n, arquivos: r.a, nota: n?.nota || '',
      semNorma: listaNorma && !n, nomeDifere,
      regra: regraNomes && foraDaRegra(r.n),
      alem: n?.previstos != null && r.a > n.previstos ? r.a - n.previstos : 0,
    };
  });
  for (const n of filhosNorma) {
    if (usados.has(n)) continue;
    const id = caminho + '/' + n.n;
    nos.push({ ...juntar(n, null, false, id), id, nome: n.n, arquivos: null, nota: n.nota || '', falta: true });
  }
  return { filhos: nos };
}

const temAviso = (no) => no.falta || no.semNorma || no.nomeDifere || no.regra || no.alem > 0;
function contar(nos, c = { pastas: 0, arquivos: 0, falta: 0, fora: 0, semNorma: 0, nome: 0, alem: 0 }) {
  for (const no of nos) {
    if (no.falta) c.falta++; else { c.pastas++; c.arquivos += no.arquivos || 0; }
    if (no.semNorma || no.nomeDifere || no.regra) c.fora++;
    if (no.semNorma) c.semNorma++;
    if (no.nomeDifere || no.regra) c.nome++;
    if (no.alem > 0) c.alem += no.alem;
    contar(no.filhos, c);
  }
  return c;
}
const difere = (no) => temAviso(no) || no.filhos.some(difere);

export function criarPastas({ esc, api, toque }) {
  let raiz = null;
  let dados = lerCopia(COPIA);
  let estado = dados ? 'ok' : 'carregando'; // carregando · ok · vazio · erro
  let erro = '';
  let atual = lembrar.ler('estrutura', 'projeto');
  let filtro = lembrar.ler('filtro', 'tudo');

  const abertas = () => new Set(lembrar.ler('abertas:' + atual, null) ?? []);
  const guardarAbertas = (s) => lembrar.gravar('abertas:' + atual, [...s]);

  const seletor = (nome, opcoes, valor) => `<div class="pas-seletor" role="group" data-seletor="${nome}">${opcoes.map(([v, r]) =>
    `<button type="button" data-valor="${esc(v)}" aria-pressed="${v === valor}"${v === valor ? ' class="ativo"' : ''}>${esc(r)}</button>`).join('')}</div>`;

  const etq = (t, tipo = '') => `<span class="pas-etq${tipo ? ' ' + tipo : ''}">${esc(t)}</span>`;

  function linha(no, nivel, abertasSet, soDifere) {
    if (soDifere && !difere(no)) return '';
    const temFilhos = no.filhos.length > 0;
    const aberta = temFilhos && (soDifere || abertasSet.has(no.id));
    const etqs = [
      no.falta && etq('falta', 'problema'),
      no.semNorma && etq('sem norma', 'tracejada'),
      no.nomeDifere && etq('na norma: ' + no.nomeDifere, 'atencao'),
      no.regra && !no.nomeDifere && etq('acento ou espaço', 'atencao'),
      no.alem > 0 && etq(`${mil(no.alem)} além do previsto`, 'atencao'),
    ].filter(Boolean).join('');
    const cab = `<span class="pas-nome">
        <span class="pas-seta">${temFilhos ? SVG.seta : ''}</span><span class="pas-icone">${SVG.pasta}</span>
        <b>${esc(no.nome)}</b>${temFilhos ? `<small>${no.filhos.filter((f) => !f.falta).length}</small>` : ''}${etqs}</span>
      <span class="pas-nota">${esc(no.nota)}</span>
      <span class="pas-num">${no.arquivos == null ? '—' : mil(no.arquivos)}</span>`;
    const tag = temFilhos && !soDifere ? 'button type="button"' : 'div';
    const fecha = tag.startsWith('button') ? 'button' : 'div';
    const filhos = aberta ? no.filhos.map((f) => linha(f, nivel + 1, abertasSet, soDifere)).join('') : '';
    return `<li class="pas-item${aberta ? ' aberta' : ''}">
        <${tag} class="pas-linha${no.falta ? ' falta' : ''}${temFilhos && !soDifere ? ' clicavel' : ''}" data-id="${esc(no.id)}" style="--nivel:${nivel}"${temFilhos && !soDifere ? ` aria-expanded="${aberta}"` : ''}>${cab}</${fecha}>
        ${filhos ? `<ul class="pas-arvore">${filhos}</ul>` : ''}
      </li>`;
  }

  function placar(e, c) {
    const conferencia = e.norma
      ? [{ rotulo: 'Fora da norma', valor: mil(c.fora), apoio: [c.semNorma && `${c.semNorma} sem norma`, c.nome && `${c.nome} de nome`].filter(Boolean).join(' · ') || 'tudo previsto' },
        { rotulo: 'Faltando', valor: mil(c.falta), apoio: c.alem ? `${mil(c.alem)} arquivos além do previsto` : 'nenhuma pasta' }]
      : [{ rotulo: 'Norma', valor: null, apoio: 'ainda não escrita' }];
    return numeros([{ rotulo: 'Pastas', valor: mil(c.pastas) }, { rotulo: 'Arquivos', valor: mil(c.arquivos + (e.retrato.a || 0)), apoio: 'contados no retrato' }, ...conferencia], { estatico: true });
  }


  function notas(e) {
    return `<section class="pas-notas">
      <div><h3 class="u-rotulo">Regras desta estrutura</h3>
        ${e.regras.length ? `<ul>${e.regras.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '<p>Ainda não há norma escrita para esta estrutura; a página mostra só o retrato do Drive.</p>'}</div>
      <div><h3 class="u-rotulo">Como ler</h3>
        <p><b>Falta</b>: a norma prevê e o Drive não tem. <b>Sem norma</b>: o Drive tem e a norma não prevê; só onde a norma lista as subpastas daquele nível. Onde ela não lista nada, as subpastas são livres. <b>Na norma: …</b>: a mesma pasta escrita de outro jeito. <b>Acento ou espaço</b>: nome fora da regra da estrutura. <b>Além do previsto</b>: arquivos soltos acima do que a norma admite na pasta.</p>
        <p>Arquivos = os soltos em cada pasta, sem contar os das subpastas.</p></div>
      <div><h3 class="u-rotulo">De onde vem</h3>
        <p>Norma: ${e.fonte ? esc(e.fonte) : '—'}.<br>Retrato do Drive de ${data(dados.retrato_em)}, fixo até a conta Google ser ligada.</p>
        <p><button type="button" class="pas-trocar" data-acao="enviar">Trocar o arquivo de estrutura</button></p></div>
    </section>`;
  }

  function desenhar() {
    if (!raiz) return;
    const entrada = '<input type="file" accept="application/json,.json" data-arquivo hidden>';
    const cab = `<div class="cab"><div>
      <h1 class="u-titulo">Estrutura de pastas</h1></div>
      ${dados ? `<div class="lado u-apoio">Retrato do Drive de ${data(dados.retrato_em)}</div>` : ''}</div>`;
    if (!dados) {
      raiz.innerHTML = cab + (estado === 'carregando' ? '<p class="u-apoio">Carregando…</p>'
        : `<div class="pas-vazio"><p>${estado === 'erro' ? esc(erro) : 'Ainda não há estrutura guardada no Universo.'}</p>
          ${estado === 'vazio' ? '<button type="button" class="u-botao forte" data-acao="enviar">Enviar arquivo de estrutura</button>' : ''}</div>`) + entrada;
      return;
    }
    const e = dados.estruturas.find((x) => x.id === atual) || dados.estruturas[0];
    atual = e.id;
    const arvore = juntar(e.norma, e.retrato, e.nomes_sem_acento);
    const c = contar(arvore.filhos);
    const soDifere = filtro === 'difere';
    const ab = abertas();
    const linhas = arvore.filhos.map((no) => linha(no, 0, ab, soDifere)).join('');
    const avisoRaiz = e.norma?.previstos != null && e.retrato.a > e.norma.previstos
      ? etq(`${mil(e.retrato.a - e.norma.previstos)} arquivos soltos além do previsto`, 'atencao') : '';
    raiz.innerHTML = cab + `
      <div class="pas-filtros">
        ${seletor('estrutura', dados.estruturas.map((x) => [x.id, x.nome]), e.id)}
        ${seletor('filtro', [['tudo', 'Tudo'], ['difere', 'Só o que difere']], filtro)}
        <span class="pas-acoes">
          <button type="button" class="pas-texto" data-acao="abrir"${soDifere ? ' disabled' : ''}>Abrir todas</button>
          <button type="button" class="pas-texto" data-acao="fechar"${soDifere ? ' disabled' : ''}>Fechar todas</button>
        </span>
      </div>
      ${placar(e, c)}
      <div class="pas-raiz"><span class="pas-icone">${SVG.pasta}</span><b>${esc(e.caminho)}</b>
        <span class="pas-pe">${mil(e.retrato.a)} arquivo${e.retrato.a === 1 ? '' : 's'} na raiz${e.norma?.previstos != null ? ` · previsto${e.norma.previstos === 1 ? '' : 's'}: ${e.norma.previstos}` : ''}</span>${avisoRaiz}</div>
      <div class="pas-regua"><span>Pasta</span><span>O que vai aqui</span><span class="num">Arquivos</span></div>
      ${linhas ? `<ul class="pas-arvore pas-topo">${linhas}</ul>` : '<div class="pas-vazio"><p>Nada difere da norma nesta estrutura.</p></div>'}
      ${notas(e)}${entrada}`;
  }

  function todasComFilhos(nos, s = new Set()) { for (const no of nos) if (no.filhos.length) { s.add(no.id); todasComFilhos(no.filhos, s); } return s; }

  async function enviar(arquivo) {
    const texto = await arquivo.text();
    const r = await api('/api/pastas', { method: 'PUT', body: texto });
    if (r.status !== 200) { toque(r.error || 'Não foi possível guardar o arquivo.'); return; }
    const { status, ...d } = r;
    dados = d; estado = 'ok'; gravarCopia(COPIA, dados);
    toque('Estrutura guardada.');
    desenhar();
  }

  async function buscar() {
    let r;
    try { r = await api('/api/pastas'); } catch (e) { r = { status: 0, error: e.message }; }
    if (r.status === 200) {
      const { status, ...d } = r;
      if (!igual(d, dados)) { dados = d; gravarCopia(COPIA, dados); estado = 'ok'; desenhar(); }
      return;
    }
    if (dados) return; // fica a cópia
    estado = r.status === 404 ? 'vazio' : 'erro';
    erro = `Não foi possível ler a estrutura (${r.status ? 'resposta ' + r.status : 'sem resposta'}${r.error ? ': ' + r.error : ''}).`;
    desenhar();
  }

  function ligar(el) {
    raiz = el;
    desenhar();
    buscar();
    raiz.addEventListener('click', (ev) => {
      const sel = ev.target.closest('[data-seletor] button');
      if (sel) {
        const qual = sel.parentElement.dataset.seletor;
        if (qual === 'estrutura') { atual = sel.dataset.valor; lembrar.gravar('estrutura', atual); }
        if (qual === 'filtro') { filtro = sel.dataset.valor; lembrar.gravar('filtro', filtro); }
        desenhar();
        raiz.querySelector(`[data-seletor="${qual}"] [data-valor="${CSS.escape(sel.dataset.valor)}"]`)?.focus();
        return;
      }
      const acao = ev.target.closest('[data-acao]')?.dataset.acao;
      if (acao === 'enviar') { raiz.querySelector('[data-arquivo]')?.click(); return; }
      if (acao === 'abrir' || acao === 'fechar') {
        const e = dados.estruturas.find((x) => x.id === atual);
        guardarAbertas(acao === 'abrir' ? todasComFilhos(juntar(e.norma, e.retrato, false).filhos) : new Set());
        desenhar();
        return;
      }
      const l = ev.target.closest('.pas-linha.clicavel');
      if (l) {
        const s = abertas();
        s.has(l.dataset.id) ? s.delete(l.dataset.id) : s.add(l.dataset.id);
        guardarAbertas(s);
        const y = l.getBoundingClientRect().top;
        desenhar();
        // a página não pula: a linha clicada fica onde estava
        const nova = raiz.querySelector(`.pas-linha[data-id="${CSS.escape(l.dataset.id)}"]`);
        if (nova) { window.scrollBy(0, nova.getBoundingClientRect().top - y); nova.focus({ preventScroll: true }); }
      }
    });
    raiz.addEventListener('change', (ev) => {
      if (ev.target.matches('[data-arquivo]') && ev.target.files[0]) enviar(ev.target.files[0]);
    });
  }

  return { ligar };
}
