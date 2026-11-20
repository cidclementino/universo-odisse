// Contas das Despesas fixas (Financeiro; Cid, 20/11), sem DOM: usadas pela página (assets/financeiro.js) e pelos
// testes (worker/testes/financeiro.test.mjs).
//
// Regras:
//   * valor de um mês = o último valor guardado com `desde` até aquele mês (antes do primeiro, o primeiro);
//   * dólar vira real pela cotação do dia; a soma que tem dólar é previsão (estimado = true → mostra *);
//   * custo por mês = cada despesa ativa hoje levada ao mês (trimestral ÷ 3, semestral ÷ 6, anual ÷ 12);
//   * previsão do ano = cada despesa no mês em que é paga (mensal todo mês; trimestral a cada 3 meses a partir do
//     mês dela; semestral a cada 6; anual no mês dela), entre o início e o fim, com o valor vigente no mês.
//     Reajustes futuros não são projetados.

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const PASSO = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
export const PERIODICIDADES = [['mensal', 'Mensal'], ['trimestral', 'Trimestral'], ['semestral', 'Semestral'], ['anual', 'Anual']];
export const FORMAS = [['boleto', 'Boleto'], ['debito', 'Débito automático'], ['cartao', 'Cartão'], ['pix', 'Pix'], ['transferencia', 'Transferência']];

const am = (ano, m) => `${ano}-${String(m).padStart(2, '0')}`;

// ---- valores

export function valorNoMes(d, mes) {
  const vs = d.valores?.length ? d.valores : [{ desde: '0000-00', valor: d.valor, moeda: d.moeda }];
  let v = vs[0];
  for (const x of vs) if (x.desde <= mes) v = x;
  return { valor: v.valor, moeda: v.moeda || 'brl' };
}

// centavos na moeda → centavos em real; sem cotação, o dólar não entra (falta = true)
export function emReais(valor, moeda, cot) {
  if (moeda !== 'usd') return { brl: valor, estimado: false, falta: false };
  if (!cot?.valor) return { brl: 0, estimado: true, falta: true };
  return { brl: Math.round(valor * cot.valor), estimado: true, falta: false };
}

// ---- datas

export function ativaNoMes(d, mes) {
  if (d.inicio && mes < d.inicio.slice(0, 7)) return false;
  if (d.fim && mes > d.fim.slice(0, 7)) return false;
  return true;
}
export const encerrada = (d, hoje) => !!d.fim && d.fim < hoje;

// meses do ano (1–12) em que a despesa é paga, sem olhar início e fim
export function mesesDePagamento(d) {
  const p = PASSO[d.periodicidade] || 1;
  if (p === 1) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const base = d.mes || 1;
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((m) => (((m - base) % p) + p) % p === 0);
}

const ultimoDia = (ano, m) => new Date(Date.UTC(ano, m, 0)).getUTCDate();
const diaNoMes = (d, ano, m) => `${am(ano, m)}-${String(Math.min(d.dia || 1, ultimoDia(ano, m))).padStart(2, '0')}`;

// próximo vencimento a partir de hoje (inclusive), dentro da vigência; null se não houver em 24 meses
export function proximoVencimento(d, hoje) {
  const meses = mesesDePagamento(d);
  let ano = +hoje.slice(0, 4);
  let m = +hoje.slice(5, 7);
  for (let i = 0; i < 25; i++) {
    if (meses.includes(m)) {
      const dia = diaNoMes(d, ano, m);
      if (dia >= hoje && (!d.inicio || dia >= d.inicio) && (!d.fim || dia <= d.fim)) return dia;
    }
    m += 1; if (m > 12) { m = 1; ano += 1; }
  }
  return null;
}
export const diasAte = (dia, hoje) => Math.round((Date.parse(dia) - Date.parse(hoje)) / 864e5);

// ---- somas

// custo levado ao mês das despesas ativas hoje, por grupo
export function custoMensal(despesas, cot, hoje) {
  const mes = hoje.slice(0, 7);
  const r = { total: 0, geral: 0, pessoal: 0, estimado: { total: false, geral: false, pessoal: false }, falta: false };
  for (const d of despesas) {
    if (!ativaNoMes(d, mes) || encerrada(d, hoje)) continue;
    const { valor, moeda } = valorNoMes(d, mes);
    const x = emReais(valor, moeda, cot);
    const v = Math.round(x.brl / (PASSO[d.periodicidade] || 1));
    const g = d.grupo === 'pessoal' ? 'pessoal' : 'geral';
    r[g] += v; r.total += v;
    if (x.estimado) { r.estimado[g] = true; r.estimado.total = true; }
    if (x.falta) r.falta = true;
  }
  return r;
}

// uma despesa num mês do ano: { brl, estimado } ou null se não paga naquele mês
export function noMes(d, ano, m, cot) {
  const mes = am(ano, m);
  if (!mesesDePagamento(d).includes(m) || !ativaNoMes(d, mes)) return null;
  const { valor, moeda } = valorNoMes(d, mes);
  return emReais(valor, moeda, cot);
}

// previsão do ano: total por mês e por linha (categoria; o Pessoal numa linha só, a menos que abra por categoria)
export function previsaoAnual(despesas, ano, cot, { pessoalPorCategoria = false } = {}) {
  const novaLinha = (grupo, categoria) => ({ grupo, categoria, meses: Array(12).fill(0), est: Array(12).fill(false), total: 0, estimado: false });
  const linhas = new Map();
  const meses = Array(12).fill(0);
  const est = Array(12).fill(false);
  let falta = false;
  for (const d of despesas) {
    const grupo = d.grupo === 'pessoal' ? 'pessoal' : 'geral';
    const cat = grupo === 'pessoal' && !pessoalPorCategoria ? 'Pessoal' : (d.categoria || 'Sem categoria');
    const k = grupo + '|' + cat;
    for (let m = 1; m <= 12; m++) {
      const x = noMes(d, ano, m, cot);
      if (!x) continue;
      if (!linhas.has(k)) linhas.set(k, novaLinha(grupo, cat));
      const l = linhas.get(k);
      l.meses[m - 1] += x.brl; l.total += x.brl; meses[m - 1] += x.brl;
      if (x.estimado) { l.est[m - 1] = true; l.estimado = true; est[m - 1] = true; }
      if (x.falta) falta = true;
    }
  }
  const ordem = (l) => (l.grupo === 'pessoal' ? 1 : 0);
  const lista = [...linhas.values()].sort((a, b) => ordem(a) - ordem(b) || b.total - a.total || a.categoria.localeCompare(b.categoria, 'pt'));
  const total = meses.reduce((s, v) => s + v, 0);
  return { ano, linhas: lista, meses, est, total, estimado: est.some(Boolean), falta };
}

// ---- entrada de dados

// "1.234,56" · "1234,5" · "1234.56" · "R$ 1.234" · "US$ 20" → centavos (null se não for número)
export function lerValor(texto) {
  let s = String(texto ?? '').replace(/(R\$|US\$|\$|\s)/gi, '');
  if (!s) return null;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{1,2}$/.test(s) && (s.match(/\./g) || []).length === 1) s = s.replace(/,/g, ''); // ponto decimal (1,234.56)
  else s = s.replace(/[.,]/g, '');
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
export const moedaDoTexto = (texto) => (/US\$|USD|\bU\$/i.test(String(texto)) ? 'usd' : null);

// linhas coladas de uma planilha: nome, valor e dia (tab, ponto e vírgula ou vírgula entre as colunas)
export function interpretarColagem(texto) {
  return String(texto).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const c = l.includes('\t') ? l.split('\t') : l.includes(';') ? l.split(';') : [l];
    const cols = c.map((x) => x.trim());
    const nome = cols[0] || '';
    const valorTxt = cols.find((x, i) => i > 0 && lerValor(x) !== null && !/^\d{1,2}$/.test(x)) ?? cols[1] ?? '';
    const valor = lerValor(valorTxt);
    const diaTxt = cols.slice(1).find((x) => x !== valorTxt && /^\d{1,2}$/.test(x));
    const dia = diaTxt ? Number(diaTxt) : null;
    const moeda = moedaDoTexto(valorTxt) || 'brl';
    const ok = !!nome && valor !== null && dia >= 1 && dia <= 31;
    return { nome, valor, dia, moeda, ok };
  });
}

// ---- categoria sugerida pelo nome

const sem = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const CHAVES = {
  geral: [
    ['Espaço', ['aluguel', 'condominio', 'iptu', 'energia', 'luz', 'agua', 'internet', 'telefone', 'limpeza', 'sala', 'cowork']],
    ['Software e assinaturas', ['adobe', 'autodesk', 'archicad', 'graphisoft', 'rhino', 'mcneel', 'v-ray', 'vray', 'chaos', 'enscape', 'lumion', 'sketchup', 'twinmotion', 'blender', 'google', 'workspace', 'microsoft', 'office', 'dropbox', 'cloudflare', 'github', 'figma', 'canva', 'notion', 'dominio', 'registro.br', 'claude', 'anthropic', 'openai', 'chatgpt', 'midjourney', 'hospedagem', 'licenca', 'assinatura', 'software', 'app']],
    ['Contabilidade e taxas', ['contador', 'contabil', 'cau', 'anuidade', 'tarifa', 'banco', 'simples', 'das', 'iss', 'alvara', 'taxa', 'certificado', 'e-cnpj']],
    ['Marketing', ['ads', 'anuncio', 'impulsionamento', 'meta', 'linkedin', 'pinterest', 'marketing']],
    ['Seguros', ['seguro']],
  ],
  pessoal: [
    ['Pró-labore', ['pro-labore', 'pro labore', 'prolabore']],
    ['Encargos', ['inss', 'fgts', 'encargo', 'irrf', 'gps']],
    ['Benefícios', ['vale', 'beneficio', 'plano', 'auxilio']],
    ['Salários', ['salario', 'estagio', 'estagiario', 'folha']],
  ],
};

// 1) mesma primeira palavra de uma despesa já classificada; 2) palavras-chave; 3) nada (null)
export function sugerirCategoria(nome, grupo, despesas = []) {
  const n = sem(nome).trim();
  if (!n) return null;
  const primeira = n.split(/\s+/)[0];
  const parecida = despesas.find((d) => (d.grupo || 'geral') === grupo && d.categoria && sem(d.nome).split(/\s+/)[0] === primeira);
  if (parecida) return parecida.categoria;
  for (const [cat, chaves] of CHAVES[grupo] || []) {
    if (chaves.some((c) => (c.length <= 3 ? new RegExp(`\\b${c}\\b`).test(n) : n.includes(c)))) return cat;
  }
  return null;
}

// ---- formato

export function reais(centavos, { centavosSempre = true } = {}) {
  const v = (centavos || 0) / 100;
  return v.toLocaleString('pt-BR', { minimumFractionDigits: centavosSempre ? 2 : 0, maximumFractionDigits: centavosSempre ? 2 : 0 });
}
export const comMoeda = (centavos, moeda = 'brl') => `${moeda === 'usd' ? 'US$' : 'R$'} ${reais(centavos)}`;
