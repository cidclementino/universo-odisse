// Utilidades da API de dados: ids, datas, normalização e validação de campos.

// ---- ids: prefixo + ULID (26 caracteres, ordenável pelo tempo) -------------
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function ulid(agora = Date.now()) {
  let t = '';
  let n = agora;
  for (let i = 0; i < 10; i++) { t = CROCKFORD[n % 32] + t; n = Math.floor(n / 32); }
  const r = crypto.getRandomValues(new Uint8Array(16));
  let a = '';
  for (let i = 0; i < 16; i++) a += CROCKFORD[r[i] % 32];
  return t + a;
}
export const novoId = (prefixo) => `${prefixo}_${ulid()}`;
export const prefixoDe = (id) => (typeof id === 'string' && /^[a-z]{3}_/.test(id) ? id.slice(0, 3) : null);

// ---- tempo ------------------------------------------------------------------
export const agoraISO = () => new Date().toISOString();
// dia de hoje em Brasília (UTC-3, sem horário de verão desde 2019)
export const hojeBrasilia = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

// ---- normalização (como o normalize.js do Radar) -----------------------------
export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}
export const digitos = (s) => String(s ?? '').replace(/\D/g, '');

// ---- validação ----------------------------------------------------------------
// Cada campo do esquema tem um tipo. `limpar` devolve o valor pronto para gravar
// (null quando vazio: ausência = nulo) ou lança Error com mensagem para a pessoa.

const vazio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

const TIPOS = {
  texto: (v, c) => {
    const s = String(v).replace(/\s+/g, ' ').trim();
    if (s.length > (c.max || 200)) throw new Error(`no máximo ${c.max || 200} caracteres`);
    return s;
  },
  textoLongo: (v, c) => {
    const s = String(v).replace(/\r\n/g, '\n').trim();
    if (s.length > (c.max || 20000)) throw new Error(`no máximo ${c.max || 20000} caracteres`);
    return s;
  },
  email: (v) => {
    const s = String(v).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.length > 160) throw new Error('e-mail inválido');
    return s;
  },
  telefone: (v) => {
    let d = digitos(v);
    if (d.length === 10 || d.length === 11) d = '55' + d; // sem DDI: Brasil
    if (d.length < 12 || d.length > 15) throw new Error('telefone incompleto (DDD + número)');
    return d;
  },
  cnpj: (v) => {
    const d = digitos(v);
    if (d.length !== 14) throw new Error('CNPJ precisa de 14 dígitos');
    return d;
  },
  cpf: (v) => {
    const d = digitos(v);
    if (d.length !== 11) throw new Error('CPF precisa de 11 dígitos');
    return d;
  },
  cep: (v) => {
    const d = digitos(v);
    if (d.length !== 8) throw new Error('CEP precisa de 8 dígitos');
    return d;
  },
  uf: (v) => {
    const s = String(v).trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(s)) throw new Error('UF com 2 letras');
    return s;
  },
  data: (v) => {
    const s = String(v).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new Error('data no formato AAAA-MM-DD');
    return s;
  },
  instante: (v) => {
    const s = String(v).trim();
    if (Number.isNaN(Date.parse(s))) throw new Error('data e hora inválidas');
    return new Date(s).toISOString();
  },
  inteiro: (v, c) => {
    const n = Number(v);
    if (!Number.isInteger(n)) throw new Error('número inteiro');
    if (c.min !== undefined && n < c.min) throw new Error(`no mínimo ${c.min}`);
    if (c.max !== undefined && n > c.max) throw new Error(`no máximo ${c.max}`);
    return n;
  },
  real: (v, c) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error('número');
    if (c.min !== undefined && n < c.min) throw new Error(`no mínimo ${c.min}`);
    if (c.max !== undefined && n > c.max) throw new Error(`no máximo ${c.max}`);
    return n;
  },
  centavos: (v) => {
    const n = Number(v);
    if (!Number.isInteger(n)) throw new Error('valor em centavos (inteiro)');
    return n;
  },
  sn: (v) => {
    if (v === true || v === 1 || v === '1' || v === 'sim') return 1;
    if (v === false || v === 0 || v === '0' || v === 'nao') return 0;
    throw new Error('sim ou não');
  },
  lista: (v, c) => {
    const s = String(v).trim();
    if (!c.valores.includes(s)) throw new Error(`um destes: ${c.valores.join(', ')}`);
    return s;
  },
  url: (v) => {
    const s = String(v).trim();
    if (!/^https:\/\/[^\s/$.?#][^\s]*$/i.test(s) || s.length > 300) throw new Error('endereço precisa começar com https://');
    return s;
  },
  arroba: (v) => {
    const s = String(v).trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');
    if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) throw new Error('usuário do Instagram inválido');
    return s.toLowerCase();
  },
  // JSON guardado como texto; aceita objeto ou texto já serializado
  json: (v, c) => {
    let s;
    if (typeof v === 'string') {
      try { JSON.parse(v); } catch { throw new Error('JSON inválido'); }
      s = v;
    } else {
      s = JSON.stringify(v);
    }
    if (s.length > (c.max || 100000)) throw new Error(`grande demais (máximo ${c.max || 100000} caracteres)`);
    return s;
  },
  ref: (v, c) => {
    const s = String(v).trim();
    if (!c.prefixos.includes(prefixoDe(s))) throw new Error(`precisa ser um id de: ${c.prefixos.join(', ')}`);
    return s;
  },
};

export function limpar(campo, valor, def) {
  if (vazio(valor)) {
    if (def.obrig) throw new Error(`${def.rotulo || campo}: obrigatório`);
    return null;
  }
  try {
    return TIPOS[def.tipo](valor, def);
  } catch (e) {
    throw new Error(`${def.rotulo || campo}: ${e.message}`);
  }
}
