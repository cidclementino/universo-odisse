// Paleta e registros dos núcleos — Manual do sistema Odisse, v1 (out. 2026), seções 01, 06, 07 e 08.

export const COR = {
  ardosia: '#3F4B57',
  papel: '#FAFAF7',
  areia: '#E3D9C6',
  nevoa: '#E6E8EB',
  grafite: '#2E3036',
  pessego: '#F2DDBE',
  ocre: '#BB8248',
  ambar: '#ECC28F',
  terra: '#4A3726',
  branco: '#FFFFFF',
};

// Cores escuras: texto branco por cima. As demais recebem ardósia.
export const ESCURAS = new Set([COR.ardosia, COR.grafite, COR.terra]);
export const tintaSobre = (fundo) => (ESCURAS.has(fundo) ? COR.branco : COR.ardosia);

export const NUCLEOS = {
  estudio: {
    id: 'estudio',
    nome: 'Estúdio',
    cabecalho: 'Odisse, Estúdio',
    marca: 'Odisse Estúdio',
    sigla: 'oe',
    conteudo: 'Pessoas, obras e bastidores',
    fundo: COR.papel,
    painel: COR.ardosia,
    veu: COR.ardosia,
    selo: 'mao',
    logo: 'odisse',
    tratamento: { tipo: 'duotone', paradas: [COR.ardosia, COR.nevoa], grao: 0.16, difusao: 0 },
    tratamentoNome: 'Duotone ardósia, grão',
  },
  arquitetos: {
    id: 'arquitetos',
    nome: 'Arquitetos',
    cabecalho: 'Odisse Arquitetos',
    marca: 'Odisse Arquitetos',
    sigla: 'oa',
    conteudo: 'Projetos de arquitetura e interiores',
    fundo: COR.papel,
    painel: COR.areia,
    veu: COR.ardosia,
    selo: 'roda',
    logo: 'odisse',
    tratamento: { tipo: 'nenhum' },
    tratamentoNome: 'Cor plena',
  },
  objetos: {
    id: 'objetos',
    nome: 'Objetos',
    cabecalho: 'Odisse Objetos',
    marca: 'Odisse Objetos',
    sigla: 'oo',
    conteudo: 'Peças autorais e loja',
    fundo: COR.papel,
    painel: COR.grafite,
    veu: COR.grafite,
    selo: 'flor',
    logo: 'odisse',
    tratamento: { tipo: 'nenhum' },
    tratamentoNome: 'Foto de estúdio',
  },
  elaia: {
    id: 'elaia',
    nome: 'Elaia',
    cabecalho: 'Odisse Elaia',
    autoria: 'Escrito por', // texto fixo antes do nome da publicação, no cabeçalho à direita
    marca: 'Elaia',
    sigla: 'el',
    conteudo: 'Ensaios e podcast',
    fundo: COR.papel,
    painel: COR.pessego,
    veu: COR.terra,
    selo: 'sol',
    logo: 'elaia',
    tratamento: { tipo: 'duotone', paradas: [COR.ardosia, COR.ocre, COR.ambar], grao: 0.18, difusao: 1.2 },
    tratamentoNome: 'Duotone ocre, grão',
  },
};

export const ORDEM_NUCLEOS = ['estudio', 'arquitetos', 'objetos', 'elaia'];

// Informações padrão sugeridas para cada núcleo (painel esquerdo).
export function padroesDoNucleo(id) {
  const base = {
    tipo: 'carrossel', // carrossel | unico
    projeto: '',
    assunto: '',
    aviso: '',
    contador: true,
    selo: true,
    dataPublicacao: '',
    contatoTitulo: 'Vamos conversar sobre o seu projeto.',
    contatoTexto: 'Projetos de arquitetura e interiores, com atendimento em todo o Brasil.',
    // site, telefone e e-mail não ficam aqui: vêm da Marca (marca.js → contatosDe)
  };
  const por = {
    estudio: { projeto: 'Reserva Criativa', assunto: 'Bastidores',
      contatoTitulo: 'Acompanhe o estúdio.', contatoTexto: 'Estúdio de Arquitetura & Design · João Pessoa · atuação em todo o Brasil.' },
    arquitetos: { projeto: 'Apto RP 201', assunto: 'Projeto de interiores' },
    objetos: { projeto: 'Vórtice I', assunto: 'Recipiente',
      contatoTitulo: 'Vórtice I está disponível na loja.', contatoTexto: 'Peças autorais desenhadas e produzidas pelo Odisse.' },
    elaia: { projeto: 'Nathalia Linhares', assunto: 'Ensaio',
      contatoTitulo: 'Continue a leitura no Elaia.', contatoTexto: 'Este texto parte do ensaio Backrooms, Labirinto Domesticado: Parte I, de Cid Clementino.' },
  };
  return { ...base, ...por[id] };
}
