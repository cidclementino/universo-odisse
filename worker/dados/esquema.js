// Esquema da API de dados: o que cada tabela aceita e quem pode ver ou editar.
// Espelha dados/migracoes/*.sql — mudou a migração, muda aqui também.
//
// Permissões por ferramenta: 'E' edita, 'L' lê, ausente = não vê.
// `campos_restritos`: ferramenta que só enxerga alguns campos (ex.: marketing vê só o nome).

const T = (tipo, extra = {}) => ({ tipo, ...extra });
// 'corretor' (0014): corretor de imóveis trazido pelo Radar
const PAPEIS_ATUACAO = ['atendente', 'vendedor', 'representante', 'socio', 'funcionario', 'contato', 'corretor'];

// Prefixos de id já existentes no banco e a tabela de cada um.
// Prefixos de tabelas futuras (prj, frn, ped, obj, col, pub, cot…) entram com as migrações delas.
export const PREFIXOS = {
  org: 'organizacoes',
  pes: 'pessoas',
  atu: 'atuacoes',
  int: 'interacoes',
  eqp: 'equipe',
  sin: 'sinteses',
  arq: 'arquivos',
  vin: 'vinculos',
  rev: 'revisoes',
  opo: 'oportunidades',
  ppt: 'propostas',
  ctr: 'contratos',
  prj: 'projetos',
  eta: 'etapas',
  hor: 'horas',
  srv: 'bases_servicos',
  tca: 'bases_categorias',
  tus: 'bases_usos',
  pfa: 'pgt_fases',
  pet: 'pgt_etapas',
  pen: 'pgt_entregaveis',
  pev: 'pgt_eventos',
  pma: 'pgt_materiais',
  pmo: 'pgt_modelos',   // padrões de material (0024)
  doc: 'documentos',
  crg: 'cargos',
  tit: 'titulos',
  frt: 'ferramentas_textos',
  emp: 'empresa',
  vcl: 'vendas_clausulas',
  // Acervo (0020): banco único de imagens
  col: 'colecoes',
  obj: 'objetos',
  gal: 'galeria',
  // Credenciais (0021)
  cre: 'credenciais',
  // Escopo do Projeto (0023)
  esc: 'escopo_cartoes',
  eal: 'escopo_alteracoes',
};

// Ferramentas que podem chamar a API. 'hub' = o próprio Universo (senha da equipe);
// 'maquina' = rotinas do GitHub Actions (token próprio); 'site' = odisse.com.br (0011: só o que é público
// da equipe, pelas rotas equipe/publica e equipe/:id/foto); 'radar' = radar.odisse (0014: cria contatos —
// pessoa, imobiliária e atuação de corretor — e oportunidades de terreno; não vê dados sensíveis nem propostas).
// 'servicos' = servicos.odisse (0022: só a lista dos serviços do PGT, pela rota bases/lista).
export const FERRAMENTAS = ['hub', 'vendas', 'projetos', 'fornecedores', 'marketing', 'site', 'maquina', 'radar', 'servicos'];

const NUCLEOS = ['estudio', 'arquitetos', 'objetos', 'elaia'];
export const ETAPAS_FUNIL = ['lead', 'contato', 'briefing', 'proposta', 'negociacao', 'ganha', 'perdida'];
export const SITUACOES_PROPOSTA = ['rascunho', 'enviada', 'aceita', 'recusada', 'expirada', 'substituida'];
export const SITUACOES_PROJETO = ['ativo', 'pausado', 'concluido', 'cancelado'];
export const SITUACOES_ETAPA = ['prevista', 'em_andamento', 'em_aprovacao', 'concluida'];
// Comercial: casa no vendas; o hub e o Projetos leem.
const COMERCIAL = { hub: 'L', vendas: 'E', projetos: 'L', maquina: 'E' };

// Produção (0004): casa na ferramenta Projetos (producao.odisse); o vendas cria o projeto ao
// registrar o contrato assinado (regras.js), sem precisar de permissão de edição aqui.
const PRODUCAO = { hub: 'L', vendas: 'L', projetos: 'E', fornecedores: 'L', marketing: 'L', maquina: 'E' };
// o que o marketing enxerga de um projeto (nada de cliente, valores ou observações internas)
const PROJETO_PUBLICO = ['codigo', 'nome', 'nome_publico', 'nucleo_id', 'tipologia', 'area_m2', 'bairro', 'cidade', 'uf',
  'situacao', 'inicio', 'fim', 'publicavel'];

// Bases e PGT (0005): editados nas páginas Bases e PGT da ferramenta Projetos; o vendas lê.
// Exceção (0006): os campos de custo (preço do serviço, parcela da fase) são editados pelo vendas,
// na página Honorários; os pesos das etapas têm rota própria (pgt.js).
const PGT = { hub: 'E', vendas: 'L', projetos: 'E', maquina: 'E' };
export const GRUPOS_TIPOLOGIA = ['residencial', 'comercial', 'institucional', 'diversos'];
export const TIPOS_MATERIAL = ['modelo', 'formulario', 'checklist', 'referencia'];
export const TIPOS_EVENTO = ['reuniao', 'apresentacao', 'envio', 'aprovacao', 'ajuste', 'visita', 'protocolo', 'revisao', 'encerramento'];
export const TIPOS_DOCUMENTO = ['carta', 'declaracao', 'memorando'];
export const SIGLAS_DOCUMENTO = { carta: 'CA', declaracao: 'DE', memorando: 'MI' };
export const TEMPOS_EVENTO = ['estudio', 'cliente', 'terceiros', 'pontual'];
// Equipe (0011): o que cada pessoa pode assinar e os conselhos profissionais.
export const USOS_ASSINATURA = ['proposta', 'contrato', 'documento', 'rrt'];
export const CONSELHOS = { cau: 'CAU', crea: 'CREA', abd: 'ABD' };
export const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
// o que as ferramentas que só leem a equipe enxergam (sem custo por hora e sem o id da assinatura)
const EQUIPE_LEITURA = ['pessoa_id', 'papel', 'ativo', 'socio', 'tratamento', 'cargo_id', 'titulo_id', 'nome_assinatura',
  'conselho', 'registro', 'registro_uf', 'foto_id', 'assina', 'bio_pt', 'bio_en', 'publico', 'ordem', 'desde', 'ate'];
// listas de cargos e títulos: o hub edita, todas leem
const LISTAS_EQUIPE = { hub: 'E', vendas: 'L', projetos: 'L', fornecedores: 'L', marketing: 'L', site: 'L', maquina: 'E' };

const TODOS_E = { hub: 'E', vendas: 'E', projetos: 'E', fornecedores: 'E', marketing: 'E', maquina: 'E' };
// Acervo (0020): casa no hub (Biblioteca); o Projetos e o marketing também editam; o vendas lê.
// O site não entra aqui: tem rotas próprias (acervo/site/…, ver acervo.js), só com as imagens públicas.
const ACERVO = { hub: 'E', vendas: 'L', projetos: 'E', marketing: 'E', maquina: 'E' };
// o marketing só enxerga as mídias públicas (Cid, 19/11: as restritas não aparecem no Construtor)
const SO_PUBLICAS = "(t.categoria NOT IN ('imagem', 'video') OR t.publica = 1)";

export const TABELAS = {
  organizacoes: {
    prefixo: 'org',
    campos: {
      nome: T('texto', { obrig: true, max: 160, rotulo: 'Nome' }),
      razao_social: T('texto', { max: 200, rotulo: 'Razão social' }),
      cnpj: T('cnpj', { rotulo: 'CNPJ' }),
      tipo: T('lista', { valores: ['empresa', 'escritorio', 'orgao_publico', 'outro'], rotulo: 'Tipo' }),
      email: T('email', { rotulo: 'E-mail' }),
      telefone: T('telefone', { rotulo: 'Telefone' }),
      site: T('url', { rotulo: 'Site' }),
      instagram: T('arroba', { rotulo: 'Instagram' }),
      cidade: T('texto', { max: 80, rotulo: 'Cidade' }),
      uf: T('uf', { rotulo: 'UF' }),
      observacoes: T('textoLongo', { max: 4000, rotulo: 'Observações' }),
    },
    permissoes: { hub: 'E', vendas: 'E', projetos: 'L', fornecedores: 'E', marketing: 'L', maquina: 'E', radar: 'E' },
    campos_restritos: { marketing: ['nome'] },
    filtros: ['tipo', 'cidade', 'uf', 'cnpj', 'email'],
    ordem: 'nome',
    busca: (r) => ({ titulo: r.nome, partes: [r.nome, r.razao_social, r.cnpj, r.email, r.telefone, r.instagram, r.cidade, r.uf] }),
    duplicados: ['cnpj', 'email', 'telefone'],
  },

  pessoas: {
    prefixo: 'pes',
    campos: {
      nome: T('texto', { obrig: true, max: 160, rotulo: 'Nome' }),
      apelido: T('texto', { max: 80, rotulo: 'Apelido' }),
      email: T('email', { rotulo: 'E-mail' }),
      telefone: T('telefone', { rotulo: 'Telefone' }),
      whatsapp: T('telefone', { rotulo: 'WhatsApp' }),
      instagram: T('arroba', { rotulo: 'Instagram' }),
      observacoes: T('textoLongo', { max: 4000, rotulo: 'Observações' }),
    },
    permissoes: { hub: 'E', vendas: 'E', projetos: 'L', fornecedores: 'E', marketing: 'L', maquina: 'E', radar: 'E' },
    campos_restritos: { marketing: ['nome'] },
    filtros: ['email'],
    ordem: 'nome',
    busca: (r) => ({ titulo: r.nome, partes: [r.nome, r.apelido, r.email, r.telefone, r.whatsapp, r.instagram] }),
    duplicados: ['email', 'telefone', 'whatsapp'],
  },

  // Restrita: o vendas (clientes) e o hub (dados para contrato da equipe, 0013). Mesmo id da pessoa.
  // Nunca entra na busca nem no histórico com valor; cada leitura vai para o histórico.
  pessoas_sensiveis: {
    prefixo: 'pes',
    id_da_tabela: 'pessoas',
    sensivel: true,
    campos: {
      nome_completo: T('texto', { max: 200, rotulo: 'Nome completo' }),
      nacionalidade: T('texto', { max: 60, rotulo: 'Nacionalidade' }),
      estado_civil: T('lista', { valores: ['solteiro', 'casado', 'uniao_estavel', 'separado', 'divorciado', 'viuvo'], rotulo: 'Estado civil' }),
      profissao: T('texto', { max: 120, rotulo: 'Profissão' }),
      cpf: T('cpf', { rotulo: 'CPF' }),
      rg: T('texto', { max: 30, rotulo: 'RG' }),
      rg_orgao: T('texto', { max: 30, rotulo: 'Órgão emissor do RG' }),
      nascimento: T('data', { rotulo: 'Nascimento' }),
      logradouro: T('texto', { max: 160, rotulo: 'Logradouro' }),
      numero: T('texto', { max: 20, rotulo: 'Número' }),
      complemento: T('texto', { max: 80, rotulo: 'Complemento' }),
      bairro: T('texto', { max: 80, rotulo: 'Bairro' }),
      cidade: T('texto', { max: 80, rotulo: 'Cidade' }),
      uf: T('uf', { rotulo: 'UF' }),
      cep: T('cep', { rotulo: 'CEP' }),
    },
    permissoes: { vendas: 'E', hub: 'E' },
    filtros: [],
    ordem: 'id',
  },

  atuacoes: {
    prefixo: 'atu',
    campos: {
      pessoa_id: T('ref', { obrig: true, prefixos: ['pes'], rotulo: 'Pessoa' }),
      organizacao_id: T('ref', { obrig: true, prefixos: ['org'], rotulo: 'Organização' }),
      papel: T('lista', { obrig: true, valores: PAPEIS_ATUACAO, rotulo: 'Papel' }),
      cargo: T('texto', { max: 80, rotulo: 'Cargo' }),
      desde: T('data', { rotulo: 'Desde' }),
      ate: T('data', { rotulo: 'Até' }),
      principal: T('sn', { rotulo: 'Principal' }),
      observacoes: T('textoLongo', { max: 2000, rotulo: 'Observações' }),
    },
    imutaveis: ['pessoa_id', 'organizacao_id'],
    permissoes: { hub: 'E', vendas: 'E', projetos: 'L', fornecedores: 'E', maquina: 'E', radar: 'E' },
    filtros: ['pessoa_id', 'organizacao_id', 'papel'],
    ordem: 'criado_em',
  },

  interacoes: {
    prefixo: 'int',
    campos: {
      sobre_id: T('ref', { obrig: true, prefixos: ['org', 'pes', 'opo', 'frn', 'ped', 'prj'], rotulo: 'Sobre' }),
      pessoa_id: T('ref', { prefixos: ['pes'], rotulo: 'Com quem' }),
      tipo: T('lista', { obrig: true, valores: ['reuniao', 'ligacao', 'mensagem', 'email', 'visita'], rotulo: 'Tipo' }),
      data: T('data', { obrig: true, rotulo: 'Data' }),
      resumo: T('textoLongo', { max: 8000, rotulo: 'Resumo' }),
      proxima_acao: T('texto', { max: 200, rotulo: 'Próxima ação' }),
      proxima_acao_em: T('data', { rotulo: 'Data da próxima ação' }),
    },
    permissoes: { hub: 'L', vendas: 'E', projetos: 'L', fornecedores: 'E', maquina: 'E' },
    filtros: ['sobre_id', 'pessoa_id', 'tipo'],
    ordem: 'data DESC',
  },

  // Equipe (0001 + 0011): cadastro comum, editado na página Equipe do hub. Sócio é estado; cargo e título
  // vêm das listas `cargos` e `titulos`, na forma do `tratamento`. `papel` é antigo: a API o mantém em dia
  // (regras.js). A assinatura manuscrita não é campo: entra e sai pelas rotas equipe/:id/assinatura.
  equipe: {
    prefixo: 'eqp',
    campos: {
      pessoa_id: T('ref', { obrig: true, prefixos: ['pes'], rotulo: 'Pessoa' }),
      papel: T('lista', { valores: ['socio', 'arquiteto', 'estagiario', 'colaborador'], rotulo: 'Papel' }),
      ativo: T('sn', { rotulo: 'Ativo' }),
      custo_hora: T('centavos', { rotulo: 'Custo por hora' }),
      socio: T('sn', { rotulo: 'Sócio' }),
      tratamento: T('lista', { valores: ['m', 'f'], rotulo: 'Tratamento' }),
      cargo_id: T('ref', { prefixos: ['crg'], rotulo: 'Cargo' }),
      titulo_id: T('ref', { prefixos: ['tit'], rotulo: 'Título profissional' }),
      nome_assinatura: T('texto', { max: 120, rotulo: 'Nome na assinatura' }),
      conselho: T('lista', { valores: Object.keys(CONSELHOS), rotulo: 'Conselho' }),
      registro: T('registro', { rotulo: 'Registro no conselho' }),
      registro_uf: T('lista', { valores: UFS, rotulo: 'UF do registro' }),
      foto_id: T('ref', { prefixos: ['arq'], rotulo: 'Foto' }),
      assina: T('conjunto', { valores: USOS_ASSINATURA, rotulo: 'Pode assinar' }),
      bio_pt: T('textoLongo', { max: 2000, rotulo: 'Bio (português)' }),
      bio_en: T('textoLongo', { max: 2000, rotulo: 'Bio (inglês)' }),
      publico: T('sn', { rotulo: 'Aparece no site' }),
      ordem: T('inteiro', { min: 0, max: 999, rotulo: 'Ordem' }),
      desde: T('data', { rotulo: 'Na equipe desde' }),
      ate: T('data', { rotulo: 'Na equipe até' }),
    },
    imutaveis: ['pessoa_id'],
    padroes: { ativo: 1, socio: 0, publico: 0 },
    // A página da equipe saiu do Projetos (18/11): ele lê tudo e só muda o custo por hora.
    permissoes: { hub: 'E', projetos: 'L', vendas: 'L', fornecedores: 'L', marketing: 'L', maquina: 'E' },
    editaveis_por: { projetos: ['custo_hora'] },
    campos_restritos: { vendas: EQUIPE_LEITURA, fornecedores: EQUIPE_LEITURA, marketing: EQUIPE_LEITURA },
    filtros: ['papel', 'ativo', 'socio', 'cargo_id', 'publico'],
    ordem: 'ordem, criado_em',
  },

  cargos: {
    prefixo: 'crg',
    campos: {
      nome_m: T('texto', { obrig: true, max: 80, rotulo: 'Nome (masculino)' }),
      nome_f: T('texto', { obrig: true, max: 80, rotulo: 'Nome (feminino)' }),
      nome_en: T('texto', { max: 80, rotulo: 'Nome (inglês)' }),
      ordem: T('inteiro', { min: 0, max: 999, rotulo: 'Ordem' }),
    },
    permissoes: LISTAS_EQUIPE,
    filtros: [],
    ordem: 'ordem, nome_m',
  },

  // 0018: dados da empresa (O Estúdio › Empresa). Um registro (emp_odisse); contrato e documentos leem daqui.
  empresa: {
    prefixo: 'emp',
    campos: {
      nome: T('texto', { obrig: true, max: 60, rotulo: 'Nome curto' }),
      nome_completo: T('texto', { max: 160, rotulo: 'Nome completo' }),
      nome_completo_en: T('texto', { max: 160, rotulo: 'Nome completo (inglês)' }),
      razao_social: T('texto', { max: 200, rotulo: 'Razão social' }),
      cnpj: T('texto', { max: 20, rotulo: 'CNPJ' }),
      inscricao_municipal: T('texto', { max: 40, rotulo: 'Inscrição municipal' }),
      registro_cau: T('texto', { max: 40, rotulo: 'Registro no CAU (PJ)' }),
      // 0021: Constituição e registros
      inscricao_estadual: T('texto', { max: 40, rotulo: 'Inscrição estadual' }),
      capital_social: T('centavos', { rotulo: 'Capital social' }),
      responsavel_tecnico_id: T('ref', { prefixos: ['eqp'], rotulo: 'Responsável técnico no CAU' }),
      fundacao: T('texto', { max: 10, rotulo: 'Fundação' }),
      email: T('texto', { max: 120, rotulo: 'E-mail' }),
      telefone: T('texto', { max: 40, rotulo: 'Telefone' }),
      logradouro: T('texto', { max: 200, rotulo: 'Logradouro, número e sala' }),
      bairro: T('texto', { max: 80, rotulo: 'Bairro' }),
      cidade: T('texto', { max: 80, rotulo: 'Cidade' }),
      uf: T('texto', { max: 2, rotulo: 'UF' }),
      cep: T('texto', { max: 12, rotulo: 'CEP' }),
      caixa_postal: T('texto', { max: 20, rotulo: 'Caixa postal' }),
      texto_curto: T('textoLongo', { max: 200, rotulo: 'Texto curto' }),
      texto_curto_en: T('textoLongo', { max: 200, rotulo: 'Texto curto (inglês)' }),
      texto_medio: T('textoLongo', { max: 900, rotulo: 'Texto médio' }),
      texto_medio_en: T('textoLongo', { max: 900, rotulo: 'Texto médio (inglês)' }),
      texto_longo: T('textoLongo', { max: 4000, rotulo: 'Texto longo' }),
      texto_longo_en: T('textoLongo', { max: 4000, rotulo: 'Texto longo (inglês)' }),
    },
    permissoes: { hub: 'E', vendas: 'L', projetos: 'L', marketing: 'L', site: 'L', maquina: 'E' },
    filtros: [],
    ordem: 'nome',
  },

  // 0017: descrição de cada ferramenta editada no hub (lápis na página Ferramentas); chave = id no ferramentas.json
  ferramentas_textos: {
    prefixo: 'frt',
    campos: {
      chave: T('texto', { obrig: true, max: 40, rotulo: 'Ferramenta' }),
      descricao: T('texto', { obrig: true, max: 120, rotulo: 'Descrição' }),
    },
    permissoes: { hub: 'E', maquina: 'E' },
    filtros: [],
    ordem: 'chave',
  },

  titulos: {
    prefixo: 'tit',
    campos: {
      nome_m: T('texto', { obrig: true, max: 80, rotulo: 'Nome (masculino)' }),
      nome_f: T('texto', { obrig: true, max: 80, rotulo: 'Nome (feminino)' }),
      nome_en: T('texto', { max: 80, rotulo: 'Nome (inglês)' }),
      ordem: T('inteiro', { min: 0, max: 999, rotulo: 'Ordem' }),
    },
    permissoes: LISTAS_EQUIPE,
    filtros: [],
    ordem: 'ordem, nome_m',
  },

  sinteses: {
    prefixo: 'sin',
    campos: {
      alvo_id: T('ref', { obrig: true, prefixos: ['prj', 'obj', 'col'], rotulo: 'Projeto, objeto ou coleção' }),
      idioma: T('lista', { obrig: true, valores: ['pt', 'en'], rotulo: 'Idioma' }),
      texto: T('textoLongo', { obrig: true, max: 6000, rotulo: 'Texto' }),
    },
    imutaveis: ['alvo_id', 'idioma'],
    versoes: true,
    permissoes: { hub: 'E', vendas: 'L', projetos: 'E', marketing: 'E', maquina: 'E' },
    filtros: ['alvo_id', 'idioma'],
    ordem: 'criado_em',
  },

  arquivos: {
    prefixo: 'arq',
    campos: {
      dono_id: T('ref', { prefixos: ['ppt', 'ctr', 'cot', 'ped', 'prj', 'opo', 'org', 'pes', 'eqp', 'cre'], rotulo: 'Documento de' }),
      nome_original: T('texto', { obrig: true, max: 200, rotulo: 'Nome do arquivo' }),
      tipo_mime: T('texto', { obrig: true, max: 100, rotulo: 'Tipo' }),
      tamanho: T('inteiro', { min: 0, rotulo: 'Tamanho' }),
      sha256: T('texto', { max: 64, rotulo: 'Assinatura' }),
      categoria: T('lista', { obrig: true, valores: ['pdf_proposta', 'contrato', 'cotacao', 'imagem', 'video', 'desenho', 'outro'], rotulo: 'Categoria' }),
      visivel_cliente: T('sn', { rotulo: 'Visível ao cliente' }),
      largura: T('inteiro', { min: 1, rotulo: 'Largura' }),
      altura: T('inteiro', { min: 1, rotulo: 'Altura' }),
      duracao: T('real', { rotulo: 'Duração' }),
      texto_alternativo: T('texto', { max: 300, rotulo: 'Texto alternativo' }),
      legenda: T('texto', { max: 300, rotulo: 'Legenda' }),
      credito: T('texto', { max: 120, rotulo: 'Crédito' }),
      data_captura: T('data', { rotulo: 'Data da foto' }),
      direitos: T('lista', { valores: ['livre', 'uso_interno', 'aguarda_autorizacao'], rotulo: 'Direitos' }),
      origem_drive: T('texto', { max: 400, rotulo: 'Caminho no Drive' }),
      // 0020: disponível para o site e afins; só com direitos livres (regras.js e gatilho no banco)
      publica: T('sn', { rotulo: 'Pública' }),
    },
    // variantes é preenchido pela API ao receber o conteúdo; não vem do formulário
    imutaveis: ['sha256', 'tipo_mime', 'categoria'],
    padroes: { visivel_cliente: 0, publica: 0 },
    permissoes: TODOS_E,
    linhas_restritas: { marketing: SO_PUBLICAS },
    // o editor do site muda só a descrição das imagens públicas (rotas acervo/site, acervo.js)
    editaveis_por: { site: ['texto_alternativo'] },
    filtros: ['dono_id', 'categoria', 'sha256', 'publica'],
    ordem: 'criado_em DESC',
    busca: (r) => ({ titulo: r.nome_original, partes: [r.nome_original, r.legenda, r.texto_alternativo, r.credito] }),
  },

  // ---------------------------------------------------------------- acervo (0020)
  colecoes: {
    prefixo: 'col',
    campos: {
      nome: T('texto', { obrig: true, max: 160, rotulo: 'Nome' }),
      nucleo_id: T('lista', { valores: NUCLEOS, rotulo: 'Núcleo' }),
      descricao: T('textoLongo', { max: 4000, rotulo: 'Descrição' }),
    },
    permissoes: ACERVO,
    filtros: ['nucleo_id'],
    ordem: 'nome',
    busca: (r) => ({ titulo: r.nome, partes: [r.nome, r.descricao] }),
  },

  objetos: {
    prefixo: 'obj',
    campos: {
      nome: T('texto', { obrig: true, max: 160, rotulo: 'Nome' }),
      nome_publico: T('texto', { max: 160, rotulo: 'Nome público' }),
      colecao_id: T('ref', { prefixos: ['col'], rotulo: 'Coleção' }),
      nucleo_id: T('lista', { valores: NUCLEOS, rotulo: 'Núcleo' }),
      descricao: T('textoLongo', { max: 4000, rotulo: 'Descrição' }),
      publicavel: T('sn', { rotulo: 'Pode ser publicado' }),
    },
    padroes: { nucleo_id: 'objetos', publicavel: 0 },
    permissoes: ACERVO,
    filtros: ['colecao_id', 'nucleo_id'],
    ordem: 'nome',
    busca: (r) => ({ titulo: r.nome, partes: [r.nome, r.nome_publico, r.descricao] }),
  },

  // imagem ↔ projeto, objeto ou coleção (uma imagem pode estar em vários)
  // Credenciais (0021; Cid, 19/11): documentos que editais e concursos pedem; o tipo vem do catálogo em credenciais.js
  credenciais: {
    prefixo: 'cre',
    campos: {
      dono_id: T('ref', { obrig: true, prefixos: ['emp', 'eqp', 'prj'], rotulo: 'De quem é' }),
      tipo: T('texto', { obrig: true, max: 40, rotulo: 'Documento' }),
      titulo: T('texto', { max: 160, rotulo: 'Detalhe' }),
      numero: T('texto', { max: 80, rotulo: 'Número' }),
      emitido_em: T('data', { rotulo: 'Emitido em' }),
      vence_em: T('data', { rotulo: 'Vence em' }),
      arquivo_id: T('ref', { prefixos: ['arq'], rotulo: 'Arquivo' }),
      observacao: T('textoLongo', { max: 1000, rotulo: 'Observação' }),
      substitui_id: T('ref', { prefixos: ['cre'], rotulo: 'Substitui' }),
    },
    imutaveis: ['dono_id', 'tipo', 'substitui_id'],
    // documentos da empresa e da equipe (identidade incluída): só o hub, por ora
    permissoes: { hub: 'E', maquina: 'E' },
    filtros: ['dono_id', 'tipo'],
    ordem: 'vence_em, criado_em',
  },
  // Escopo do Projeto (0023): sem rotas comuns; tudo passa por escopo/:prj (escopo.js)
  escopo_cartoes: {
    prefixo: 'esc',
    campos: {
      projeto_id: T('ref', { obrig: true, prefixos: ['prj'], rotulo: 'Projeto' }),
      tipo: T('lista', { obrig: true, valores: ['etapa', 'entrega', 'evento'], rotulo: 'Tipo' }),
      etapa_id: T('ref', { prefixos: ['esc'], rotulo: 'Etapa' }),
      texto: T('texto', { obrig: true, max: 400, rotulo: 'Texto' }),
      dias: T('inteiro', { min: 1, max: 400, rotulo: 'Dias' }),
      folga: T('inteiro', { min: -400, max: 400, rotulo: 'Folga' }),
      observacoes: T('textoLongo', { max: 4000, rotulo: 'Observações' }),
    },
    permissoes: { hub: 'L', vendas: 'L', projetos: 'E', maquina: 'E' },
    filtros: ['projeto_id'],
    ordem: 'ordem',
  },
  escopo_alteracoes: {
    prefixo: 'eal',
    campos: {
      projeto_id: T('ref', { obrig: true, prefixos: ['prj'], rotulo: 'Projeto' }),
      motivo: T('textoLongo', { max: 2000, rotulo: 'Motivo' }),
    },
    permissoes: { hub: 'L', vendas: 'L', projetos: 'E', maquina: 'E' },
    filtros: ['projeto_id'],
    ordem: 'em',
  },

  galeria: {
    prefixo: 'gal',
    campos: {
      arquivo_id: T('ref', { obrig: true, prefixos: ['arq'], rotulo: 'Imagem' }),
      alvo_id: T('ref', { obrig: true, prefixos: ['prj', 'obj', 'col'], rotulo: 'Projeto, objeto ou coleção' }),
      ordem: T('inteiro', { min: 0, max: 99999, rotulo: 'Ordem' }),
      destaque: T('sn', { rotulo: 'Destaque' }),
    },
    imutaveis: ['arquivo_id', 'alvo_id'],
    padroes: { destaque: 0 },
    permissoes: ACERVO,
    filtros: ['arquivo_id', 'alvo_id'],
    ordem: 'criado_em',
  },

  vinculos: {
    prefixo: 'vin',
    campos: {
      de_id: T('ref', { obrig: true, prefixos: Object.keys(PREFIXOS), rotulo: 'De' }),
      para_id: T('ref', { obrig: true, prefixos: Object.keys(PREFIXOS), rotulo: 'Para' }),
      papel: T('texto', { obrig: true, max: 40, rotulo: 'Papel' }),
      observacao: T('texto', { max: 300, rotulo: 'Observação' }),
    },
    imutaveis: ['de_id', 'para_id', 'papel'],
    permissoes: TODOS_E,
    filtros: ['de_id', 'para_id', 'papel'],
    ordem: 'criado_em',
  },

  revisoes: {
    prefixo: 'rev',
    campos: {
      situacao: T('lista', { valores: ['pendente', 'mesmo', 'diferentes'], rotulo: 'Situação' }),
    },
    so_leitura_na_criacao: true, // criadas pela própria API (checagem de duplicados)
    permissoes: { hub: 'E', vendas: 'E', fornecedores: 'E', maquina: 'E' },
    filtros: ['situacao', 'tipo'],
    ordem: 'criado_em DESC',
  },

  // ---------------------------------------------------------------- comercial (0002)
  oportunidades: {
    prefixo: 'opo',
    campos: {
      titulo: T('texto', { obrig: true, max: 160, rotulo: 'Título' }),
      cliente_id: T('ref', { prefixos: ['org', 'pes'], rotulo: 'Cliente (titular)' }),
      contato_pessoa_id: T('ref', { prefixos: ['pes'], rotulo: 'Pessoa de contato' }),
      projeto_id: T('ref', { prefixos: ['prj'], rotulo: 'Projeto (ampliação ou aditivo)' }),
      nucleo_id: T('lista', { valores: NUCLEOS, rotulo: 'Núcleo' }),
      origem: T('lista', { valores: ['indicacao', 'instagram', 'site', 'landing_page', 'herma', 'radar', 'outro'], rotulo: 'Origem' }),
      origem_detalhe: T('texto', { max: 200, rotulo: 'Detalhe da origem' }),
      etapa_funil: T('lista', { valores: ETAPAS_FUNIL, rotulo: 'Etapa do funil' }),
      valor_estimado: T('centavos', { rotulo: 'Valor estimado' }),
      motivo_perda: T('texto', { max: 300, rotulo: 'Motivo da perda' }),
      responsavel_id: T('ref', { prefixos: ['eqp'], rotulo: 'Responsável' }),
      observacoes: T('textoLongo', { max: 8000, rotulo: 'Observações' }),
    },
    padroes: { etapa_funil: 'lead' },
    // o Radar abre oportunidades de terreno (titular = o corretor); propostas e contratos ele não vê
    permissoes: { ...COMERCIAL, radar: 'E' },
    filtros: ['etapa_funil', 'nucleo_id', 'cliente_id', 'contato_pessoa_id', 'origem', 'responsavel_id', 'projeto_id'],
    ordem: 'atualizado_em DESC',
    busca: (r) => ({ titulo: r.titulo, partes: [r.titulo, r.origem_detalhe, r.observacoes] }),
  },

  // numero, revisao, codigo e importada_de são gravados pela API (ver regras.js).
  propostas: {
    prefixo: 'ppt',
    campos: {
      // obrigatória, menos em simulação (regras.js)
      oportunidade_id: T('ref', { prefixos: ['opo'], rotulo: 'Oportunidade' }),
      simulacao: T('sn', { rotulo: 'Simulação' }),
      titulo: T('texto', { max: 200, rotulo: 'Título' }),
      data: T('data', { rotulo: 'Data da proposta' }),
      valor_total: T('centavos', { rotulo: 'Valor total' }),
      situacao: T('lista', { valores: SITUACOES_PROPOSTA, rotulo: 'Situação' }),
      enviada_em: T('data', { rotulo: 'Enviada em' }),
      validade: T('data', { rotulo: 'Validade' }),
      calculo: T('json', { max: 400000, rotulo: 'Cálculo' }),
      referencias: T('json', { max: 20000, rotulo: 'Referências' }),
      arquivo_pdf_id: T('ref', { prefixos: ['arq'], rotulo: 'PDF' }),
    },
    imutaveis: ['oportunidade_id', 'simulacao'],
    // depois que o PDF é congelado, o que foi para o cliente não muda: mudou, é revisão nova
    congelado: { quando: 'arquivo_pdf_id', campos: ['titulo', 'data', 'valor_total', 'calculo', 'referencias', 'arquivo_pdf_id', 'validade'] },
    padroes: { situacao: 'rascunho', simulacao: 0 },
    versoes: true,
    permissoes: COMERCIAL,
    filtros: ['oportunidade_id', 'situacao', 'numero', 'codigo', 'importada_de', 'simulacao'],
    ordem: 'numero DESC, revisao DESC',
    busca: (r) => ({ titulo: `${r.codigo}${r.simulacao ? ' · simulação' : ''}${r.titulo ? ' · ' + r.titulo : ''}`, partes: [r.codigo, r.titulo, r.simulacao ? 'simulacao' : ''] }),
  },

  contratos: {
    prefixo: 'ctr',
    campos: {
      tipo: T('lista', { valores: ['principal', 'aditivo'], rotulo: 'Tipo' }),
      proposta_id: T('ref', { prefixos: ['ppt'], rotulo: 'Proposta' }),
      projeto_id: T('ref', { prefixos: ['prj'], rotulo: 'Projeto' }),
      situacao: T('lista', { valores: ['rascunho', 'enviado', 'assinado', 'encerrado', 'cancelado'], rotulo: 'Situação' }),
      valor_total: T('centavos', { rotulo: 'Valor total' }),
      assinado_em: T('data', { rotulo: 'Assinado em' }),
      arquivo_assinado_id: T('ref', { prefixos: ['arq'], rotulo: 'Contrato assinado' }),
      observacoes: T('textoLongo', { max: 4000, rotulo: 'Observações' }),
    },
    imutaveis: ['tipo'],
    padroes: { tipo: 'principal', situacao: 'rascunho' },
    permissoes: { hub: 'L', vendas: 'E', projetos: 'E', maquina: 'E' },
    filtros: ['proposta_id', 'projeto_id', 'situacao', 'tipo', 'numero'],
    ordem: 'numero DESC',
    busca: (r) => ({ titulo: r.codigo, partes: [r.codigo, r.observacoes] }),
  },

  // ---------------------------------------------------------------- produção (0004)
  // codigo, ano e numero são gravados pela API (regras.js): AAAA-NNN, recomeçando a cada ano.
  projetos: {
    prefixo: 'prj',
    campos: {
      nome: T('texto', { obrig: true, max: 160, rotulo: 'Nome' }),
      nome_publico: T('texto', { max: 160, rotulo: 'Nome público' }),
      nucleo_id: T('lista', { valores: NUCLEOS, rotulo: 'Núcleo' }),
      cliente_id: T('ref', { prefixos: ['org', 'pes'], rotulo: 'Cliente (titular)' }),
      oportunidade_id: T('ref', { prefixos: ['opo'], rotulo: 'Oportunidade' }),
      servico: T('texto', { max: 120, rotulo: 'Serviço' }),
      tipologia: T('texto', { max: 200, rotulo: 'Tipologia' }),
      area_m2: T('real', { rotulo: 'Área (m²)' }),
      bairro: T('texto', { max: 80, rotulo: 'Bairro' }),
      cidade: T('texto', { max: 80, rotulo: 'Cidade' }),
      uf: T('uf', { rotulo: 'UF' }),
      situacao: T('lista', { valores: SITUACOES_PROJETO, rotulo: 'Situação' }),
      inicio: T('data', { rotulo: 'Início' }),
      previsao_fim: T('data', { rotulo: 'Previsão de fim' }),
      fim: T('data', { rotulo: 'Fim' }),
      responsavel_id: T('ref', { prefixos: ['eqp'], rotulo: 'Responsável' }),
      publicavel: T('sn', { rotulo: 'Pode ser publicado' }),
      observacoes: T('textoLongo', { max: 8000, rotulo: 'Observações' }),
    },
    padroes: { situacao: 'ativo' },
    permissoes: PRODUCAO,
    campos_restritos: { marketing: PROJETO_PUBLICO },
    // ferramenta que só lê, mas pode mudar estes campos
    editaveis_por: { marketing: ['nome_publico'] },
    filtros: ['situacao', 'nucleo_id', 'cliente_id', 'oportunidade_id', 'contrato_id', 'responsavel_id', 'ano', 'codigo'],
    ordem: 'ano DESC, numero DESC',
    busca: (r) => ({ titulo: `${r.codigo} · ${r.nome}`, partes: [r.codigo, r.nome, r.nome_publico, r.servico, r.tipologia, r.bairro, r.cidade] }),
  },

  // Restrita: vendas e Projetos. Mesmo id do projeto. Fora da busca.
  projetos_local: {
    prefixo: 'prj',
    id_da_tabela: 'projetos',
    campos: {
      logradouro: T('texto', { max: 160, rotulo: 'Logradouro' }),
      numero: T('texto', { max: 20, rotulo: 'Número' }),
      complemento: T('texto', { max: 80, rotulo: 'Complemento' }),
      cep: T('cep', { rotulo: 'CEP' }),
      referencias: T('textoLongo', { max: 2000, rotulo: 'Referências de acesso' }),
    },
    permissoes: { vendas: 'E', projetos: 'E', maquina: 'E' },
    filtros: [],
    ordem: 'id',
  },

  etapas: {
    prefixo: 'eta',
    campos: {
      projeto_id: T('ref', { obrig: true, prefixos: ['prj'], rotulo: 'Projeto' }),
      ordem: T('inteiro', { obrig: true, min: 0, max: 999, rotulo: 'Ordem' }),
      nome: T('texto', { obrig: true, max: 120, rotulo: 'Nome' }),
      fase: T('texto', { max: 120, rotulo: 'Fase' }),
      ref_vendas: T('texto', { max: 80, rotulo: 'Etapa no vendas' }),
      semanas: T('real', { rotulo: 'Semanas' }),
      situacao: T('lista', { valores: SITUACOES_ETAPA, rotulo: 'Situação' }),
      inicio_previsto: T('data', { rotulo: 'Início previsto' }),
      fim_previsto: T('data', { rotulo: 'Fim previsto' }),
      inicio: T('data', { rotulo: 'Início' }),
      fim: T('data', { rotulo: 'Fim' }),
      percentual_pagamento: T('real', { rotulo: 'Percentual do pagamento' }),
      observacoes: T('textoLongo', { max: 4000, rotulo: 'Observações' }),
    },
    imutaveis: ['projeto_id'],
    padroes: { situacao: 'prevista' },
    permissoes: PRODUCAO,
    campos_restritos: { marketing: ['projeto_id', 'ordem', 'nome', 'fase', 'situacao'] },
    filtros: ['projeto_id', 'situacao'],
    ordem: 'projeto_id, ordem',
  },

  horas: {
    prefixo: 'hor',
    campos: {
      equipe_id: T('ref', { obrig: true, prefixos: ['eqp'], rotulo: 'Quem' }),
      projeto_id: T('ref', { obrig: true, prefixos: ['prj'], rotulo: 'Projeto' }),
      etapa_id: T('ref', { prefixos: ['eta'], rotulo: 'Etapa' }),
      cartao_id: T('ref', { prefixos: ['esc'], rotulo: 'Etapa do escopo' }),   // 0023
      data: T('data', { obrig: true, rotulo: 'Dia' }),
      minutos: T('inteiro', { obrig: true, min: 1, max: 1440, rotulo: 'Duração (minutos)' }),
      descricao: T('textoLongo', { max: 2000, rotulo: 'O que foi feito' }),
    },
    permissoes: { hub: 'L', projetos: 'E', maquina: 'E' },
    filtros: ['equipe_id', 'projeto_id', 'etapa_id', 'data'],
    ordem: 'data DESC, criado_em DESC',
  },

  // ---------------------------------------------------------------- Bases (0005)
  // sigla em maiúsculas e ic_ajustes/ic_preset conferidos em regras.js
  bases_servicos: {
    prefixo: 'srv',
    campos: {
      sigla: T('texto', { obrig: true, max: 4, rotulo: 'Sigla' }),
      nome: T('texto', { obrig: true, max: 120, rotulo: 'Nome' }),
      descricao: T('textoLongo', { max: 2000, rotulo: 'Descrição' }),
      ordem: T('inteiro', { min: 0, max: 999, rotulo: 'Ordem' }),
      modificador: T('real', { rotulo: 'Modificador' }),
      // 0022: serviço em fluxo (plano comum, pede tipologia) ou em ilha (plano próprio); pede_tipologia acompanha
      dinamica: T('lista', { valores: ['fluxo', 'ilha'], rotulo: 'Dinâmica' }),
      pede_tipologia: T('sn', { rotulo: 'Pede tipologia' }),
      com_preco: T('sn', { rotulo: 'Tem preço' }),
      preco_por_etapa: T('sn', { rotulo: 'Preço repartido por etapa' }),
      ic_ajustes: T('json', { max: 4000, rotulo: 'Ajustes do índice de complexidade' }),
      ic_padrao: T('json', { max: 4000, rotulo: 'Índice de complexidade do serviço' }),
      observacoes: T('textoLongo', { max: 4000, rotulo: 'Observações' }),
    },
    padroes: { dinamica: 'fluxo', pede_tipologia: 1, com_preco: 1, preco_por_etapa: 0 },
    permissoes: PGT,
    editaveis_por: { vendas: ['modificador', 'com_preco', 'preco_por_etapa'] },
    filtros: [],
    ordem: 'ordem, nome',
  },

  bases_categorias: {
    prefixo: 'tca',
    campos: {
      grupo: T('lista', { obrig: true, valores: GRUPOS_TIPOLOGIA, rotulo: 'Grupo' }),
      nome: T('texto', { obrig: true, max: 120, rotulo: 'Nome' }),
      ordem: T('inteiro', { min: 0, max: 999, rotulo: 'Ordem' }),
      ic_preset: T('json', { max: 4000, rotulo: 'Índice de complexidade' }),
      observacoes: T('textoLongo', { max: 4000, rotulo: 'Observações' }),
    },
    permissoes: PGT,
    filtros: ['grupo'],
    ordem: 'ordem, nome',
  },

  bases_usos: {
    prefixo: 'tus',
    campos: {
      categoria_id: T('ref', { obrig: true, prefixos: ['tca'], rotulo: 'Categoria' }),
      item: T('texto', { max: 20, rotulo: 'Item do CAU' }),
      descricao: T('texto', { obrig: true, max: 300, rotulo: 'Descrição' }),
      categoria_cau: T('inteiro', { min: 1, max: 4, rotulo: 'Categoria do fator percentual (CAU)' }),
      cub_codigo: T('texto', { max: 20, rotulo: 'Código do CUB' }),
      cub_referencia: T('real', { rotulo: 'CUB de referência' }),
      fator_adequacao: T('real', { rotulo: 'Fator de adequação' }),
      ordem: T('inteiro', { min: 0, max: 999, rotulo: 'Ordem' }),
      observacoes: T('textoLongo', { max: 4000, rotulo: 'Observações' }),
    },
    permissoes: PGT,
    filtros: ['categoria_id'],
    ordem: 'categoria_id, ordem',
  },

  // ---------------------------------------------------------------- PGT (0005)
  pgt_fases: {
    prefixo: 'pfa',
    campos: {
      nome: T('texto', { obrig: true, max: 80, rotulo: 'Nome' }),
      ordem: T('inteiro', { min: 0, max: 999, rotulo: 'Ordem' }),
      ilha: T('sn', { rotulo: 'Fora do fluxo (ilha)' }),
      solta: T('sn', { rotulo: 'Só agrupa etapas avulsas' }),
      travado: T('sn', { rotulo: 'Travada' }),
      parcela: T('real', { rotulo: 'Parcela do pagamento' }),   // sem uso desde 0015 (pagamento = entrada + peso das fases)
      acrescimo: T('sn', { rotulo: 'Acréscimo (fora dos 100%)' }),
      descricao: T('textoLongo', { max: 2000, rotulo: 'Descrição' }),
    },
    padroes: { ilha: 0, solta: 0, travado: 0, acrescimo: 0 },
    permissoes: PGT,
    editaveis_por: { vendas: ['parcela', 'acrescimo'] },
    filtros: [],
    ordem: 'ordem',
  },

  pgt_etapas: {
    prefixo: 'pet',
    campos: {
      fase_id: T('ref', { obrig: true, prefixos: ['pfa'], rotulo: 'Fase' }),
      sigla: T('texto', { obrig: true, max: 4, rotulo: 'Sigla' }),
      nome: T('texto', { obrig: true, max: 120, rotulo: 'Nome' }),
      ordem: T('inteiro', { min: 0, max: 999, rotulo: 'Ordem' }),
      nbr_nome: T('texto', { max: 120, rotulo: 'Nome na NBR' }),
      nbr_sigla: T('texto', { max: 20, rotulo: 'Sigla na NBR' }),
      nbr_nota: T('texto', { max: 300, rotulo: 'Nota sobre a NBR' }),
      descricao: T('textoLongo', { max: 4000, rotulo: 'Descrição (contrato)' }),
      semanas_base: T('real', { rotulo: 'Semanas' }),
      travado: T('sn', { rotulo: 'Travada' }),
      servico_id: T('ref', { prefixos: ['srv'], rotulo: 'Serviço (etapa de ilha)' }),
    },
    padroes: { travado: 0 },
    permissoes: PGT,
    filtros: ['fase_id'],
    ordem: 'ordem',
  },

  pgt_entregaveis: {
    prefixo: 'pen',
    campos: {
      etapa_id: T('ref', { obrig: true, prefixos: ['pet'], rotulo: 'Etapa' }),
      texto: T('texto', { obrig: true, max: 400, rotulo: 'Texto (contrato)' }),
      ordem: T('inteiro', { min: 0, max: 999, rotulo: 'Ordem' }),
      observacoes: T('textoLongo', { max: 4000, rotulo: 'Observações' }),
      prazo_turnos: T('real', { min: 0.5, max: 40, rotulo: 'Prazo (turnos)' }),
      pessoas: T('inteiro', { min: 1, max: 20, rotulo: 'Pessoas' }),
      prazo_fixo: T('sn', { rotulo: 'Prazo fixo' }),
      junto_anterior: T('sn', { rotulo: 'Corre junto com a anterior' }),
      travado: T('sn', { rotulo: 'Travado' }),
    },
    padroes: { pessoas: 1, prazo_fixo: 0, junto_anterior: 0, travado: 0 },
    permissoes: PGT,
    filtros: ['etapa_id'],
    ordem: 'etapa_id, ordem',
  },

  // Eventos (0008): marcos de controle do fluxo, na mesma sequência das entregas da etapa.
  // O Encerramento (encerramento = 1) é único e tem instâncias (JSON de etapas); conferido em regras.js.
  // Decisão (0009): JSON [{ id, nome, libera: [pen_/pev_…] }]; conferido em regras.js.
  pgt_eventos: {
    prefixo: 'pev',
    campos: {
      etapa_id: T('ref', { obrig: true, prefixos: ['pet'], rotulo: 'Etapa' }),
      nome: T('texto', { obrig: true, max: 200, rotulo: 'Nome' }),
      tipo: T('lista', { obrig: true, valores: TIPOS_EVENTO, rotulo: 'Tipo' }),
      cliente: T('sn', { rotulo: 'Com o cliente' }),
      terceiros: T('sn', { rotulo: 'Com terceiros' }),
      tempo: T('lista', { valores: TEMPOS_EVENTO, rotulo: 'De quem é o tempo' }),
      prazo_turnos: T('real', { min: 0.5, max: 40, rotulo: 'Duração (turnos)' }),
      quantidade: T('inteiro', { min: 1, max: 99, rotulo: 'Quantidade incluída' }),
      clausula: T('textoLongo', { max: 1000, rotulo: 'Cláusula' }),             // texto: redigido no vendas (Gestor de cláusulas)
      clausula_marcada: T('sn', { rotulo: 'É cláusula' }),                         // 0019: a marca fica no PGT
      observacoes: T('textoLongo', { max: 4000, rotulo: 'Observações' }),
      ordem: T('inteiro', { min: 0, max: 9999, rotulo: 'Ordem' }),
      travado: T('sn', { rotulo: 'Travado' }),
      instancias: T('json', { rotulo: 'Etapas onde o encerramento pode ficar' }),
      decisao: T('json', { max: 8000, rotulo: 'Decisão (resultados e cartões relacionados)' }),
    },
    padroes: { cliente: 0, terceiros: 0, tempo: 'pontual', travado: 0, clausula_marcada: 0 },
    permissoes: PGT,
    // 0019: o texto da cláusula também se edita no vendas (Contratos › Gestor de cláusulas)
    editaveis_por: { vendas: ['clausula'] },
    filtros: ['etapa_id', 'tipo'],
    ordem: 'etapa_id, ordem',
  },
  pgt_materiais: {
    prefixo: 'pma',
    campos: {
      alvo_id: T('ref', { obrig: true, prefixos: ['pet', 'pen', 'pev'], rotulo: 'Etapa, entrega ou evento' }),
      tipo: T('lista', { obrig: true, valores: TIPOS_MATERIAL, rotulo: 'Tipo' }),
      nome: T('texto', { obrig: true, max: 160, rotulo: 'Nome' }),
      descricao: T('textoLongo', { max: 2000, rotulo: 'Descrição' }),
      link: T('url', { rotulo: 'Link' }),
      arquivo_id: T('ref', { prefixos: ['arq'], rotulo: 'Arquivo' }),
      ordem: T('inteiro', { min: 0, max: 999, rotulo: 'Ordem' }),
      modelo_id: T('ref', { prefixos: ['pmo'], rotulo: 'Padrão' }),   // 0024: ligação a um padrão
    },
    permissoes: PGT,
    filtros: ['alvo_id', 'tipo', 'modelo_id'],
    ordem: 'alvo_id, ordem',
  },

  // ---------------------------------------------------------------- padrões de material (0024)
  pgt_modelos: {
    prefixo: 'pmo',
    campos: {
      nome: T('texto', { obrig: true, max: 160, rotulo: 'Nome' }),
      tipo: T('lista', { valores: ['formulario', 'checklist', 'modelo'], rotulo: 'Tipo' }),
      descricao: T('textoLongo', { max: 2000, rotulo: 'Descrição' }),
      folha: T('lista', { valores: ['coluna', 'ficha'], rotulo: 'Folha' }),
      miolo: T('lista', { valores: ['texto', 'vazio', 'pontos'], rotulo: 'Miolo' }),
      preenche: T('lista', { valores: ['estudio', 'cliente', 'ambos'], rotulo: 'Quem preenche' }),
      prova: T('sn', { rotulo: 'Vira prova do cartão' }),
      campos: T('json', { max: 60000, rotulo: 'Campos' }),
      ordem: T('inteiro', { min: 0, max: 9999, rotulo: 'Ordem' }),
    },
    padroes: { tipo: 'formulario', folha: 'ficha', miolo: 'texto', preenche: 'estudio', prova: 1, ordem: 0 },
    permissoes: PGT,
    filtros: ['tipo'],
    ordem: 'ordem, nome',
  },

  // ---------------------------------------------------------------- cláusulas do vendas (0019)
  // Despesas reembolsáveis e, depois, cláusulas gerais do contrato. Casa: vendas › Contratos › Gestor de cláusulas.
  // Entram no retrato dos Honorários (pgt.js); a proposta lê da versão publicada.
  vendas_clausulas: {
    prefixo: 'vcl',
    campos: {
      grupo: T('lista', { obrig: true, valores: ['despesa', 'geral'], rotulo: 'Grupo' }),
      texto: T('textoLongo', { obrig: true, max: 2000, rotulo: 'Texto' }),
      padrao: T('sn', { rotulo: 'Marcada por padrão' }),
      ordem: T('inteiro', { min: 0, max: 9999, rotulo: 'Ordem' }),
    },
    padroes: { padrao: 1, ordem: 0 },
    permissoes: { hub: 'E', vendas: 'E', projetos: 'L', maquina: 'E' },
    filtros: ['grupo'],
    ordem: 'grupo, ordem',
  },

  // ---------------------------------------------------------------- documentos (0010)
  // Grupo 1 do estúdio: carta (com a opção ofício), declaração e memorando. O conteúdo fica aqui; o desenho
  // da folha vem da Marca (v1/documentos/). numero, ano e codigo são gravados pela API (regras.js).
  documentos: {
    prefixo: 'doc',
    campos: {
      tipo: T('lista', { obrig: true, valores: TIPOS_DOCUMENTO, rotulo: 'Tipo' }),
      modelo: T('lista', { valores: ['coluna', 'ficha'], rotulo: 'Modelo da folha' }),
      oficio: T('sn', { rotulo: 'Ofício' }),
      data: T('data', { rotulo: 'Data' }),
      local: T('texto', { max: 80, rotulo: 'Local' }),
      destinatario: T('textoLongo', { max: 1000, rotulo: 'Para' }),
      remetente: T('textoLongo', { max: 400, rotulo: 'De' }),
      assunto: T('texto', { max: 300, rotulo: 'Assunto' }),
      referencia: T('texto', { max: 300, rotulo: 'Referência' }),
      titulo: T('texto', { max: 160, rotulo: 'Título' }),
      saudacao: T('texto', { max: 200, rotulo: 'Saudação' }),
      corpo: T('textoLongo', { max: 60000, rotulo: 'Texto' }),
      fecho: T('texto', { max: 200, rotulo: 'Fecho' }),
      assinaturas: T('json', { max: 4000, rotulo: 'Assinaturas' }),
      anexos: T('textoLongo', { max: 2000, rotulo: 'Anexos' }),
      projeto_id: T('ref', { prefixos: ['prj'], rotulo: 'Projeto' }),
      observacoes: T('textoLongo', { max: 4000, rotulo: 'Observações internas' }),
    },
    imutaveis: ['tipo'],
    padroes: { modelo: 'coluna', oficio: 0 },
    versoes: true,
    permissoes: { hub: 'E', vendas: 'L', projetos: 'L', maquina: 'E' },
    filtros: ['tipo', 'modelo', 'ano', 'projeto_id', 'codigo'],
    ordem: 'criado_em DESC',
    busca: (r) => ({ titulo: [r.codigo, r.assunto || r.titulo].filter(Boolean).join(' · '),
      partes: [r.codigo, r.assunto, r.titulo, r.destinatario, r.remetente, r.referencia] }),
  },
};

// Rotas da API → tabela. Pessoas sensíveis têm rota própria, pendurada na pessoa.
export const ROTAS = {
  organizacoes: 'organizacoes',
  pessoas: 'pessoas',
  'pessoas-sensiveis': 'pessoas_sensiveis',
  atuacoes: 'atuacoes',
  interacoes: 'interacoes',
  equipe: 'equipe',
  cargos: 'cargos',
  titulos: 'titulos',
  'ferramentas-textos': 'ferramentas_textos',
  empresa: 'empresa',
  sinteses: 'sinteses',
  arquivos: 'arquivos',
  vinculos: 'vinculos',
  revisoes: 'revisoes',
  oportunidades: 'oportunidades',
  propostas: 'propostas',
  contratos: 'contratos',
  projetos: 'projetos',
  'projetos-local': 'projetos_local',
  etapas: 'etapas',
  horas: 'horas',
  'bases-servicos': 'bases_servicos',
  'bases-categorias': 'bases_categorias',
  'bases-usos': 'bases_usos',
  'pgt-fases': 'pgt_fases',
  'pgt-etapas': 'pgt_etapas',
  'pgt-entregaveis': 'pgt_entregaveis',
  'pgt-eventos': 'pgt_eventos',
  'pgt-materiais': 'pgt_materiais',
  'pgt-modelos': 'pgt_modelos',
  documentos: 'documentos',
  'vendas-clausulas': 'vendas_clausulas',
  colecoes: 'colecoes',
  objetos: 'objetos',
  galeria: 'galeria',
  credenciais: 'credenciais',
};

export const COMUNS = ['id', 'criado_em', 'atualizado_em', 'criado_por', 'atualizado_por', 'versao', 'arquivado_em'];
