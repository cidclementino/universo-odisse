// Regra da base/v2: as páginas não redesenham as peças `ui-*` no próprio CSS. Variação é opção do
// componente (base/v2/componentes.js); assim, mexer no padrão mexe em todas as páginas. Este teste barra o deploy
// se algum CSS fora da base/v2 tiver uma regra cujo alvo final seja uma classe `ui-`.
// Rodar: node --no-warnings worker/testes/v2-sem-sobrescrita.test.mjs
import fs from 'node:fs';
import path from 'node:path';

const raiz = decodeURIComponent(new URL('../..', import.meta.url).pathname);
const ok = (c, msg) => { if (!c) throw new Error('FALHOU: ' + msg); console.log('ok -', msg); };
const arquivos = [];
(function andar(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (!['.git', 'node_modules', 'v2'].includes(f.name)) andar(p); }
    else if (f.name.endsWith('.css')) arquivos.push(p);
  }
})(raiz);
const ruins = [];
for (const a of arquivos) {
  const css = fs.readFileSync(a, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/([^{}]+)\{/g)) {
    const sel = m[1].trim();
    if (!sel || sel.startsWith('@')) continue;
    for (const s of sel.split(',')) {
      const alvo = s.trim().split(/[\s>+~]+/).pop();
      if (/\.ui-/.test(alvo)) ruins.push(`${path.relative(raiz, a)}: ${s.trim()}`);
    }
  }
}
ok(ruins.length === 0, 'nenhum CSS fora da base/v2 redesenha uma peça ui-*' + (ruins.length ? '\n  ' + ruins.join('\n  ') : ''));
