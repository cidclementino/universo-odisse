// Teste das regras da Marca (worker/marca.js) sobre o odisse.json e o marca.css de verdade.
// Rodar: node --no-warnings worker/testes/marca.test.mjs [caminho do marca-odisse]
// Sem caminho, procura ../marca-odisse ao lado deste repositório; se não houver (GitHub Actions),
// lê os arquivos do repositório marca-odisse no GitHub.
import fs from 'node:fs';
import path from 'node:path';
import { aplicar, mudancas, gerarCss, validarSvg, incluirLogo, ehMono, coresDoSvg } from '../marca.js';

const RAIZ = process.argv[2] || path.resolve(decodeURIComponent(new URL('../../../marca-odisse', import.meta.url).pathname));
const LOCAL = fs.existsSync(path.join(RAIZ, 'odisse.json'));
const ler = async (rel) => {
  if (LOCAL) return fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const r = await fetch('https://raw.githubusercontent.com/cidclementino/marca-odisse/main/' + rel);
  if (!r.ok) throw new Error(`não achei ${rel} (${r.status})`);
  return r.text();
};
console.log('marca-odisse:', LOCAL ? RAIZ : 'GitHub');
const dados = JSON.parse(await ler('odisse.json'));
const css = await ler('v1/marca.css');
const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };
const falha = (fn, trecho, msg) => {
  try { fn(); } catch (e) { ok(!trecho || e.message.includes(trecho), `${msg} (${e.message})`); return; }
  throw new Error('FALHOU (não deu erro): ' + msg);
};

// ---- o arquivo como está
ok(dados.nucleos.filter((n) => n.marca_mae).map((n) => n.id).join() === 'estudio', 'Estúdio é a marca-mãe');
ok(dados.nucleos.map((n) => n.sigla).join() === 'OE,OA,OO,EL', 'siglas OE, OA, OO, EL');
ok(dados.nucleos.map((n) => n.selo.nome).join() === 'Mão,Roda,Flor,Sol', 'selos com os nomes do manual');
const svgs = {};
for (const n of dados.nucleos) for (const l of [...n.logos, n.selo]) { svgs[l.arquivo] = await ler(l.arquivo); ok(svgs[l.arquivo].includes('<svg'), `existe ${l.arquivo}`); }
ok(dados.paleta.find((p) => p.id === 'ambar').funcao === 'Luz do duotone da Elaia', 'âmbar com a função do manual');
ok(gerarCss(css, dados) === css, 'CSS já bate com o odisse.json (nada a reescrever)');
ok(ehMono(svgs['logos/logotipo-odisse.svg']), 'logotipo é de uma cor');
ok(!ehMono(svgs['logos/odisse-elaia-01.svg']), 'Elaia 01 tem cores próprias');
for (const t of Object.values(svgs)) validarSvg(t);
ok(true, 'todos os SVGs da marca passam na conferência');

// ---- aplicar: o arquivo inteiro de volta não muda nada
const igual = aplicar(dados, structuredClone(dados), dados.atualizado);
ok(mudancas(dados, igual).length === 0, 'reenviar igual não muda nada');
ok(JSON.stringify(igual) === JSON.stringify(dados), 'reenviar igual preserva o arquivo byte a byte');

// formulário antigo (sem paleta nem campos novos) não apaga nada
const antigo = structuredClone(dados);
delete antigo.paleta; delete antigo.papeis;
antigo.nucleos = antigo.nucleos.map(({ id, nome, conteudo }) => ({ id, nome, conteudo }));
const r0 = aplicar(dados, antigo, dados.atualizado);
ok(JSON.stringify(r0) === JSON.stringify(dados), 'formulário antigo preserva paleta, cores, selos e logos');

// paleta e cores
const m = structuredClone(dados);
m.paleta.find((p) => p.id === 'ambar').valor = '#eec390';
m.paleta.find((p) => p.id === 'ambar').funcao_en = 'Light of the Elaia duotone';
m.nucleos.find((n) => n.id === 'elaia').cores.painel = 'ambar';
m.nucleos.find((n) => n.id === 'elaia').conteudo_en = 'Essays and podcast';
m.papeis.fundo = 'nevoa';
m.paleta.find((p) => p.id === 'ardosia').nome = 'Outro nome';
m.nucleos[0].sigla = 'XX';
const r1 = aplicar(dados, m, '2026-11-14');
ok(r1.paleta.find((p) => p.id === 'ambar').valor === '#EEC390', 'valor da cor em maiúsculas');
ok(r1.paleta.find((p) => p.id === 'ardosia').nome === 'Ardósia', 'nome da cor não muda');
ok(r1.nucleos[0].sigla === 'OE', 'sigla não muda');
ok(mudancas(dados, r1).join() === 'núcleos,paleta,papéis das cores', 'mudanças: ' + mudancas(dados, r1).join());
const css1 = gerarCss(css, r1);
ok(css1.includes('--odisse-ambar:   #EEC390;'), 'CSS: valor novo do âmbar');
ok(css1.includes('--odisse-elaia-painel:     var(--odisse-ambar);'), 'CSS: painel da Elaia');
ok(css1.includes('--odisse-fundo: var(--odisse-nevoa);'), 'CSS: papel de fundo');
ok(css1.split('\n').length === css.split('\n').length, 'CSS: mesma estrutura');

const ruim = structuredClone(dados);
ruim.paleta[0].valor = 'azul';
falha(() => aplicar(dados, ruim), 'código da cor', 'cor inválida recusada');
const ruim2 = structuredClone(dados);
ruim2.nucleos[1].cores.veu = 'roxo';
falha(() => aplicar(dados, ruim2), 'paleta', 'cor de núcleo fora da paleta recusada');

// ---- SVG
falha(() => validarSvg('<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>'), 'scripts', 'script recusado');
falha(() => validarSvg('<svg viewBox="0 0 1 1" onload="x()"></svg>'), 'eventos', 'evento recusado');
falha(() => validarSvg('<svg viewBox="0 0 1 1"><image href="https://x/y.png"/></svg>'), 'imagens', 'imagem embutida recusada');
falha(() => validarSvg('<svg viewBox="0 0 1 1"><use href="https://x/y.svg#a"/></svg>'), 'links', 'link externo recusado');
falha(() => validarSvg('<html></html>'), 'SVG', 'não-SVG recusado');
ok(validarSvg('<?xml version="1.0"?><!-- ai --><svg viewBox="0 0 1 1"><use href="#a"/><path fill="url(#g)"/></svg>').startsWith('<svg'), 'referências internas aceitas, cabeçalho limpo');
ok(coresDoSvg('<svg fill="#4a5864"><path fill="#FFF"/></svg>').join() === '#4A5864,#FFFFFF', 'cores do SVG lidas');

// ---- logos
const mono = '<svg viewBox="0 0 10 10" fill="currentColor"><path d="M0 0h10v10z"/></svg>\n';
const cor = '<svg viewBox="0 0 10 10"><path fill="#3F4B57" d="M0 0h10v10z"/></svg>\n';
const n1 = incluirLogo(dados, { nucleo: 'elaia', modo: 'novo' }, cor, '2026-11-14');
ok(n1.caminho === 'logos/odisse-elaia-03.svg' && n1.nome === 'Elaia 03', `novo na Elaia: ${n1.caminho} · ${n1.nome}`);
const n2 = incluirLogo(dados, { nucleo: 'estudio', modo: 'novo' }, mono, '2026-11-14');
ok(n2.caminho === 'logos/odisse-estudio-01.svg' && n2.nome === 'Estúdio 03', `novo no Estúdio: ${n2.caminho} · ${n2.nome}`);
ok(n2.dados.nucleos[0].logos.at(-1).mono === true, 'peça de uma cor marcada como mono');
const s1 = incluirLogo(dados, { nucleo: 'arquitetos', modo: 'substituir', alvo: 'logos/odisse-arquitetos-01.svg' }, cor);
ok(s1.caminho === 'logos/odisse-arquitetos-01.svg' && s1.dados.nucleos[1].logos.length === 1, 'substituir mantém o caminho');
const s2 = incluirLogo(dados, { nucleo: 'estudio', modo: 'substituir', alvo: 'selos/mao.svg' }, mono);
ok(s2.caminho === 'selos/mao.svg', 'substituir o selo');
falha(() => incluirLogo(dados, { nucleo: 'estudio', modo: 'substituir', alvo: 'selos/mao.svg' }, cor), 'uma cor', 'selo colorido recusado');
falha(() => incluirLogo(dados, { nucleo: 'estudio', modo: 'substituir', alvo: 'logos/odisse-elaia-01.svg' }, cor), 'peça deste núcleo', 'substituir peça de outro núcleo recusado');

console.log('\ntudo certo');
