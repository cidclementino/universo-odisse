// Início (#/) — o panorama do dia (Cid, 19/11).
//
// Uma leitura só (GET /api/inicio, worker/inicio.js). Desde 19/11 (Cid) só ações; as métricas de ontem
// (Instagram e site) foram para a seção KPIs (assets/kpis.js). Nesta ordem:
//   1. Balanço do mês: nos 10 dias seguintes ao fechamento (dia 1º), aviso de que o balanço foi feito, com
//      Ver e Baixar o PDF. Sem balanço recente, não aparece.
//   2. Radar: uma faixa por tipo, só quando entrou algo hoje ("3 novos terrenos no Radar"); sem nada novo,
//      a seção não aparece. Cada faixa abre o Radar só com os novos do dia (nova aba).
//   3. Publicações de hoje: o que ainda falta publicar no calendário editorial e o planejado para o dia
//      (pauta ou lacuna), com "Confirmar publicação" no que está pronto. Atrasadas não entram uma a uma:
//      um cartão com a contagem leva ao Calendário editorial.
// Abre na hora com a última cópia (memoria.js) e confere no servidor a cada abertura e a cada 2 h.

import { lerCopia, gravarCopia, igual } from './memoria.js';
import { abrirBalanco } from './kpis.js';

const COPIA = 'inicio';
const INTERVALO = 2 * 3600 * 1000;
const RADAR = 'https://radar.odisse.com.br';
const CALENDARIO = 'https://marketing.odisse.com.br/#/calendario';

const NUCLEO = { estudio: 'Estúdio', arquitetos: 'Arquitetos', objetos: 'Objetos', elaia: 'Elaia' };
const REDE = { instagram: 'Instagram', pinterest: 'Pinterest' };
const SITUACAO_PAUTA = { pauta: 'só pauta', producao: 'em produção', pronta: 'pronta', publicada: 'publicada' };

const SVG = {
  fora: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 3H13v3.5M13 3 7.5 8.5M11 9.5V13H3V5h3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ok: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');

export function criarInicio({ esc, api, toque }) {
  let raiz = null;
  let dados = lerCopia(COPIA);
  let timer = null;
  let buscando = null;

  // ---- 1. Balanço do mês ----------------------------------------------------------

  const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function balanco(d) {
    const b = d.balanco;
    if (!b?.mes) return '';
    const nome = NOME_MES[+b.mes.slice(5, 7) - 1];
    const quando = new Date(b.feito_em).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    return `<section class="ini-sec">
        <div class="ini-alerta ini-balanco">
          <span class="ini-etq ok">${SVG.ok}</span>
          <span class="ini-linha__txt"><b>Balanço de ${esc(nome)} feito</b><small>Fechado em ${esc(quando)}, com os números do mês, o retrospecto e a expectativa para o próximo</small></span>
          <span class="ini-balanco__acoes">
            <a class="u-botao" href="#/kpis?mes=${esc(b.mes)}">Abrir KPIs</a>
            <button type="button" class="u-botao" data-balanco="ver" data-mes="${esc(b.mes)}">Ver PDF</button>
            <button type="button" class="u-botao forte" data-balanco="baixar" data-mes="${esc(b.mes)}">Baixar PDF</button>
          </span>
        </div>
      </section>`;
  }

  // ---- 2. Radar ----------------------------------------------------------------

  function radar(d) {
    const r = d.radar || {};
    if (r.erro) return '';
    const q = `novos=${encodeURIComponent(d.hoje)}`;
    const tipos = [
      [r.concursos, 'novo concurso', 'novos concursos', `${RADAR}/?${q}`],
      [r.terrenos, 'novo terreno', 'novos terrenos', `${RADAR}/terrenos?${q}`],
      [r.licitacoes, 'nova licitação', 'novas licitações', `${RADAR}/licitacoes?${q}&fase=abertas`],
      [r.contratos, 'novo contrato de obra', 'novos contratos de obra', `${RADAR}/licitacoes?${q}&fase=contratadas`],
    ].filter(([n]) => n > 0);
    if (!tipos.length) return '';
    const total = tipos.reduce((s, [n]) => s + n, 0);
    return `<section class="ini-sec">
        <h2 class="ini-sec__titulo">Hoje no Radar</h2>
        <div class="ini-grupo" style="--g:var(--odisse-ocre, #BB8248)">
          <div class="ini-grupo__faixa is-fixa">Radar de oportunidades<span>${total} ${total === 1 ? 'novidade' : 'novidades'} hoje</span></div>
          <div class="ini-pilha">${tipos.map(([n, um, varios, url]) => `
            <a class="ini-linha" href="${esc(url)}" target="_blank" rel="noopener">
              <span class="ini-etq destaque">${n}</span>
              <span class="ini-linha__frase"><b>${n} ${esc(n === 1 ? um : varios)}</b> no Radar</span>
              <i class="ini-fora">${SVG.fora}</i>
            </a>`).join('')}
          </div>
        </div>
      </section>`;
  }

  // ---- 3. Publicações de hoje ------------------------------------------------------

  function miniatura(l) {
    const f = l.formato === 'pin' ? 'pin' : 'p34';
    if (l.miniatura) return `<span class="ini-mini ${f}"><img src="${esc(l.miniatura)}" alt="" loading="lazy"></span>`;
    return `<span class="ini-mini ${f} vazia" aria-hidden="true"></span>`;
  }

  function linhaPublicacao(l) {
    const rede = REDE[l.rede] || l.rede || '';
    const etqs = [
      l.nucleo && NUCLEO[l.nucleo] ? `<span class="ini-etq">${esc(NUCLEO[l.nucleo])}</span>` : '',
      l.horario ? `<span class="ini-etq">${esc(l.horario)}</span>` : '',
      l.tipo === 'pauta' ? `<span class="ini-etq atencao">${esc(SITUACAO_PAUTA[l.situacao] || l.situacao || 'pauta')}</span>` : '',
      l.tipo === 'lacuna' ? '<span class="ini-etq opcional">lacuna</span>' : '',
      l.tipo === 'item' ? '<span class="ini-etq ok">pronta</span>' : '',
    ].join('');
    const nome = l.tipo === 'lacuna' ? 'Nada planejado ainda' : (l.titulo || 'Sem título');
    const sub = [rede, l.encaixe, l.tipo === 'item' && l.nimagens > 1 ? `${l.nimagens} imagens` : '', l.pasta].filter(Boolean).join(' · ');
    const acao = l.confirma
      ? `<button type="button" class="u-botao ini-confirmar" data-confirmar="${esc(l.tipo)}:${esc(l.id)}">${SVG.ok}Confirmar publicação</button>`
      : '';
    return `<div class="ini-linha ini-pub${l.tipo === 'lacuna' ? ' is-lacuna' : ''}" data-url="${CALENDARIO}" role="link" tabindex="0" aria-label="${esc(nome)}: abrir o calendário editorial">
        ${miniatura(l)}
        <span class="ini-linha__txt"><b>${esc(nome)}</b><small>${esc(sub)}</small></span>
        <span class="ini-etqs">${etqs}</span>
        <span class="ini-acao">${acao}</span>
      </div>`;
  }

  function publicacoes(d) {
    const p = d.publicacoes || {};
    if (p.erro) {
      return `<section class="ini-sec"><h2 class="ini-sec__titulo">Publicações de hoje</h2>
        <p class="ini-vazio">Não foi possível ler o calendário editorial agora.</p></section>`;
    }
    const linhas = p.linhas || [];
    const falta = linhas.length;
    const conta = [falta ? `${falta} a publicar` : '', p.publicadas ? `${p.publicadas} ${p.publicadas === 1 ? 'publicada' : 'publicadas'}` : ''].filter(Boolean).join(' · ') || 'nada previsto';
    const corpo = falta
      ? `<div class="ini-pilha">${linhas.map(linhaPublicacao).join('')}</div>`
      : `<p class="ini-vazio no-grupo">${p.publicadas ? 'Tudo o que estava previsto para hoje já foi publicado.' : 'Nada previsto para hoje no calendário editorial.'}</p>`;
    const atrasadas = p.atrasadas
      ? `<a class="ini-alerta" href="${CALENDARIO}" target="_blank" rel="noopener">
          <span class="ini-etq atencao">${p.atrasadas}</span>
          <span class="ini-linha__txt"><b>${p.atrasadas} ${p.atrasadas === 1 ? 'publicação atrasada' : 'publicações atrasadas'}</b><small>Agendadas para dias que já passaram e ainda não confirmadas</small></span>
          <span class="ini-alerta__ir">Ver calendário editorial<i class="ini-fora">${SVG.fora}</i></span>
        </a>`
      : '';
    return `<section class="ini-sec">
        <h2 class="ini-sec__titulo">Publicações de hoje</h2>
        ${atrasadas}
        <div class="ini-grupo" style="--g:var(--odisse-ambar, #ECC28F)">
          <a class="ini-grupo__faixa" href="${CALENDARIO}" target="_blank" rel="noopener">Calendário editorial<span>${esc(conta)}</span><i class="ini-fora">${SVG.fora}</i></a>
          ${corpo}
        </div>
      </section>`;
  }

  // ---- página ------------------------------------------------------------------

  function desenhar() {
    if (!raiz) return;
    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const lado = dados?.em ? `${hoje} · atualizado às ${hora(dados.em)}` : hoje;
    const cab = `<div class="cab"><h1 class="u-titulo">Início</h1><div class="lado u-apoio">${esc(lado)}</div></div>`;
    if (!dados) { raiz.innerHTML = cab + '<p class="u-apoio ini-carregando">Carregando o panorama do dia…</p>'; return; }
    raiz.innerHTML = cab + balanco(dados) + radar(dados) + publicacoes(dados);
  }

  async function buscar() {
    if (buscando) return buscando;
    buscando = (async () => {
      const r = await api('/api/inicio').catch((e) => ({ status: 0, error: e.message }));
      if (r.status !== 200) {
        if (!dados && raiz) raiz.querySelector('.ini-carregando')?.replaceWith(Object.assign(document.createElement('p'),
          { className: 'ini-vazio', textContent: 'Não foi possível falar com o servidor do Universo. Tente de novo em instantes.' }));
        return;
      }
      const { status, ...novo } = r;
      const mudou = !igual(stripEm(novo), stripEm(dados));
      dados = novo;
      gravarCopia(COPIA, dados);
      if (mudou) desenhar();
      else raiz?.querySelector('.cab .lado')?.replaceChildren(document.createTextNode(
        `${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} · atualizado às ${hora(dados.em)}`));
    })().finally(() => { buscando = null; });
    return buscando;
  }
  const stripEm = (d) => (d ? { ...d, em: null } : d);

  async function confirmar(botao) {
    const [tipo, id] = botao.dataset.confirmar.split(':');
    botao.disabled = true;
    const r = await api('/api/inicio/publicar', { method: 'POST', body: JSON.stringify({ tipo, id }) }).catch(() => ({ status: 0 }));
    if (r.status !== 200) {
      botao.disabled = false;
      toque(r.error ? `Não confirmou: ${r.error}` : 'Não foi possível confirmar agora');
      return;
    }
    // tira a linha na hora; a leitura nova confirma por baixo
    const p = dados?.publicacoes;
    if (p?.linhas) {
      p.linhas = p.linhas.filter((l) => !(l.tipo === tipo && l.id === id));
      p.publicadas = (p.publicadas || 0) + 1;
      gravarCopia(COPIA, dados);
      desenhar();
    }
    toque('Publicação confirmada no calendário');
    buscar();
  }

  function aoClicar(ev) {
    const bal = ev.target.closest('[data-balanco]');
    if (bal) {
      bal.disabled = true;
      abrirBalanco(api, bal.dataset.mes, { baixar: bal.dataset.balanco === 'baixar' })
        .catch((e) => toque('Não foi possível montar o PDF: ' + e.message)).finally(() => { bal.disabled = false; });
      return;
    }
    const b = ev.target.closest('[data-confirmar]');
    if (b) { ev.preventDefault(); confirmar(b); return; }
    // linha de publicação: clicável inteira (menos o botão), abre o calendário em nova aba
    const linha = ev.target.closest('.ini-pub[data-url]');
    if (linha && !getSelection().toString()) window.open(linha.dataset.url, '_blank', 'noopener');
  }

  function aoTeclar(ev) {
    if (ev.key !== 'Enter' || ev.target.closest('[data-confirmar]')) return;
    const linha = ev.target.closest('.ini-pub[data-url]');
    if (linha) window.open(linha.dataset.url, '_blank', 'noopener');
  }

  function aoVoltar() {
    if (document.visibilityState !== 'visible' || !raiz?.isConnected) return;
    const em = dados?.em ? Date.parse(dados.em) : 0;
    if (Date.now() - em >= INTERVALO) buscar();
  }

  function ligar(el) {
    raiz = el;
    clearInterval(timer);
    raiz.addEventListener('click', aoClicar);
    raiz.addEventListener('keydown', aoTeclar);
    desenhar();
    buscar();
    timer = setInterval(() => { if (raiz?.isConnected) buscar(); else clearInterval(timer); }, INTERVALO);
    if (!ligar.feito) { document.addEventListener('visibilitychange', aoVoltar); ligar.feito = true; }
  }

  return { ligar };
}
