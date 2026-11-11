// Páginas do hub. Rotas por hash: #/ (Início), #/ferramentas, #/canais, #/marca, #/biblioteca.
// Tudo vem de dois arquivos: ferramentas.json (aqui) e odisse.json (marca.odisse.com.br).

const MARCA = 'https://marca.odisse.com.br/';
const API = 'https://universo-hub.reservaprojectbasework.workers.dev';
const vista = document.getElementById('vista');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const semProtocolo = (u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

let MAPA = null;   // ferramentas.json
let ODISSE = null; // odisse.json da marca

async function carregar() {
  const [mapa, odisse] = await Promise.all([
    fetch('ferramentas.json', { cache: 'no-cache' }).then((r) => r.json()),
    fetch(MARCA + 'odisse.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => null),
  ]);
  MAPA = mapa; ODISSE = odisse;
}

// ---- peças ---------------------------------------------------------------

function cartao(f) {
  const breve = f.status === 'em-breve' || !f.url;
  const tag = breve ? '<span class="u-etiqueta suave">em breve</span>'
    : f.acesso === 'publica' ? '<span class="u-etiqueta">público</span>' : '';
  const titulo = breve ? `<b>${esc(f.nome)}</b>` : `<a class="principal" href="${esc(f.url)}"><b>${esc(f.nome)}</b></a>`;
  const extras = (f.extra || []).map((x) => `<a href="${esc(x.url)}">${esc(x.nome)} →</a>`).join('');
  const host = !breve && f.url ? `<span>${esc(semProtocolo(f.url))}</span>` : '';
  return `<div class="u-cartao item${breve ? ' breve' : ''}">
    <div class="topo">${titulo}${tag}</div>
    ${f.descricao ? `<p>${esc(f.descricao)}</p>` : ''}
    ${host || extras ? `<div class="rodape">${host}${extras}</div>` : ''}
  </div>`;
}

function cabecalho(titulo, texto, lado = '') {
  return `<div class="cab"><div><h1 class="u-titulo">${esc(titulo)}</h1>${texto ? `<p class="u-apoio">${texto}</p>` : ''}</div>
    ${lado ? `<div class="lado u-apoio">${lado}</div>` : ''}</div>`;
}

function blocosDaSecao(secao, compactos = false) {
  return MAPA.grupos.filter((g) => g.secao === secao).map((g) => {
    const itens = MAPA.itens.filter((f) => f.grupo === g.id);
    if (!itens.length) return '';
    return `<section class="bloco"><span class="u-rotulo">${esc(g.nome)}</span>
      <div class="cartoes${compactos ? ' compactos' : ''}">${itens.map(cartao).join('')}</div></section>`;
  }).join('');
}

function toque(texto) {
  let el = document.querySelector('.toque');
  if (!el) { el = document.createElement('div'); el.className = 'toque'; document.body.appendChild(el); }
  el.textContent = texto; el.classList.add('on');
  clearTimeout(toque.t); toque.t = setTimeout(() => el.classList.remove('on'), 1600);
}


// ---- Marca: dados institucionais (leitura e edição) -------------------------
// Leitura: odisse.json publicado em marca.odisse.com.br.
// Edição: pela API do hub, que lê o arquivo direto do repositório e grava um commit.

const NOMES_REDES = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', substack: 'Substack' };
const NOMES_SITES = { institucional: 'Site institucional', projetos: 'Landing pages', herma: 'Herma', objetos: 'Loja Objetos' };

const senha = {
  ler() { try { return localStorage.getItem('universo:senha') || ''; } catch { return ''; } },
  gravar(v) { try { v ? localStorage.setItem('universo:senha', v) : localStorage.removeItem('universo:senha'); } catch {} },
};

async function api(caminho, opcoes = {}) {
  const r = await fetch(API + caminho, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + senha.ler(), ...(opcoes.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}

function dadosLeitura(aviso = '') {
  const topo = `<div class="bloco-cab"><span class="u-rotulo">Dados institucionais</span>
    <button class="u-botao" data-acao="editar">Editar dados</button></div>${aviso}`;
  if (!ODISSE) return topo + '<p class="u-apoio">Não foi possível ler os dados institucionais.</p>';
  const d = ODISSE, e = d.endereco;
  const link = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`;
  const lista = (obj, nomes) => Object.entries(obj || {}).filter(([, u]) => u)
    .map(([k, u]) => `${esc(nomes[k] || k)}: ${link(u, semProtocolo(u))}`).join('<br>');
  const linhas = [
    ['Nome', esc(d.nome_completo)],
    ['Descrição', esc(d.descricao)],
    ['Fundadores', esc(d.fundadores.join(' e '))],
    ['E-mail', link('mailto:' + d.contato.email, d.contato.email)],
    ['Telefone e WhatsApp', link(d.contato.whatsapp_link, d.contato.telefone)],
    ['Endereço', esc(`${e.logradouro}, ${e.bairro} · ${e.cidade}/${e.uf} · CEP ${e.cep}`) + (e.caixa_postal ? ' · Caixa postal ' + esc(e.caixa_postal) : '')],
    ['Redes', lista(d.redes, NOMES_REDES)],
    ['Sites', lista(d.sites, NOMES_SITES)],
    ['Núcleos', d.nucleos.map((n) => `<b>${esc(n.nome)}</b> — ${esc(n.conteudo)}`).join('<br>')],
    ['Atualizado em', esc(d.atualizado)],
  ];
  return topo + `<table class="u-tabela dados"><tbody>${linhas.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;
}

function telaSenha(msg = '') {
  return `<div class="bloco-cab"><span class="u-rotulo">Dados institucionais · editar</span></div>
    <form class="u-cartao form-senha" data-form="senha">
      <label class="u-campo"><span>Senha do Universo</span>
        <input type="password" name="senha" autocomplete="current-password" required autofocus>
        <small>A mesma senha da equipe. Fica lembrada neste computador.</small></label>
      ${msg ? `<p class="erro">${esc(msg)}</p>` : ''}
      <div class="acoes"><button class="u-botao" type="button" data-acao="cancelar">Cancelar</button>
        <button class="u-botao forte" type="submit">Entrar</button></div>
    </form>`;
}

function campo(nome, rotulo, valor, { tipo = 'text', dica = '', area = false, largo = false } = {}) {
  const ctrl = area
    ? `<textarea name="${nome}" rows="3">${esc(valor)}</textarea>`
    : `<input type="${tipo}" name="${nome}" value="${esc(valor)}">`;
  return `<label class="u-campo${largo ? ' largo' : ''}"><span>${esc(rotulo)}</span>${ctrl}${dica ? `<small>${esc(dica)}</small>` : ''}</label>`;
}

function formulario(d, msg = '') {
  const e = d.endereco, c = d.contato;
  const grupo = (titulo, html) => `<fieldset><legend>${titulo}</legend><div class="campos">${html}</div></fieldset>`;
  return `<div class="bloco-cab"><span class="u-rotulo">Dados institucionais · editando</span></div>
    <form class="u-cartao form-marca" data-form="marca" novalidate>
      ${grupo('Identidade',
        campo('nome', 'Nome curto', d.nome) +
        campo('nome_completo', 'Nome completo', d.nome_completo) +
        campo('nome_completo_en', 'Nome completo (inglês)', d.nome_completo_en) +
        campo('fundadores', 'Fundadores', d.fundadores.join(', '), { dica: 'Separados por vírgula.' }) +
        campo('descricao', 'Descrição', d.descricao, { area: true, largo: true }) +
        campo('descricao_en', 'Descrição (inglês)', d.descricao_en, { area: true, largo: true }))}
      ${grupo('Contato',
        campo('contato.email', 'E-mail', c.email, { tipo: 'email' }) +
        campo('contato.telefone', 'Telefone', c.telefone, { tipo: 'tel', dica: 'O WhatsApp sai deste número.' }))}
      ${grupo('Endereço',
        campo('endereco.logradouro', 'Logradouro, número e sala', e.logradouro, { largo: true }) +
        campo('endereco.bairro', 'Bairro', e.bairro) +
        campo('endereco.cidade', 'Cidade', e.cidade) +
        campo('endereco.uf', 'UF', e.uf) +
        campo('endereco.cep', 'CEP', e.cep) +
        campo('endereco.caixa_postal', 'Caixa postal', e.caixa_postal))}
      ${grupo('Redes', Object.entries(d.redes).map(([k, u]) => campo('redes.' + k, NOMES_REDES[k] || k, u, { tipo: 'url' })).join(''))}
      ${grupo('Sites', Object.entries(d.sites).map(([k, u]) => campo('sites.' + k, NOMES_SITES[k] || k, u, { tipo: 'url' })).join(''))}
      ${grupo('Núcleos', d.nucleos.map((n) =>
        campo(`nucleo.${n.id}.nome`, 'Nome', n.nome) + campo(`nucleo.${n.id}.conteudo`, 'Conteúdo', n.conteudo)).join(''))}
      ${msg ? `<p class="erro">${esc(msg)}</p>` : ''}
      <div class="acoes"><span class="u-apoio">Salvar grava no repositório marca-odisse, com histórico. Os sites atualizam em 1 a 2 minutos.</span>
        <button class="u-botao" type="button" data-acao="cancelar">Cancelar</button>
        <button class="u-botao forte" type="submit">Salvar</button></div>
    </form>`;
}

function lerFormulario(form, base) {
  const v = (n) => form.elements[n]?.value ?? '';
  return {
    nome: v('nome'), nome_completo: v('nome_completo'), nome_completo_en: v('nome_completo_en'),
    descricao: v('descricao'), descricao_en: v('descricao_en'),
    fundadores: v('fundadores').split(',').map((s) => s.trim()).filter(Boolean),
    contato: { email: v('contato.email'), telefone: v('contato.telefone') },
    endereco: Object.fromEntries(['logradouro', 'bairro', 'cidade', 'uf', 'cep', 'caixa_postal'].map((k) => [k, v('endereco.' + k)])),
    redes: Object.fromEntries(Object.keys(base.redes).map((k) => [k, v('redes.' + k)])),
    sites: Object.fromEntries(Object.keys(base.sites).map((k) => [k, v('sites.' + k)])),
    nucleos: base.nucleos.map((n) => ({ id: n.id, nome: v(`nucleo.${n.id}.nome`), conteudo: v(`nucleo.${n.id}.conteudo`) })),
  };
}

function ligarDadosMarca() {
  const caixa = vista.querySelector('#dados-marca');
  if (!caixa) return;
  let edicao = null; // { dados, sha }

  const mostrar = (html) => { caixa.innerHTML = html; caixa.querySelector('[autofocus]')?.focus(); };

  async function abrir() {
    if (!senha.ler()) return mostrar(telaSenha());
    mostrar('<div class="bloco-cab"><span class="u-rotulo">Dados institucionais</span></div><p class="u-apoio">Abrindo…</p>');
    let r;
    try { r = await api('/api/marca'); } catch { return mostrar(dadosLeitura('<p class="erro">Não foi possível falar com o servidor do Universo.</p>')); }
    if (r.status === 401) { senha.gravar(''); return mostrar(telaSenha('Senha incorreta.')); }
    if (r.status !== 200) return mostrar(dadosLeitura(`<p class="erro">${esc(r.error || 'Erro ao abrir os dados.')}</p>`));
    edicao = { dados: r.dados, sha: r.sha };
    mostrar(formulario(edicao.dados));
  }

  caixa.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-acao]'); if (!b) return;
    if (b.dataset.acao === 'editar') abrir();
    if (b.dataset.acao === 'cancelar') { edicao = null; mostrar(dadosLeitura()); }
  });

  caixa.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    if (form.dataset.form === 'senha') { senha.gravar(form.elements.senha.value); return abrir(); }

    const botao = form.querySelector('[type=submit]');
    botao.disabled = true; botao.textContent = 'Salvando…';
    const novos = lerFormulario(form, edicao.dados);
    let r;
    try { r = await api('/api/marca', { method: 'PUT', body: JSON.stringify({ dados: novos, sha: edicao.sha }) }); }
    catch { r = { status: 0, error: 'Não foi possível falar com o servidor do Universo.' }; }

    if (r.status === 200) {
      ODISSE = r.dados; edicao = null;
      const aviso = r.semMudanca ? '<p class="ok">Nada mudou.</p>'
        : `<p class="ok">Salvo: ${esc((r.mudou || []).join(', '))}. Os sites atualizam em 1 a 2 minutos.${r.commit ? ` <a href="${esc(r.commit)}" target="_blank" rel="noopener">ver alteração</a>` : ''}</p>`;
      return mostrar(dadosLeitura(aviso));
    }
    if (r.status === 401) { senha.gravar(''); return mostrar(telaSenha('Senha incorreta.')); }
    if (r.status === 409) {
      // outra pessoa salvou antes: mostra o que está lá agora, sem sobrescrever
      edicao = { dados: r.dados, sha: r.sha };
      return mostrar(formulario(edicao.dados, 'Alguém salvou estes dados enquanto você editava. O formulário foi recarregado com a versão atual; refaça sua alteração.'));
    }
    // erro de validação: mantém o que foi digitado
    edicao.dados = { ...edicao.dados, ...novos };
    mostrar(formulario(edicao.dados, r.error || 'Não foi possível salvar.'));
  });
}

// ---- páginas -------------------------------------------------------------

const PAGINAS = {
  inicio() {
    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const atalhos = MAPA.itens.filter((f) => f.url && f.status !== 'em-breve' && f.acesso === 'interna');
    const proximos = MAPA.itens.filter((f) => f.secao === 'ferramentas' && f.status === 'em-breve');
    return cabecalho('Início', 'O que importa hoje no Odisse.', hoje) +
      `<section class="bloco"><span class="u-rotulo">Hoje</span>
        <div class="aviso">Quando Contatos e funil, Calendário e Horas existirem, este espaço mostra as pendências do dia:
        contatos a responder, próximos posts e horas da semana.</div></section>
      <section class="bloco"><span class="u-rotulo">Atalhos</span>
        <div class="cartoes compactos">${atalhos.map(cartao).join('')}</div></section>
      <section class="bloco"><span class="u-rotulo">Em construção</span>
        <div class="cartoes compactos">${proximos.map(cartao).join('')}</div></section>`;
  },

  ferramentas() {
    return cabecalho('Ferramentas', 'Onde se trabalha. As internas pedem a própria senha, por enquanto.') + blocosDaSecao('ferramentas');
  },

  canais() {
    const nomes = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', substack: 'Substack' };
    const redes = ODISSE ? Object.entries(ODISSE.redes).map(([id, url]) => cartao({
      nome: nomes[id] || id, url, acesso: 'publica', status: 'no-ar',
      descricao: id === 'substack' ? 'Elaia: ensaios e podcast' : semProtocolo(url).replace(/^[^/]+\//, '').replace(/\/$/, ''),
    })) : [];
    // o grupo "redes" não tem itens no mapa: os endereços vêm do odisse.json, fonte única
    return cabecalho('Canais', 'O que o público vê: sites, redes e publicações. Os endereços das redes vêm dos dados da Marca.') +
      blocosDaSecao('canais') +
      `<section class="bloco"><span class="u-rotulo">Redes e publicações</span>
        <div class="cartoes">${redes.join('') || '<p class="u-apoio">Não foi possível ler os dados da Marca.</p>'}</div></section>`;
  },

  biblioteca() {
    return cabecalho('Biblioteca', 'O que se reutiliza: imagens, referências técnicas, modelos e procedimentos.') + blocosDaSecao('biblioteca');
  },

  marca() {
    const CORES = [['ardosia', 'Ardósia', '#3F4B57'], ['papel', 'Papel', '#FAFAF7'], ['areia', 'Areia', '#E3D9C6'],
      ['nevoa', 'Névoa', '#E6E8EB'], ['grafite', 'Grafite', '#2E3036'], ['pessego', 'Pêssego', '#F2DDBE'],
      ['ocre', 'Ocre', '#BB8248'], ['ambar', 'Âmbar', '#ECC28F'], ['terra', 'Terra', '#4A3726'], ['branco', 'Branco', '#FFFFFF']];
    const LOGOS = [['odisse.svg', 'Logo completo', 0], ['logotipo-odisse.svg', 'Logotipo Odisse', 1], ['logotipo-elaia.svg', 'Logotipo Elaia', 1],
      ['odisse-estudio-01.svg', 'Estúdio 01', 0], ['odisse-estudio-02.svg', 'Estúdio 02', 0], ['odisse-arquitetos-01.svg', 'Arquitetos 01', 0],
      ['odisse-objetos-01.svg', 'Objetos 01', 0], ['odisse-elaia-01.svg', 'Elaia 01', 0], ['odisse-elaia-02.svg', 'Elaia 02', 0]];
    const SELOS = [['mao', 'Mão · Estúdio'], ['roda', 'Roda · Arquitetos'], ['flor', 'Flor · Objetos'], ['sol', 'Sol · Elaia']];

    const peca = (src, nome, mono) => `<div class="peca"><div class="quadro${mono ? ' mono' : ''}" ${mono ? `data-svg="${src}"` : ''}>
      ${mono ? '' : `<img src="${src}" alt="${esc(nome)}" loading="lazy">`}</div>
      <div class="nome"><span>${esc(nome)}</span><a href="${src}" download>baixar</a></div></div>`;

    return cabecalho('Marca', 'Quem somos: identidade e dados institucionais. Todos os sites leem daqui.',
        `<a class="u-botao" href="${MARCA}" target="_blank" rel="noopener">Arquivos públicos ↗</a>`) +
      `<section class="bloco" id="dados-marca">${dadosLeitura()}</section>
      <section class="bloco"><span class="u-rotulo">Cores</span><p class="u-apoio">Clique numa cor para copiar o código.</p>
        <div class="cores">${CORES.map(([id, n, hex]) => `<button class="cor" data-c="${hex}"><span class="amostra" style="background:var(--odisse-${id})"></span>
          <b>${n}</b><small>${hex} · --odisse-${id}</small></button>`).join('')}</div></section>
      <section class="bloco tipo"><span class="u-rotulo">Tipografia</span>
        <div class="g">Arquitetura e design entre memória e potencialidade</div>
        <div class="pesos"><span style="font-weight:300">Leve 300</span><span style="font-weight:400">Regular 400</span>
        <span style="font-weight:500">Médio 500</span><span style="font-weight:600">Seminegrito 600</span><span style="font-weight:700">Negrito 700</span></div></section>
      <section class="bloco"><span class="u-rotulo">Logos</span>
        <div class="pecas">${LOGOS.map(([f, n, m]) => peca(MARCA + 'logos/' + f, n, m)).join('')}</div></section>
      <section class="bloco"><span class="u-rotulo">Selos</span>
        <div class="pecas">${SELOS.map(([f, n]) => peca(MARCA + 'selos/' + f + '.svg', n, 1)).join('')}</div></section>`;
  },
};

function depois(rota) {
  if (rota !== 'marca') return;
  ligarDadosMarca();
  vista.querySelectorAll('[data-svg]').forEach((el) => {
    fetch(el.dataset.svg).then((r) => r.text()).then((svg) => { el.innerHTML = svg; });
  });
  vista.querySelector('.cores')?.addEventListener('click', async (e) => {
    const b = e.target.closest('.cor'); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.c); toque('Copiado: ' + b.dataset.c); } catch { toque(b.dataset.c); }
  });
}

function rota() {
  const id = (location.hash.match(/^#\/([^/?]+)/) || [])[1] || 'inicio';
  return PAGINAS[id] ? id : 'inicio';
}

function mostrar() {
  const r = rota();
  const sec = MAPA.secoes.find((s) => s.id === r);
  document.title = (r === 'inicio' ? 'Universo' : sec.nome + ' — Universo') + ' — Odisse';
  vista.innerHTML = PAGINAS[r]();
  depois(r);
  window.scrollTo(0, 0);
}

carregar().then(() => { mostrar(); window.addEventListener('hashchange', mostrar); })
  .catch(() => { vista.innerHTML = '<p class="u-apoio">Não foi possível carregar o Universo.</p>'; });
