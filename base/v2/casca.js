// Universo — casca para as ferramentas que moram no Universo (/vendas/, /projetos/…; Cid, 24/11/2026).
//
// Cada ferramenta tem um topo.js pequeno que diz qual item do menu acender e chama este arquivo:
//   const s = document.createElement('script');
//   s.src = '/base/v2/casca.js'; s.dataset.item = 'funil'; s.dataset.classe = 'ferramenta-vendas';
//   document.head.appendChild(s);
// Aqui: carrega o CSS da v2 (e a ponte v1 → v2), põe o conteúdo da página num contêiner (que fica no documento,
// porque as páginas procuram os elementos por id) e monta a casca em volta dele (base/v2/componentes.js).
// O "Sair" do pé do menu apaga a senha do Universo e volta à entrada. A casca montada fica em window.universoCasca
// (marcar, contar, arvore), avisada pelo evento 'universo:casca'.
(() => {
  const eu = document.currentScript;
  const item = eu?.dataset.item || '';
  const classe = eu?.dataset.classe || 'ferramenta';
  for (const href of ['/base/v2/universo.css', '/base/v2/ponte-v1.css']) {
    if (document.querySelector(`link[href="${href}"]`)) continue;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    document.head.appendChild(l);
  }
  const montar = async () => {
    const conteudo = document.createElement('div');
    conteudo.className = classe;
    [...document.body.childNodes].filter((n) => !(n.nodeType === 1 && n.tagName === 'SCRIPT')).forEach((n) => conteudo.appendChild(n));
    document.body.prepend(conteudo);
    const { montarCasca } = await import('/base/v2/componentes.js');
    const casca = await montarCasca({
      conteudo,
      atual: item,
      aoSair: () => { try { localStorage.removeItem('universo:senha'); } catch (_) { /* segue */ } location.href = '/#/'; },
    });
    // para a ferramenta que troca de item do menu conforme a rota (ex.: Marketing: Publicações, Calendário, Estratégia)
    window.universoCasca = casca;
    window.dispatchEvent(new Event('universo:casca'));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
