/*
  Seletor de quem assina — v1. O mesmo em todas as ferramentas (Documentos do Universo, vendas, Projetos).

    import { seletorAssinantes } from 'https://universo.odisse.com.br/base/v1/assinantes.js';

    const s = seletorAssinantes(elemento, {
      uso: 'documento',                        // proposta | contrato | documento | rrt
      carregar: () => …,                       // Promise com os itens de GET equipe/assinantes?para=<uso>
      foto: (pessoa) => …,                     // opcional: Promise com o endereço da foto (ou null)
      valor: [ …cópias guardadas no documento ],
      novo: true,                              // documento novo: começa com os últimos escolhidos neste uso
      aoMudar: (copias) => { … },
      rotulo: '+ Assinante',                   // opcional: texto do botão de acrescentar
    });
    s.valor();                                 // → as cópias, para guardar no documento

  Cópia de cada assinante (o documento guarda esta cópia; mudar o cadastro depois não muda o emitido):
    { equipe_id, nome, cargo, titulo, registro, rubrica }   // rubrica: true = a pessoa tem iniciais enviadas
    { nome, cargo, registro }                               // pessoa de fora, digitada aqui (sem rubrica)

  A ferramenta busca a imagem da rubrica só na emissão (GET equipe/:id/assinatura?uso=…&registro=…);
  na prévia, a folha mostra a caixa do lugar dela.

  A lista vem só com quem está ativo e pode assinar aquele uso. Os estilos ficam aqui, com prefixo .ua-.
  Ajuste compatível entra em v1/; mudar o formato da cópia = v2/.
*/

const CSS = `
.ua { display: flex; flex-direction: column; gap: 6px; font: inherit; color: var(--u-tinta, #3F4B57); }
.ua-item { display: grid; grid-template-columns: 32px 1fr auto; align-items: center; gap: 4px 10px; padding: 6px 8px;
  border: 1px solid var(--u-linha, #D7DADD); border-radius: var(--u-raio-p, 6px); background: var(--u-elevada, #fff); }
.ua-foto { width: 32px; height: 32px; border-radius: 50%; background: var(--u-fundo, #ECEDEB) center / cover no-repeat;
  display: grid; place-items: center; font-size: 11px; font-weight: 600; color: var(--u-tinta-2, #5B6773); overflow: hidden; }
.ua-nome { font-weight: 600; font-size: 13px; line-height: 1.3; }
.ua-linha { font-size: 12px; line-height: 1.35; color: var(--u-tinta-2, #5B6773); }
.ua-aviso { grid-column: 2 / 4; font-size: 11.5px; color: var(--u-destaque, #BB8248); }
.ua-aviso button { all: unset; cursor: pointer; text-decoration: underline; color: inherit; }
.ua-tirar { all: unset; cursor: pointer; width: 26px; height: 26px; border-radius: 4px; text-align: center; line-height: 26px;
  color: var(--u-tinta-2, #5B6773); font-size: 16px; }
.ua-tirar:hover { background: var(--u-fundo, #ECEDEB); }
.ua-fora { grid-template-columns: 32px 1fr auto; }
.ua-fora .ua-campos { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.ua-fora input { box-sizing: border-box; width: 100%; min-width: 0; font: inherit; font-size: 12.5px; padding: 5px 7px;
  border: 1px solid var(--u-linha, #D7DADD); border-radius: 4px; background: var(--u-superficie, #FAFAF7); color: inherit; }
.ua-fora input[data-k="nome"] { grid-column: 1 / 3; font-weight: 600; }
.ua-vazio { font-size: 12.5px; color: var(--u-tinta-2, #5B6773); margin: 0; }
.ua-mais { position: relative; align-self: flex-start; }
.ua-abrir { font: inherit; font-size: 12.5px; cursor: pointer; padding: 6px 10px; border-radius: var(--u-raio-p, 6px);
  border: 1px solid var(--u-linha-forte, #C3C8CD); background: var(--u-elevada, #fff); color: inherit; }
.ua-abrir:hover { border-color: var(--u-tinta-2, #5B6773); }
.ua-menu { position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; min-width: 300px; max-height: 340px; overflow: auto;
  padding: 4px; border: 1px solid var(--u-linha-forte, #C3C8CD); border-radius: var(--u-raio, 8px); background: var(--u-elevada, #fff);
  box-shadow: 0 8px 24px rgba(30, 38, 46, .14); }
.ua-op { all: unset; box-sizing: border-box; display: grid; grid-template-columns: 32px 1fr; align-items: center; gap: 2px 10px;
  width: 100%; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
.ua-op:hover, .ua-op:focus-visible { background: var(--u-fundo, #ECEDEB); }
.ua-op[aria-disabled="true"] { opacity: .45; cursor: default; background: none; }
.ua-op .ua-linha { grid-column: 2; }
.ua-ultimo { font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--u-tinta-2, #5B6773); margin-left: 6px; }
.ua-sep { height: 1px; margin: 4px 6px; background: var(--u-linha, #D7DADD); }
.ua-msg { padding: 8px 10px; font-size: 12.5px; color: var(--u-tinta-2, #5B6773); }
`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const iniciais = (n) => String(n || '?').trim().split(/\s+/).filter(Boolean).map((p) => p[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase();
const CHAVE = (uso) => `universo:assinantes:${uso}`;
const lembrar = (uso, ids) => { try { localStorage.setItem(CHAVE(uso), JSON.stringify(ids)); } catch {} };
const ultimos = (uso) => { try { return JSON.parse(localStorage.getItem(CHAVE(uso)) || '[]'); } catch { return []; } };

// Cadastro → cópia que o documento guarda.
export function copiaDe(p) {
  return {
    equipe_id: p.id,
    nome: p.nome_assinatura || p.nome,
    cargo: p.cargo || '',
    titulo: p.titulo || '',
    registro: p.registro_formatado || '',
    rubrica: !!p.tem_assinatura,
  };
}
const CAMPOS = ['nome', 'cargo', 'titulo', 'registro', 'rubrica'];
const diferente = (copia, p) => { const n = copiaDe(p); return CAMPOS.some((k) => (copia[k] ?? '') !== (n[k] ?? '')); };

let estilo = false;
export function seletorAssinantes(raiz, { uso, carregar, foto, valor = [], novo = false, aoMudar = () => {}, rotulo = '+ Assinante' } = {}) {
  if (!estilo) { const st = document.createElement('style'); st.textContent = CSS; document.head.append(st); estilo = true; }
  if (!['proposta', 'contrato', 'documento', 'rrt'].includes(uso)) throw new Error('seletorAssinantes: uso inválido');
  let lista = (valor || []).map((a) => ({ ...a }));
  let equipe = null, erro = null;
  const fotos = new Map(); // id → url | null

  raiz.classList.add('ua');
  const caixa = document.createElement('div');
  caixa.className = 'ua';
  const mais = document.createElement('div');
  mais.className = 'ua-mais';
  mais.innerHTML = '<button type="button" class="ua-abrir" aria-haspopup="listbox" aria-expanded="false"></button>';
  raiz.replaceChildren(caixa, mais);
  const botao = mais.firstElementChild;
  botao.textContent = rotulo;
  let menu = null;

  const mudou = () => {
    lembrar(uso, lista.filter((a) => a.equipe_id).map((a) => a.equipe_id));
    aoMudar(lista.map((a) => ({ ...a })));
  };
  const pessoa = (id) => equipe?.find((p) => p.id === id);
  const fotoHtml = (id, nome) => {
    const u = fotos.get(id);
    return u ? `<span class="ua-foto" style="background-image:url('${esc(u)}')"></span>` : `<span class="ua-foto">${esc(iniciais(nome))}</span>`;
  };

  const desenhar = () => {
    caixa.innerHTML = lista.length ? lista.map((a, i) => {
      if (!a.equipe_id) {
        return `<div class="ua-item ua-fora" data-i="${i}"><span class="ua-foto">${a.nome ? esc(iniciais(a.nome)) : '+'}</span>
          <div class="ua-campos"><input data-k="nome" placeholder="Nome (pessoa de fora)" value="${esc(a.nome || '')}">
            <input data-k="cargo" placeholder="Cargo" value="${esc(a.cargo || '')}">
            <input data-k="registro" placeholder="Registro (ex.: CAU A000000-0)" value="${esc(a.registro || '')}"></div>
          <button type="button" class="ua-tirar" data-tirar="${i}" aria-label="Tirar ${esc(a.nome || 'assinante')}">×</button></div>`;
      }
      const p = pessoa(a.equipe_id);
      let aviso = '';
      if (equipe && !p) aviso = 'Não pode mais assinar isto (ou saiu da equipe). A cópia guardada continua valendo.';
      else if (p && diferente(a, p)) aviso = 'O cadastro mudou desde a escolha. <button type="button" data-atualizar="' + i + '">Atualizar</button>';
      return `<div class="ua-item" data-i="${i}">${fotoHtml(a.equipe_id, a.nome)}
        <div><div class="ua-nome">${esc(a.nome)}</div><div class="ua-linha">${esc([a.cargo, a.registro].filter(Boolean).join(' · ') || '—')}</div></div>
        <button type="button" class="ua-tirar" data-tirar="${i}" aria-label="Tirar ${esc(a.nome)}">×</button>
        ${aviso ? `<div class="ua-aviso">${aviso}</div>` : ''}</div>`;
    }).join('') : '<p class="ua-vazio">Sem assinante.</p>';
  };

  const fechar = () => { menu?.remove(); menu = null; botao.setAttribute('aria-expanded', 'false'); };
  const preencher = () => {
    const ult = ultimos(uso);
    if (erro) menu.innerHTML = `<div class="ua-msg">Não foi possível ler a equipe (${esc(erro)}).</div>`;
    else if (!equipe) menu.innerHTML = '<div class="ua-msg">Carregando a equipe…</div>';
    else {
      const ordem = [...equipe].sort((a, b) => (ult.includes(a.id) ? 0 : 1) - (ult.includes(b.id) ? 0 : 1));
      menu.innerHTML = (ordem.length ? ordem.map((p) => {
        const ja = lista.some((a) => a.equipe_id === p.id);
        return `<button type="button" class="ua-op" role="option" data-id="${esc(p.id)}"${ja ? ' aria-disabled="true"' : ''}>
          ${fotoHtml(p.id, p.nome_assinatura || p.nome)}<span class="ua-nome">${esc(p.nome_assinatura || p.nome)}${ult.includes(p.id) ? '<span class="ua-ultimo">último</span>' : ''}</span>
          <span class="ua-linha">${esc([p.cargo, p.registro_formatado].filter(Boolean).join(' · ') || '—')}</span></button>`;
      }).join('') : '<div class="ua-msg">Ninguém da equipe está marcado para assinar isto.</div>') +
        '<div class="ua-sep"></div><button type="button" class="ua-op" data-fora><span class="ua-foto">+</span><span class="ua-nome">Pessoa de fora</span><span class="ua-linha">Digitar nome, cargo e registro</span></button>';
    }
  };
  const abrir = () => {
    if (menu) return fechar();
    menu = document.createElement('div');
    menu.className = 'ua-menu';
    menu.setAttribute('role', 'listbox');
    preencher();
    mais.append(menu);
    botao.setAttribute('aria-expanded', 'true');
    menu.querySelector('.ua-op:not([aria-disabled="true"])')?.focus();
  };

  botao.addEventListener('click', abrir);
  mais.addEventListener('keydown', (ev) => {
    if (!menu) return;
    if (ev.key === 'Escape') { fechar(); botao.focus(); }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      const ops = [...menu.querySelectorAll('.ua-op:not([aria-disabled="true"])')];
      const i = ops.indexOf(document.activeElement);
      ops[(i + (ev.key === 'ArrowDown' ? 1 : -1) + ops.length) % ops.length]?.focus();
      ev.preventDefault();
    }
  });
  document.addEventListener('click', (ev) => { if (menu && !mais.contains(ev.target)) fechar(); });
  mais.addEventListener('click', (ev) => {
    const op = ev.target.closest('.ua-op');
    if (!op || op.getAttribute('aria-disabled') === 'true') return;
    if (op.hasAttribute('data-fora')) lista.push({ nome: '', cargo: '', registro: '' });
    else lista.push(copiaDe(pessoa(op.dataset.id)));
    fechar(); desenhar(); mudou();
    if (op.hasAttribute('data-fora')) caixa.querySelector('.ua-fora:last-child input')?.focus();
  });
  caixa.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-tirar]');
    if (t) { lista.splice(Number(t.dataset.tirar), 1); desenhar(); mudou(); return; }
    const at = ev.target.closest('[data-atualizar]');
    if (at) { const i = Number(at.dataset.atualizar); lista[i] = copiaDe(pessoa(lista[i].equipe_id)); desenhar(); mudou(); }
  });
  caixa.addEventListener('input', (ev) => {
    const linha = ev.target.closest('.ua-fora');
    if (!linha || !ev.target.dataset.k) return;
    lista[Number(linha.dataset.i)][ev.target.dataset.k] = ev.target.value;
    aoMudar(lista.map((a) => ({ ...a })));
  });

  desenhar();
  Promise.resolve().then(carregar).then((itens) => {
    equipe = (itens && itens.itens) || itens || [];
    if (novo && !lista.length) {
      const pre = ultimos(uso).map(pessoa).filter(Boolean).map(copiaDe);
      if (pre.length) { lista = pre; aoMudar(lista.map((a) => ({ ...a }))); }
    }
    desenhar();
    if (menu) preencher();
    if (foto) {
      for (const p of equipe) {
        if (!p.foto_id) { fotos.set(p.id, null); continue; }
        Promise.resolve(foto(p)).then((u) => { fotos.set(p.id, u || null); desenhar(); if (menu) preencher(); }).catch(() => {});
      }
    }
  }).catch((e) => { erro = e?.message || String(e); desenhar(); if (menu) preencher(); });

  return {
    valor: () => lista.filter((a) => a.equipe_id || a.nome || a.cargo || a.registro).map((a) => ({ ...a })),
    /** Lista atual da equipe (depois de carregada), para quem precisar conferir algo. */
    equipe: () => equipe,
  };
}
