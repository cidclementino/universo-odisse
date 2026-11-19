// Teste da Estrutura de pastas (Biblioteca): validação do arquivo e leitura/gravação no R2.
// Rodar: node --no-warnings worker/testes/pastas.test.mjs
import { validarPastas, lerPastas, gravarPastas, CHAVE } from '../pastas.js';

const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };
const falha = (fn, trecho, msg) => { try { fn(); } catch (e) { return ok(e.message.includes(trecho), `${msg} (${e.message})`); } ok(false, msg); };

const base = () => ({
  versao: 1, retrato_em: '2026-11-19',
  estruturas: [{
    id: 'projeto', nome: 'Template de projeto', caminho: 'Estúdio Odisse / 1. PROJETOS', fonte: 'LEIA-ME', regras: ['Sem acentos.'],
    nomes_sem_acento: true,
    norma: { previstos: 1, f: [{ n: '00-adm', nota: 'Proposta e contrato.', f: [] }] },
    retrato: { a: 3, f: [{ n: '00-adm', a: 0, f: [{ n: 'recebidos', a: 2, f: [] }] }] },
  }, {
    id: 'administracao', nome: 'Administração', caminho: 'Estúdio Odisse / [Administração]', fonte: null, regras: [],
    norma: null, retrato: { a: 0, f: [] },
  }],
});

ok(validarPastas(base()), 'arquivo completo passa (com e sem norma)');
falha(() => validarPastas({ ...base(), versao: 2 }), 'versao: 1', 'versão desconhecida');
falha(() => validarPastas({ ...base(), retrato_em: '19/11/2026' }), 'AAAA-MM-DD', 'data fora do formato');
{ const d = base(); d.estruturas[1].id = 'projeto'; falha(() => validarPastas(d), 'repetida', 'estrutura repetida'); }
{ const d = base(); delete d.estruturas[0].retrato.f[0].a; falha(() => validarPastas(d), 'contagem', 'retrato sem contagem de arquivos'); }
{ const d = base(); d.estruturas[0].retrato.f.push({ n: '00-adm', a: 0, f: [] }); falha(() => validarPastas(d), 'repetida', 'pasta repetida no mesmo nível'); }
{ const d = base(); let no = d.estruturas[0].retrato; for (let i = 0; i < 14; i++) { const f = { n: 'p' + i, a: 0, f: [] }; no.f.push(f); no = f; }
  falha(() => validarPastas(d), 'níveis', 'fundo demais'); }

// R2 de mentira
const guardados = new Map();
const env = { ARQUIVOS: {
  get: async (k) => (guardados.has(k) ? { text: async () => guardados.get(k), uploaded: new Date('2026-11-19T20:00:00Z') } : null),
  put: async (k, v) => { guardados.set(k, v); },
} };
ok((await lerPastas(env)).status === 404, 'sem arquivo: 404');
ok((await gravarPastas(env, '{x')).status === 400, 'JSON quebrado: 400');
ok((await gravarPastas(env, JSON.stringify({ versao: 1 }))).status === 422, 'formato errado: 422, nada gravado');
ok(!guardados.has(CHAVE), 'nada gravado depois dos erros');
const g = await gravarPastas(env, JSON.stringify({ ...base(), guardado_em: 'x' }));
ok(g.status === 200 && g.dados.estruturas.length === 2 && g.dados.guardado_em === '2026-11-19T20:00:00.000Z', 'grava e devolve o que ficou, com a hora');
ok(!JSON.parse(guardados.get(CHAVE)).guardado_em, 'guardado_em não vai para o arquivo');
ok((await lerPastas({})).status === 503, 'sem R2: 503');
