// Página "Métricas": hub de desempenho do marketing do Odisse.
// Reúne as redes (fase 1: Instagram; TikTok e YouTube depois) em subpáginas organizadas por
// pergunta — o que aconteceu, o que funciona, quem é o público, quando publicar, o que traz
// seguidores, como estão os concorrentes. A rede é um filtro que vale para todas.
//
// Dados: worker/instagram.js e worker/concorrentes.js. Formato comum: metricas/modelo.js.

import * as nuvem from './nuvem.js';
import * as local from './store.js';
import { NUCLEOS, ORDEM_NUCLEOS } from './nucleos.js';
import { REDES, normalizar, recortar } from './metricas/modelo.js';
import { esc, n, ligarDicas } from './metricas/graficos.js';
import { gerarLeituras } from './metricas/leituras.js';
import * as P from './metricas/paginas.js';

const SUBS = [
  ['visao', 'Visão geral', P.visaoGeral],
  ['conteudo', 'Conteúdo', P.conteudo],
  ['publico', 'Público', P.publico],
  ['horarios', 'Horários', P.horarios],
  ['crescimento', 'Crescimento', P.crescimento],
  ['concorrentes', 'Concorrentes', P.concorrentes],
  ['instagram', 'Instagram', P.instagram],
  ['conexoes', 'Conexões', P.conexoes],
];
const PERIODOS = [['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias'], ['tudo', 'Tudo']];
const DIA = 86400000;

let raiz = null;
let dados = null;
let N = null;
const ui = {
  periodo: '30', rede: 'todas', nucleo: 'todos',
  agrupar: 'nucleo', ordem: { col: 'data', desc: true }, grupoPub: 'seguidores', serieCresc: 'seguidores', serieIG: 'views',
  resumos: [],
};
const minis = new Map();

const subAtual = () => {
  const k = (location.hash.match(/^#\/metricas\/([a-z]+)/) || [])[1];
  return SUBS.find((s) => s[0] === k) || SUBS[0];
};

// ---------------------------------------------------------------------------

// A última leitura fica guardada neste navegador: ao abrir, aparece na hora (com a data da coleta)
// e a leitura nova chega por baixo. Na mesma sessão, a nuvem é consultada de novo após 10 min.
const CHAVE_LEITURA = 'metricas-leitura';
const VALIDADE = 10 * 60 * 1000;
let lidoEm = 0;

export async function renderMetricas(el) {
  raiz = el;
  if (!raiz.dataset.ligado) ligar();
  ligarDicas(raiz);
  if (!dados) {
    const guardada = await local.ler(CHAVE_LEITURA, 'meta');
    if (guardada?.dados) {
      dados = guardada.dados;
      ui.resumos = guardada.resumos || [];
      N = normalizar(dados);
      desenhar();
      carregar({ fundo: true });
      return;
    }
    raiz.innerHTML = '<section><p class="met-carregando">Carregando métricas…</p></section>';
    await carregar();
    return;
  }
  desenhar();
  if (Date.now() - lidoEm > VALIDADE) carregar({ fundo: true });
}

async function carregar({ fundo = false } = {}) {
  try {
    [dados, ui.resumos] = await Promise.all([nuvem.igMetricas(), nuvem.listar().catch(() => ui.resumos || [])]);
    N = normalizar(dados);
    lidoEm = Date.now();
    local.gravar(CHAVE_LEITURA, { dados, resumos: ui.resumos, em: lidoEm }, 'meta');
  } catch (e) {
    // por baixo, um erro não apaga a leitura guardada que está na tela
    if (!fundo) raiz.innerHTML = `<section><p class="met-erro">Não foi possível carregar as métricas: ${esc(e.message)}</p></section>`;
    return;
  }
  if (fundo && !document.body.classList.contains('vista-metricas')) return;
  desenhar();
}

function desenhar() {
  const est = dados.estado || {};
  if (!est.conectado) { raiz.innerHTML = telaConexao(est); return; }
  const [sub, nome, fn] = subAtual();
  document.title = `${nome} · Métricas · Universo`;
  const c = recortar(N, ui);
  const L = gerarLeituras(N, c);
  const pag = fn(N, c, L, ui);
  const rolagem = raiz.scrollTop;
  raiz.innerHTML = `
    ${cabecalho(est)}
    <nav class="met-nav" aria-label="Seções das métricas">${SUBS.map(([k, r]) => `<a href="#/metricas/${k}" class="${k === sub ? 'ativo' : ''}">${r}</a>`).join('')}</nav>
    ${sub === 'conexoes' ? '' : filtros(sub)}
    ${est.erro ? `<section><p class="met-erro">${esc(est.erro)} <a href="#/metricas/conexoes">Conexões</a></p></section>` : ''}
    <div class="met-pagina">${pag.html}</div>`;
  raiz.scrollTop = rolagem;
  pag.depois(raiz);
  carregarMinis();
}

function cabecalho(est) {
  const quando = est.ultimaColeta
    ? new Date(est.ultimaColeta).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'nunca';
  const expira = est.expira ? Math.round((est.expira - Date.now()) / DIA) : null;
  return `
    <section class="met-cab">
      <div>
        <h1>Métricas</h1>
        <p><b>Instagram @${esc(est.usuario || '')}</b> · ${n(est.seguidores)} seguidores · atualizado em ${quando}${expira != null && expira < 20 ? ` · <span class="alerta">token expira em ${expira} dias</span>` : ''}</p>
      </div>
      <div class="met-acoes"><button class="bt-padroes" id="metAtualizar">Atualizar agora</button></div>
    </section>`;
}

function filtros(sub) {
  const semNucleo = ['publico', 'concorrentes', 'instagram'].includes(sub);
  return `<section class="met-filtros">
    <div class="seg met-seg" data-grupo="periodo">${PERIODOS.map(([k, r]) => `<button data-v="${k}" class="${k === ui.periodo ? 'ativo' : ''}">${r}</button>`).join('')}</div>
    <div class="met-redes" role="group" aria-label="Redes">
      <button data-rede="todas" class="${ui.rede === 'todas' ? 'ativo' : ''}">Todas as redes</button>
      ${REDES.map((r) => `<button data-rede="${r.id}" class="${ui.rede === r.id ? 'ativo' : ''}" ${r.ativa && N.contas[r.id] ? '' : 'disabled title="Ainda não conectado"'}>${esc(r.nome)}</button>`).join('')}
    </div>
    ${semNucleo ? '' : `<label class="met-nuc"><span>Núcleo</span><select id="metNucleo">
      <option value="todos">Todos</option>${ORDEM_NUCLEOS.map((id) => `<option value="${id}" ${ui.nucleo === id ? 'selected' : ''}>${esc(NUCLEOS[id].nome)}</option>`).join('')}
      <option value="sem" ${ui.nucleo === 'sem' ? 'selected' : ''}>Sem vínculo</option>
    </select></label>`}
  </section>`;
}

// ---------------------------------------------------------------------------
// Conexão

const RETORNO = 'https://universo-odisse.reservaprojectbasework.workers.dev/api/instagram/retorno';

function telaConexao(est) {
  const app = est.app || {};
  return `
    <section class="met-conectar">
      <h1>Métricas</h1>
      <p class="met-lead">Conecte a conta do Odisse no Instagram. Depois disso, o Universo busca os números todo dia, às 6h, e guarda o histórico (o Instagram só mantém 90 dias).</p>
      ${est.erro ? `<p class="met-erro">${esc(est.erro)}</p>` : ''}
      <ol class="met-passos">
        <li>No app do Meta (<b>developers.facebook.com</b>), caso de uso <i>Gerenciar mensagens e conteúdo no Instagram</i>, em <i>Permissões e recursos</i>, adicione <b>instagram_basic</b> e <b>instagram_manage_insights</b>.</li>
        <li>Em <i>API setup with Unified login → Criar nova configuração</i>: token de <b>usuário do sistema</b>, expiração <b>Nunca</b>, ativo <b>conta do Instagram</b>, permissões <b>instagram_basic</b> e <b>instagram_manage_insights</b>.</li>
        <li>Registre este URL de redirecionamento e salve:<code class="met-url">${RETORNO}</code></li>
        <li>Preencha abaixo o ID do app e a chave secreta (<i>Configurações do app → Básico</i>) e o ID da configuração. A chave fica guardada só no servidor.</li>
      </ol>
      <form class="met-form" id="metLogin">
        <div class="met-campos">
          <label class="campo"><span>ID do app</span><input type="text" id="metApp" inputmode="numeric" value="${esc(app.appId || '')}" required></label>
          <label class="campo"><span>ID da configuração</span><input type="text" id="metConfig" inputmode="numeric" value="${esc(app.config || '')}" required></label>
        </div>
        <label class="campo"><span>Chave secreta do app</span><input type="password" id="metSegredo" autocomplete="off" placeholder="${app.temSegredo ? 'já guardada — deixe em branco para manter' : ''}" ${app.temSegredo ? '' : 'required'}></label>
<label class="campo"><span>ID da conta do Instagram <i>(opcional)</i></span><input type="text" id="metIgId" inputmode="numeric" value="${esc(app.igId || '')}" placeholder="só se o Universo não encontrar a conta sozinho"><small>No portfólio empresarial: Contas → Contas do Instagram → a conta → ID.</small></label>
        <button type="submit" id="metEntrar">Entrar com o Instagram</button>
        <p class="met-msg" id="metMsg" role="status"></p>
      </form>
      <details class="met-alt">
        <summary>Já tenho um token de acesso</summary>
        <form class="met-form" id="metForm">
          <label class="campo"><span>Token (de usuário do sistema ou do login do Instagram)</span><input type="password" id="metToken" autocomplete="off" required></label>
<label class="campo"><span>ID da conta do Instagram <i>(opcional)</i></span><input type="text" id="metIgId2" inputmode="numeric" value="${esc(app.igId || '')}" placeholder="só se o Universo não encontrar a conta sozinho"><small>No portfólio empresarial: Contas → Contas do Instagram → a conta → ID.</small></label>
          <button type="submit" id="metConectar">Conectar e coletar</button>
          <p class="met-msg" id="metMsgToken" role="status"></p>
        </form>
      </details>
    </section>`;
}


async function carregarMinis() {
  for (const a of raiz.querySelectorAll('[data-mini]')) {
    const id = a.dataset.mini;
    if (!id) continue;
    try {
      if (!minis.has(id)) {
        // miniaturas guardadas neste navegador: só baixa a que ainda não tem
        let blob = await local.ler('igmini:' + id, 'meta');
        if (!blob) {
          blob = await nuvem.igMiniatura(id);
          local.gravar('igmini:' + id, blob, 'meta');
        }
        minis.set(id, URL.createObjectURL(blob));
      }
      a.style.backgroundImage = `url(${minis.get(id)})`;
    } catch { /* sem miniatura */ }
  }
}

// ---------------------------------------------------------------------------
// Eventos

function msg(t, erro, id = '#metMsg') {
  const el = raiz.querySelector(id);
  if (el) { el.textContent = t; el.classList.toggle('erro', !!erro); }
}

async function atualizarTudo(bt) {
  bt.disabled = true;
  bt.textContent = 'Atualizando…';
  try { await nuvem.igColetar(); } catch { /* o erro aparece no estado */ }
  await carregar();
}

/** Guarda tema/objetivo sem redesenhar a tabela (para não perder o foco de quem digita). */
async function salvarEtiqueta(chave) {
  const tema = raiz.querySelector(`[data-tema="${CSS.escape(chave)}"]`)?.value || '';
  const objetivo = raiz.querySelector(`[data-objetivo="${CSS.escape(chave)}"]`)?.value || '';
  try {
    await nuvem.etiquetar(chave, { tema, objetivo });
    dados.etiquetas = dados.etiquetas || {};
    if (tema || objetivo) dados.etiquetas[chave] = { tema: tema.trim(), objetivo }; else delete dados.etiquetas[chave];
    N = normalizar(dados);
    const lista = raiz.querySelector('#metTemas');
    if (lista && tema && ![...lista.options].some((o) => o.value === tema.trim())) lista.insertAdjacentHTML('beforeend', `<option value="${esc(tema.trim())}">`);
  } catch (err) {
    alert('Não foi possível salvar: ' + err.message);
  }
}

function ligar() {
  raiz.dataset.ligado = '1';
  raiz.addEventListener('submit', async (e) => {
    if (e.target.id === 'metAddConc') {
      e.preventDefault();
      const campo = raiz.querySelector('#metConcUser');
      const bt = e.target.querySelector('button');
      if (!campo.value.trim()) return;
      bt.disabled = true;
      msg('Buscando a conta…', false, '#metConcMsg');
      try {
        dados.concorrentes = await nuvem.concAdicionar(campo.value);
        N = normalizar(dados);
        desenhar();
        raiz.querySelector('#metConcUser')?.focus();
      } catch (err) {
        msg(err.message, true, '#metConcMsg');
        bt.disabled = false;
      }
      return;
    }
    if (e.target.id === 'metLogin') {
      e.preventDefault();
      const bt = raiz.querySelector('#metEntrar');
      bt.disabled = true;
      msg('Abrindo o login do Meta…');
      try {
        const { url } = await nuvem.igLogin({
          appId: raiz.querySelector('#metApp').value,
          config: raiz.querySelector('#metConfig').value,
          segredo: raiz.querySelector('#metSegredo').value,
          volta: location.origin + location.pathname,
          igId: raiz.querySelector('#metIgId').value,
        });
        location.href = url;
      } catch (err) {
        msg(err.message, true);
        bt.disabled = false;
      }
      return;
    }
    if (e.target.id !== 'metForm') return;
    e.preventDefault();
    const bt = raiz.querySelector('#metConectar');
    bt.disabled = true;
    msg('Conectando e buscando os primeiros números… pode levar alguns segundos.', false, '#metMsgToken');
    try {
      await nuvem.igConectar(raiz.querySelector('#metToken').value, raiz.querySelector('#metIgId2').value);
      await carregar();
    } catch (err) {
      msg(err.message, true, '#metMsgToken');
      bt.disabled = false;
    }
  });

  raiz.addEventListener('click', async (e) => {
    const seg = e.target.closest('.met-seg button');
    if (seg) {
      ui[seg.parentElement.dataset.grupo] = seg.dataset.v;
      desenhar();
      return;
    }
    const rd = e.target.closest('[data-rede]');
    if (rd && !rd.disabled) { ui.rede = rd.dataset.rede; desenhar(); return; }
    const th = e.target.closest('th[data-ord]');
    if (th) {
      const k = th.dataset.ord;
      ui.ordem = ui.ordem.col === k ? { col: k, desc: !ui.ordem.desc } : { col: k, desc: true };
      desenhar();
      return;
    }
    if (e.target.id === 'metAtualizar' || e.target.id === 'metAtualizar2') { await atualizarTudo(e.target); return; }
    if (e.target.id === 'metDesconectar') {
      if (!confirm('Desconectar o Instagram? O histórico já coletado continua guardado.')) return;
      await nuvem.igDesconectar();
      await carregar();
      return;
    }
    const rem = e.target.closest('[data-conc-remover]');
    if (rem) {
      const u = rem.dataset.concRemover;
      if (!confirm(`Remover @${u} dos concorrentes? O histórico desta conta será apagado.`)) return;
      rem.disabled = true;
      try { dados.concorrentes = await nuvem.concRemover(u); N = normalizar(dados); desenhar(); } catch (err) { alert(err.message); rem.disabled = false; }
      return;
    }
    const at = e.target.closest('[data-conc-atualizar]');
    if (at) {
      at.disabled = true;
      at.textContent = 'buscando…';
      try { dados.concorrentes = await nuvem.concAtualizar(at.dataset.concAtualizar); N = normalizar(dados); desenhar(); } catch (err) { alert(err.message); at.disabled = false; at.textContent = 'atualizar'; }
    }
  });

  raiz.addEventListener('change', async (e) => {
    if (e.target.id === 'metNucleo') { ui.nucleo = e.target.value; desenhar(); return; }
    const tema = e.target.closest('[data-tema]');
    if (tema) { await salvarEtiqueta(tema.dataset.tema); return; }
    const obj = e.target.closest('[data-objetivo]');
    if (obj) { obj.classList.toggle('ligado', !!obj.value); await salvarEtiqueta(obj.dataset.objetivo); return; }
    const sel = e.target.closest('select[data-vincular]');
    if (!sel || sel.value === '') return;
    const v = sel.value === '-' ? null : sel.value;
    sel.disabled = true;
    try {
      await nuvem.igVincular(sel.dataset.vincular, v);
      await carregar();
    } catch (err) {
      sel.disabled = false;
      alert('Não foi possível ligar: ' + err.message);
    }
  });
  raiz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-tema]')) e.target.blur();
  });
}
