// Marca: regras puras (sem rede), usadas pelo Worker e pelos testes.
//   aplicar(atual, novo)       -> odisse.json validado (o formulário do hub manda o arquivo inteiro)
//   mudancas(antes, depois)    -> o que mudou, para a mensagem do commit
//   gerarCss(css, dados)       -> marca.css com os valores da paleta, dos papéis e das cores por núcleo
//   validarSvg(texto)          -> o SVG enviado, conferido (ou erro com o motivo)
//   incluirLogo(dados, pedido) -> { dados, caminho } com a peça nova ou substituída
//
// Princípios: ids de núcleo e de cor nunca mudam (os sites e o CSS dependem deles); campos que o
// formulário não conhece são preservados; textos que se traduzem têm a versão `_en` ao lado.

export const txt = (v, max, obrig = false, nome = 'campo') => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (obrig && !s) throw new Error(`${nome}: obrigatório`);
  if (s.length > max) throw new Error(`${nome}: no máximo ${max} caracteres`);
  return s;
};

export const link = (v, nome) => {
  const s = txt(v, 300, false, nome);
  if (s && !/^https:\/\/[^\s/$.?#][^\s]*$/i.test(s)) throw new Error(`${nome}: precisa começar com https://`);
  return s;
};

const hex = (v, nome) => {
  const s = String(v ?? '').trim().toUpperCase();
  const curto = s.match(/^#([0-9A-F])([0-9A-F])([0-9A-F])$/);
  if (curto) return '#' + curto.slice(1).map((c) => c + c).join('');
  if (!/^#[0-9A-F]{6}$/.test(s)) throw new Error(`${nome}: use o código da cor, ex. #3F4B57`);
  return s;
};

export function hojeBrasilia(agora = Date.now()) {
  return new Date(agora - 3 * 3600e3).toISOString().slice(0, 10);
}

export function aplicar(atual, novo, hoje = hojeBrasilia()) {
  const d = structuredClone(atual);
  d.nome = txt(novo.nome ?? d.nome, 60, true, 'Nome');
  d.nome_completo = txt(novo.nome_completo ?? d.nome_completo, 120, true, 'Nome completo');
  d.nome_completo_en = txt(novo.nome_completo_en ?? d.nome_completo_en, 120, false, 'Nome completo (inglês)');
  d.descricao = txt(novo.descricao ?? d.descricao, 400, true, 'Descrição');
  d.descricao_en = txt(novo.descricao_en ?? d.descricao_en, 400, false, 'Descrição (inglês)');

  const fundVindos = novo.fundadores ?? d.fundadores;
  const fund = (Array.isArray(fundVindos) ? fundVindos : String(fundVindos || '').split(/\n|,/))
    .map((f) => txt(f, 80, false, 'Fundadores')).filter(Boolean);
  if (!fund.length) throw new Error('Fundadores: informe ao menos um nome');
  d.fundadores = fund;

  const c = novo.contato || d.contato || {};
  const email = txt(c.email, 120, true, 'E-mail');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail: endereço inválido');
  const telefone = txt(c.telefone, 40, true, 'Telefone');
  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 15) throw new Error('Telefone: número incompleto (use +55 DDD número)');
  // WhatsApp sai do telefone: um número só, sem chance de ficarem diferentes
  d.contato = { ...d.contato, email, telefone, whatsapp: digitos, whatsapp_link: 'https://wa.me/' + digitos };

  const e = novo.endereco || d.endereco || {};
  d.endereco = {
    ...d.endereco,
    logradouro: txt(e.logradouro, 160, true, 'Logradouro'),
    bairro: txt(e.bairro, 80, true, 'Bairro'),
    cidade: txt(e.cidade, 80, true, 'Cidade'),
    uf: txt(e.uf, 2, true, 'UF').toUpperCase(),
    cep: txt(e.cep, 12, true, 'CEP'),
    caixa_postal: txt(e.caixa_postal, 20, false, 'Caixa postal'),
  };

  for (const grupo of ['redes', 'sites']) {
    const vindo = novo[grupo] || d[grupo] || {};
    d[grupo] = { ...d[grupo] };
    for (const k of Object.keys(d[grupo])) d[grupo][k] = link(vindo[k], `${grupo}.${k}`);
  }

  // paleta: id e nome fixos (viram variáveis do CSS); valor, função e "principal" mudam
  if (Array.isArray(d.paleta)) {
    const vindas = Object.fromEntries((novo.paleta || []).map((p) => [p.id, p]));
    d.paleta = d.paleta.map((p) => {
      const v = vindas[p.id] || p;
      return {
        ...p,
        valor: hex(v.valor ?? p.valor, `Cor ${p.nome}`),
        principal: !!(v.principal ?? p.principal),
        funcao: txt(v.funcao ?? p.funcao, 160, false, `Função de ${p.nome}`),
        funcao_en: txt(v.funcao_en ?? p.funcao_en, 160, false, `Função de ${p.nome} (inglês)`),
      };
    });
  }
  const ids = new Set((d.paleta || []).map((p) => p.id));
  const corDaPaleta = (v, padrao, nome) => {
    const id = String(v ?? padrao ?? '');
    if (ids.size && !ids.has(id)) throw new Error(`${nome}: escolha uma cor da paleta`);
    return id;
  };

  if (d.papeis) {
    const vindos = novo.papeis || {};
    d.papeis = Object.fromEntries(Object.entries(d.papeis).map(([k, v]) => [k, corDaPaleta(vindos[k], v, `Papel ${k}`)]));
  }

  // núcleos: ids e siglas fixos (os sites e os códigos dependem deles)
  const vindos = Object.fromEntries((novo.nucleos || []).map((n) => [n.id, n]));
  d.nucleos = d.nucleos.map((n) => {
    const v = vindos[n.id] || n;
    const out = {
      ...n,
      nome: txt(v.nome ?? n.nome, 60, true, `Núcleo ${n.id}`),
      conteudo: txt(v.conteudo ?? n.conteudo, 120, false, `Conteúdo de ${n.nome}`),
    };
    if ('conteudo_en' in n || 'conteudo_en' in v) out.conteudo_en = txt(v.conteudo_en ?? n.conteudo_en, 120, false, `Conteúdo de ${n.nome} (inglês)`);
    if (n.cores) {
      const vc = v.cores || {};
      out.cores = Object.fromEntries(Object.entries(n.cores).map(([k, id]) => [k, corDaPaleta(vc[k], id, `${n.nome}: ${({ fundo: 'fundo', painel: 'painel', veu: 'véu' })[k] || k}`)]));
    }
    if (n.selo) {
      const vs = v.selo || {};
      out.selo = {
        ...n.selo,
        uso: txt(vs.uso ?? n.selo.uso, 160, false, `Uso do selo ${n.selo.nome}`),
        uso_en: txt(vs.uso_en ?? n.selo.uso_en, 160, false, `Uso do selo ${n.selo.nome} (inglês)`),
      };
    }
    return out; // logos só mudam pelo envio de arquivo (incluirLogo)
  });

  d.atualizado = hoje;
  return d;
}

export function mudancas(antes, depois) {
  const out = [];
  const nomes = { nome: 'nome', nome_completo: 'nome completo', nome_completo_en: 'nome em inglês', descricao: 'descrição',
    descricao_en: 'descrição em inglês', fundadores: 'fundadores', contato: 'contato', endereco: 'endereço',
    redes: 'redes', sites: 'sites', nucleos: 'núcleos', paleta: 'paleta', papeis: 'papéis das cores' };
  for (const [k, n] of Object.entries(nomes)) if (JSON.stringify(antes[k]) !== JSON.stringify(depois[k])) out.push(n);
  return out;
}

// O CSS não é refeito: só os valores das linhas conhecidas mudam, o resto do arquivo fica igual.
export function gerarCss(css, dados) {
  let s = css;
  for (const p of dados.paleta || []) {
    s = s.replace(new RegExp(`(--odisse-${p.id}:\\s*)#[0-9A-Fa-f]{3,8}(\\s*;)`), `$1${p.valor}$2`);
  }
  const papel = { fundo: 'fundo', tinta: 'tinta', tinta_sobre_escuro: 'tinta-sobre-escuro' };
  for (const [k, id] of Object.entries(dados.papeis || {})) {
    if (!papel[k]) continue;
    s = s.replace(new RegExp(`(--odisse-${papel[k]}:\\s*)var\\(--odisse-[a-z]+\\)(\\s*;)`), `$1var(--odisse-${id})$2`);
  }
  for (const n of dados.nucleos || []) {
    for (const [k, id] of Object.entries(n.cores || {})) {
      s = s.replace(new RegExp(`(--odisse-${n.id}-${k}:\\s*)var\\(--odisse-[a-z]+\\)(\\s*;)`), `$1var(--odisse-${id})$2`);
    }
  }
  return s;
}

// ---- SVG ------------------------------------------------------------------
// Só desenho: nada que rode código, busque coisas fora ou embuta imagens.

export const SVG_MAX = 512 * 1024;

export function validarSvg(texto) {
  let s = String(texto ?? '');
  if (!s.trim()) throw new Error('arquivo vazio');
  if (s.length > SVG_MAX) throw new Error('arquivo grande demais (máximo 512 KB)');
  if (/<!DOCTYPE|<!ENTITY/i.test(s)) throw new Error('o SVG tem declarações (DOCTYPE/ENTITY); exporte de novo sem elas');
  s = s.replace(/^﻿/, '').replace(/<\?xml[^>]*\?>/gi, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  if (!/^<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s)) throw new Error('não parece um SVG');
  const proibidos = [
    [/<script/i, 'scripts'],
    [/<foreignObject/i, 'foreignObject'],
    [/<(image|iframe|object|embed|audio|video)[\s>/]/i, 'imagens ou mídias embutidas'],
    [/\son[a-z]+\s*=/i, 'eventos (onclick etc.)'],
    [/javascript:/i, 'links javascript:'],
    [/(xlink:)?href\s*=\s*["']\s*(?!#)/i, 'links para fora do arquivo'],
    [/@import/i, '@import'],
    [/url\(\s*["']?\s*(?!#)/i, 'url() para fora do arquivo'],
  ];
  for (const [re, nome] of proibidos) if (re.test(s)) throw new Error(`o SVG tem ${nome}; só desenho é aceito`);
  if (!/viewBox\s*=/i.test(s) && !(/\swidth\s*=/i.test(s) && /\sheight\s*=/i.test(s))) throw new Error('o SVG precisa de viewBox');
  return s + '\n';
}

// SVG de uma cor: desenha em currentColor (ou não define cor nenhuma).
export function ehMono(svg) {
  const cores = coresDoSvg(svg);
  return /currentColor/i.test(svg) && cores.length === 0;
}

export function coresDoSvg(svg) {
  const achadas = new Set();
  for (const m of String(svg).matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b(?![\w-])/gi)) {
    let h = m[1].toUpperCase();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    achadas.add('#' + h);
  }
  return [...achadas];
}

// pedido: { nucleo, modo: 'novo'|'substituir', alvo?, nome? }
export function incluirLogo(atual, pedido, svg, hoje = hojeBrasilia()) {
  const d = structuredClone(atual);
  const n = d.nucleos.find((x) => x.id === pedido.nucleo);
  if (!n) throw new Error('núcleo desconhecido');
  n.logos = n.logos || [];
  const mono = ehMono(svg);

  if (pedido.modo === 'substituir') {
    const alvo = String(pedido.alvo || '');
    const peca = n.logos.find((l) => l.arquivo === alvo);
    const ehSelo = n.selo?.arquivo === alvo;
    if (!peca && !ehSelo) throw new Error('escolha uma peça deste núcleo para substituir');
    if (ehSelo && !mono) throw new Error('o selo precisa ser de uma cor só (currentColor)');
    if (peca) {
      if (mono) peca.mono = true; else delete peca.mono;
      if (pedido.nome) peca.nome = txt(pedido.nome, 60, true, 'Nome da peça');
    }
    d.atualizado = hoje;
    return { dados: d, caminho: alvo, nome: peca ? peca.nome : `Selo ${n.selo.nome}` };
  }

  if (pedido.modo !== 'novo') throw new Error('modo desconhecido');
  const usados = new Set(d.nucleos.flatMap((x) => (x.logos || []).map((l) => l.arquivo)));
  let i = 1, caminho;
  do { caminho = `logos/odisse-${n.id}-${String(i).padStart(2, '0')}.svg`; i++; } while (usados.has(caminho));
  // nome de exibição: o próximo número da série do núcleo (Estúdio 03, Elaia 03…)
  const prefixo = n.marca_mae ? 'Estúdio' : n.nome.replace(/^Odisse /, '');
  const nums = n.logos.map((l) => +((l.nome.match(/(\d+)\s*$/) || [])[1] || 0));
  const prox = String(Math.max(0, ...nums) + 1).padStart(2, '0');
  const nome = txt(pedido.nome || `${prefixo} ${prox}`, 60, true, 'Nome da peça');
  n.logos.push(mono ? { nome, arquivo: caminho, mono: true } : { nome, arquivo: caminho });
  d.atualizado = hoje;
  return { dados: d, caminho, nome };
}
