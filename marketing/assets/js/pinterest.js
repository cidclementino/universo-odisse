// Pinterest: pastas, campos de cada pin, link com UTMs e o textos.txt do lote.
// Regras de odisse-estrategia-pinterest.pdf (nov. 2026): pastas (03), títulos e descrições (05),
// destino de cada pin (06) e fluxo de arquivos (07).

import * as local from './store.js';
import * as nuvem from './nuvem.js';

export const LIMITE = { titulo: 100, descricao: 500, alt: 500 };

/** Grupos de pastas, na ordem do perfil: Arquitetos, Objetos, Elaia, Estúdio e as comuns a todos. */
export const GRUPOS_PASTA = [
  ['arquitetos', 'Arquitetos'],
  ['objetos', 'Objetos'],
  ['elaia', 'Elaia'],
  ['estudio', 'Estúdio'],
  ['todos', 'Todos os núcleos'],
];

/** Pastas iniciais (seção 03). Seguem o que as pessoas buscam, não os nomes dos projetos. */
export const PASTAS_PADRAO = [
  { id: 'pa-residencial', grupo: 'arquitetos', nome: 'Residencial', desc: 'Casas e apartamentos, fachada e implantação' },
  { id: 'pa-interiores', grupo: 'arquitetos', nome: 'Interiores', desc: 'Ambientes, marcenaria, cor e acabamentos' },
  { id: 'pa-retrofit', grupo: 'arquitetos', nome: 'Retrofit e brutalismo', desc: 'Intervenções em edifícios existentes (Edifício AVS)' },
  { id: 'pa-elementos', grupo: 'arquitetos', nome: 'Elementos e fachadas', desc: 'Cobogós, vazados, brises, materiais (Lórica Urbana)' },
  { id: 'pa-instalacoes', grupo: 'arquitetos', nome: 'Instalações e mostras', desc: 'Domo Rubro, CASACOR Paraíba' },
  { id: 'pa-desenho', grupo: 'arquitetos', nome: 'Desenho e processo', desc: 'Renders, croquis, maquetes e diagramas' },
  { id: 'po-vortice', grupo: 'objetos', nome: 'Vórtice', desc: 'Linha de produto. Fotos de estúdio e de ambiente; cada pin leva à página de compra' },
  { id: 'pe-ensaios', grupo: 'elaia', nome: 'Ensaios', desc: 'Um pin por artigo, levando ao Substack' },
  { id: 'pe-materia-bruta', grupo: 'elaia', nome: 'Matéria Bruta', desc: 'Um pin por episódio, após o lançamento do podcast' },
  { id: 'ps-obra', grupo: 'estudio', nome: 'Obra e bastidores', desc: 'Registros de obra; rende menos em busca e fica em segundo plano' },
  { id: 'pt-imprensa', grupo: 'todos', nome: 'Odisse na imprensa', desc: 'Matérias no ArchDaily, Designboom, Architizer, Divisare, Dezeen e revistas' },
];

/** Créditos que fecham a descrição de cada pin (seção 05). Editáveis na publicação. */
export const CREDITOS = {
  arquitetos: { pt: 'Projeto: Odisse Arquitetos.', en: 'Design: Odisse Arquitetos.' },
  objetos: { pt: 'Design: Odisse Objetos.', en: 'Design: Odisse Objetos.' },
  elaia: { pt: 'Texto: Elaia, por Odisse.', en: 'Text: Elaia, by Odisse.' },
  estudio: { pt: 'Odisse, Estúdio de Arquitetura & Design.', en: 'Odisse, Architecture & Design Studio.' },
};

/** Exemplos (seção 05) usados como dica nos campos. */
export const EXEMPLO = {
  titulo: 'Cobogó cerâmico autoral em fachada residencial — João Pessoa',
  descricao: 'Elementos vazados Lórica Urbana, desenvolvidos pelo Odisse com a Elementov Céramique para a Residência DCMC. Ventilação, sombra e textura na arquitetura do Nordeste.',
};

/** Domínios reivindicados no perfil (seção 02): links fora deles recebem aviso. */
export const DOMINIOS = ['odisse.com.br', 'projetos.odisse.com.br', 'odisseobjetos.com', 'odisse.substack.com'];

// ---------------------------------------------------------------------------
// Pastas: dado editável, guardado no navegador e na nuvem (/api/config/pin-pastas)

const CHAVE = 'pin-pastas';
let pastas = null;

export const listaPastas = () => pastas || PASTAS_PADRAO;
export const pastaDe = (id) => listaPastas().find((p) => p.id === id) || null;
/** Primeira pasta do núcleo (padrão de um pin novo). */
export const pastaPadrao = (nucleoId) => listaPastas().find((p) => p.grupo === nucleoId)?.id || '';

/** Lê as pastas: na hora a cópia do navegador; a da nuvem chega por baixo (devolve true se mudou). */
export async function carregarPastas() {
  if (!pastas) pastas = (await local.lerMeta(CHAVE)) || null;
  try {
    const remoto = await nuvem.lerConfig(CHAVE);
    if (Array.isArray(remoto) && JSON.stringify(remoto) !== JSON.stringify(pastas)) {
      pastas = remoto;
      await local.gravarMeta(CHAVE, pastas);
      return true;
    }
  } catch (e) { console.warn('[pinterest] pastas da nuvem', e); }
  return false;
}

let timerPastas;
export function gravarPastas(lista) {
  pastas = lista;
  local.gravarMeta(CHAVE, pastas);
  clearTimeout(timerPastas);
  return new Promise((ok) => {
    timerPastas = setTimeout(() => nuvem.gravarConfig(CHAVE, pastas).then(() => ok(true), () => ok(false)), 600);
  });
}

// ---------------------------------------------------------------------------
// Campos do pin

export function pinVazio(nucleoId) {
  return { titulo: '', descricao: '', alt: '', pasta: pastaPadrao(nucleoId), link: '', idioma: 'pt', tipo: 'imagem' };
}

const texto = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Descrição como sai no Pinterest: o texto do pin seguido dos créditos da publicação. */
export function descricaoFinal(pin, globais) {
  const cred = pin.idioma === 'en' ? (globais.creditosEn ?? '') : (globais.creditos ?? '');
  return [texto(pin.descricao), texto(cred)].filter(Boolean).join(' ');
}

/** Avisos de um campo (não impedem a exportação). */
export function avisosDe(campo, pin, globais) {
  const av = [];
  if (campo === 'titulo') {
    const t = texto(pin.titulo);
    if (!t) av.push('Sem título: o termo de busca primeiro, depois o lugar.');
    if (t.length > LIMITE.titulo) av.push(`Passa de ${LIMITE.titulo} caracteres.`);
    if (/[^.]\.$/.test(t)) av.push('Sem ponto final: no Pinterest o título funciona como rótulo de busca.');
  }
  if (campo === 'descricao') {
    const d = descricaoFinal(pin, globais);
    if (!texto(pin.descricao)) av.push('Sem descrição: o que a imagem mostra e de qual projeto, peça ou texto.');
    if (d.length > LIMITE.descricao) av.push(`Com os créditos, passa de ${LIMITE.descricao} caracteres.`);
  }
  if (campo === 'alt' && texto(pin.alt).length > LIMITE.alt) av.push(`Passa de ${LIMITE.alt} caracteres.`);
  if (campo === 'link') av.push(...avisosDoLink(pin.link || globais.link));
  if (campo === 'pasta' && !pastaDe(pin.pasta)) av.push('Escolha a pasta do pin.');
  return av;
}

function urlDe(base) {
  const b = String(base || '').trim();
  if (!b) return null;
  try { return new URL(/^https?:\/\//i.test(b) ? b : `https://${b}`); } catch { return null; }
}

export function avisosDoLink(base) {
  const u = urlDe(base);
  if (!String(base || '').trim()) return ['Sem link: cada pin leva a uma página específica (projeto, produto ou artigo).'];
  if (!u || !u.hostname.includes('.')) return ['Link inválido.'];
  const av = [];
  if (u.pathname.replace(/\/+$/, '') === '' && !u.search) av.push('É a página inicial: o pin deve levar à página do projeto, da peça ou do texto.');
  const host = u.hostname.replace(/^www\./, '');
  if (!DOMINIOS.some((d) => host === d || host.endsWith('.' + d))) av.push('Fora dos domínios reivindicados do Odisse.');
  return av;
}

const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Link final do pin, com as UTMs (seção 02, rastreamento):
 * utm_source=pinterest · utm_medium=social · utm_campaign=<núcleo>-<projeto> ·
 * utm_content=<código do pin, ex.: 251117-003-oa> · utm_term=<pasta>.
 * Parâmetros que já estiverem no link são mantidos; as UTMs são sempre reescritas.
 */
export function linkFinal(pin, globais, { sigla, projeto, codigo }) {
  const u = urlDe(pin.link || globais.link);
  if (!u) return '';
  const pasta = pastaDe(pin.pasta);
  const params = {
    utm_source: 'pinterest',
    utm_medium: 'social',
    utm_campaign: [sigla, slug(projeto)].filter(Boolean).join('-'),
    utm_content: codigo + (pin.idioma === 'en' ? '-en' : ''),
    utm_term: pasta ? slug(pasta.nome) : '',
  };
  for (const [k, v] of Object.entries(params)) {
    if (v) u.searchParams.set(k, v);
    else u.searchParams.delete(k);
  }
  return u.toString();
}

// ---------------------------------------------------------------------------
// textos.txt do lote (seção 07): título, descrição, pasta e link de cada pin

const IDIOMA = { pt: 'Português', en: 'Inglês' };
const TIPO = { imagem: 'Imagem', video: 'Capa de pin de vídeo (subir com o master limpo do vídeo)' };

export function textosDoLote({ projeto, nucleo, pins }) {
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const linhas = [
    `Pinterest · ${projeto}`,
    `${nucleo} · ${pins.length} ${pins.length === 1 ? 'pin' : 'pins'} · exportado em ${agora}`,
    '',
  ];
  for (const p of pins) {
    linhas.push(
      '----------------------------------------------------------------',
      `${p.numero} · ${p.arquivo}`,
      ...(p.dia ? [`Dia: ${new Date(`${p.dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`] : []),
      `Pasta: ${p.pasta || '—'}`,
      `Título: ${p.titulo || '—'}`,
      `Descrição: ${p.descricao || '—'}`,
      `Texto alternativo: ${p.alt || '—'}`,
      `Link: ${p.link || '—'}`,
      `Idioma: ${IDIOMA[p.idioma] || p.idioma}`,
      `Tipo: ${TIPO[p.tipo] || p.tipo}`,
    );
    if (p.avisos.length) linhas.push(`Avisos: ${p.avisos.join(' ')}`);
    linhas.push('');
  }
  return linhas.join('\r\n');
}
