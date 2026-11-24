// ==========================================================================
// Peças comuns das páginas de gestão — Bases e Plano Geral de Trabalho (PGT).
// Cadeia: Bases → PGT → Projetos. Os dados moram no Universo (migração 0005);
// estas páginas editam o rascunho e publicam versões numeradas, que o vendas lê.
// Aqui fica só a ESTRUTURA; o custo (preço dos serviços, pesos, parcelas, CUB vigente, BH)
// é do vendas, na página Honorários (migração 0006).
// ==========================================================================

// rota da API de cada tipo de registro (pelo prefixo do id)
const ROTA_DE = {
  srv: 'bases-servicos', tca: 'bases-categorias', tus: 'bases-usos',
  pfa: 'pgt-fases', pet: 'pgt-etapas', pen: 'pgt-entregaveis', pev: 'pgt-eventos', pma: 'pgt-materiais', pmo: 'pgt-modelos'
};
const rotaDe = (id) => ROTA_DE[String(id).slice(0, 3)];

const GRUPOS = [
  { id: 'residencial', nome: 'Residencial', cor: 'var(--odisse-pessego, #F2DDBE)' },
  { id: 'comercial', nome: 'Comercial', cor: 'var(--odisse-ambar, #ECC28F)' },
  { id: 'institucional', nome: 'Institucional', cor: 'color-mix(in srgb, var(--odisse-ardosia, #3F4B57) 30%, white)' },
  { id: 'diversos', nome: 'Diversos', cor: 'var(--odisse-areia, #E3D9C6)' }
];

// Os 9 critérios do índice de complexidade que vêm de preset (os outros 2 são calculados no orçamento).
const CRITERIOS_IC = [
  { id: 'qtd_especialistas', nome: 'Especialistas', longo: 'Quantidade de especialistas' },
  { id: 'qtd_aprovacoes', nome: 'Aprovações', longo: 'Quantidade de aprovações' },
  { id: 'grau_resp_civil', nome: 'Resp. civil', longo: 'Grau de responsabilidade civil' },
  { id: 'grau_intervencao_cliente', nome: 'Intervenção do cliente', longo: 'Grau de intervenção do cliente' },
  { id: 'expectativa_plastica', nome: 'Expectativa plástica', longo: 'Expectativa plástica' },
  { id: 'grau_controle_custo', nome: 'Controle de custo', longo: 'Grau de controle de custo' },
  { id: 'indefinicao_escopo', nome: 'Indef. do escopo', longo: 'Indefinição do escopo' },
  { id: 'indefinicao_prazo', nome: 'Indef. do prazo', longo: 'Indefinição do prazo' },
  { id: 'demanda_midia', nome: 'Mídias', longo: 'Demanda de material para mídias' }
];
const NIVEIS = [{ id: 'baixo', nome: 'Baixo' }, { id: 'medio', nome: 'Médio' }, { id: 'alto', nome: 'Alto' }];

const PERTINENCIAS = [
  { id: 'P', nome: 'Vem marcado' }, { id: 'O', nome: 'Opcional' }, { id: '', nome: 'Não se aplica' },
  { id: 'S', nome: 'Perpétuo (vale sempre)' }
];
const proximaPert = (p) => (p === 'P' ? 'O' : p === 'O' ? '' : 'P');

// números digitados com vírgula ou ponto; vazio = null
const lerNum = (s) => {
  const t = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const fmtNum = (n, casas) => (n === null || n === undefined || n === '') ? '' :
  Number(n).toLocaleString('pt-BR', casas === undefined ? { maximumFractionDigits: 4 } : { minimumFractionDigits: casas, maximumFractionDigits: casas });

// (i) com dica ao pousar o mouse
const info = (texto) => texto ? `<span class="info" tabindex="0" title="${escHtml(texto)}" aria-label="${escHtml(texto)}">i</span>` : '';

// Cabeçalho de publicação: versão publicada, pendência e botão Publicar.
// antes(): opcional; roda antes de abrir a publicação (ex.: salvar o que está na fila) e devolve false para não seguir.
function desenharPublicacao(el, dados, tipo, aoPublicar, antes) {
  const p = dados.publicacao;
  const quando = p ? new Date(p.publicado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  el.innerHTML = `
    <span class="gestao-status">
      ${p ? `<span title="${escHtml(p.nota || '')}">Versão <strong>${p.numero}</strong> publicada em ${quando}</span>` : '<span>Ainda não publicado</span>'}
      ${dados.pendente ? '<span class="chip chip--pendente">mudanças não publicadas</span>' : '<span class="chip chip--ok">em dia</span>'}
    </span>
    <button class="btn btn--primary btn--small" type="button" ${dados.pendente ? '' : 'disabled'}>Publicar versão</button>`;
  el.querySelector('button').onclick = async () => {
    if (antes && (await antes()) === false) return;
    abrirPublicar(tipo, p ? p.numero + 1 : 1, aoPublicar);
  };
}

function abrirPublicar(tipo, numero, aoPublicar) {
  const nome = tipo === 'bases' ? 'das Bases' : 'do Plano Geral de Trabalho';
  const painel = abrirPainel(`
    <div class="painel__topo"><h2>Publicar a versão ${numero} ${nome}</h2><button class="painel__fechar" aria-label="Fechar">×</button></div>
    <div id="pub-aviso"></div>
    <p class="small">Publicar grava um retrato completo do que está aqui agora. É esse retrato que o vendas usa nas propostas novas
      (cada proposta registra a versão usada). O rascunho continua editável depois.</p>
    <form id="f-pub">
      <div class="field"><label class="field__label">O que mudou (opcional)</label>
        <textarea name="nota" rows="3" maxlength="500" placeholder="Ex.: entregáveis de Retrofit revisados"></textarea></div>
      <div class="painel__acoes"><button class="btn btn--primary btn--small" type="submit">Publicar</button></div>
    </form>`);
  const av = avisoEm(painel.querySelector('#pub-aviso'));
  painel.querySelector('#f-pub').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await Universo.post(`${tipo}/publicar`, { nota: e.target.nota.value.trim() || null });
      fecharPainel();
      aoPublicar();
    } catch (err) { av(err.status === 409 ? 'Nada mudou desde a última versão publicada.' : mensagemDe(err)); }
  };
}

// Célula de pertinência, que alterna ao clicar: ✓ vem marcado (P) · caixa laranja com – opcional (O) ·
// – sem caixa não se aplica · ✓ cinza perpétuo (S: vale sempre, não se desmarca).
const CHECK_PERT = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.4 6.3 4.9 8.7 9.6 3.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const MARCA_PERT = { P: CHECK_PERT, O: '–', '': '–', S: CHECK_PERT };
const celulaPert = (p, titulo, extra = '') =>
  `<button type="button" class="pert" data-p="${p || ''}" title="${escHtml(titulo)}: ${escHtml(nomeDe(PERTINENCIAS, p || ''))}" aria-label="${escHtml(titulo)}: ${escHtml(nomeDe(PERTINENCIAS, p || ''))}" ${extra}>${MARCA_PERT[p || '']}</button>`;

// Arquivar / restaurar qualquer registro das Bases ou do PGT.
async function arquivarRegistro(reg, restaurar = false) {
  return Universo.post(`${rotaDe(reg.id)}/${encodeURIComponent(reg.id)}/${restaurar ? 'restaurar' : 'arquivar'}`, { versao: reg.versao });
}

// Lista de arquivados com "restaurar" (rodapé das páginas).
function desenharArquivados(el, itens, nomesTipo, aoMudar) {
  if (!itens.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<details class="arquivados"><summary>Arquivados (${itens.length})</summary>
    <ul class="lista-int">${itens.map((a, i) => `<li>${escHtml(nomesTipo[a.tipo] || a.tipo)} · ${escHtml(a.nome)}
      <button type="button" class="btn-link" data-i="${i}">restaurar</button></li>`).join('')}</ul></details>`;
  el.querySelectorAll('[data-i]').forEach((b) => b.onclick = async () => {
    try { await arquivarRegistro(itens[Number(b.dataset.i)], true); aoMudar(); } catch (e) { alert(mensagemDe(e)); }
  });
}

// Liga abas (botões com data-aba) a seções (data-painel); lembra a última aba nesta janela.
function ligarAbas(raiz, aoTrocar) {
  const botoes = [...raiz.querySelectorAll('[data-aba]')];
  const chave = 'aba:' + location.pathname;
  const mostrar = (id) => {
    botoes.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === id)));
    document.querySelectorAll('[data-painel]').forEach((s) => { s.hidden = s.dataset.painel !== id; });
    try { sessionStorage.setItem(chave, id); } catch (_) { /* sem armazenamento */ }
    if (aoTrocar) aoTrocar(id);
  };
  botoes.forEach((b) => b.onclick = () => mostrar(b.dataset.aba));
  let inicial = '';
  try { inicial = sessionStorage.getItem(chave) || ''; } catch (_) { /* sem armazenamento */ }
  mostrar(botoes.some((b) => b.dataset.aba === inicial) ? inicial : botoes[0].dataset.aba);
}
