// Esquema da API de dados: o que cada tabela aceita e quem pode ver ou editar.
// Espelha dados/migracoes/*.sql — mudou a migração, muda aqui também.
//
// Permissões por ferramenta: 'E' edita, 'L' lê, ausente = não vê.
// `campos_restritos`: ferramenta que só enxerga alguns campos (ex.: marketing vê só o nome).

const T = (tipo, extra = {}) => ({ tipo, ...extra });
const PAPEIS_ATUACAO = ['atendente', 'vendedor', 'representante', 'socio', 'funcionario', 'contato'];

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
};

// Ferramentas que podem chamar a API. 'hub' = o próprio Universo (senha da equipe);
// 'maquina' = rotinas do GitHub Actions (token próprio).
export const FERRAMENTAS = ['hub', 'vendas', 'projetos', 'fornecedores', 'marketing', 'maquina'];

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

const TODOS_E = { hub: 'E', vendas: 'E', projetos: 'E', fornecedores: 'E', marketing: 'E', maquina: 'E' };

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
    permissoes: { hub: 'E', vendas: 'E', projetos: 'L', fornecedores: 'E', marketing: 'L', maquina: 'E' },
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
    permissoes: { hub: 'E', vendas: 'E', projetos: 'L', fornecedores: 'E', marketing: 'L', maquina: 'E' },
    campos_restritos: { marketing: ['nome'] },
    filtros: ['email'],
    ordem: 'nome',
    busca: (r) => ({ titulo: r.nome, partes: [r.nome, r.apelido, r.email, r.telefone, r.whatsapp, r.instagram] }),
    duplicados: ['email', 'telefone', 'whatsapp'],
  },

  // Restrita: só o vendas. Mesmo id da pessoa. Nunca entra na busca nem no histórico com valor.
  pessoas_sensiveis: {
    prefixo: 'pes',
    id_da_tabela: 'pessoas',
    sensivel: true,
    campos: {
      cpf: T('cpf', { rotulo: 'CPF' }),
      rg: T('texto', { max: 30, rotulo: 'RG' }),
      nascimento: T('data', { rotulo: 'Nascimento' }),
      logradouro: T('texto', { max: 160, rotulo: 'Logradouro' }),
      numero: T('texto', { max: 20, rotulo: 'Número' }),
      complemento: T('texto', { max: 80, rotulo: 'Complemento' }),
      bairro: T('texto', { max: 80, rotulo: 'Bairro' }),
      cidade: T('texto', { max: 80, rotulo: 'Cidade' }),
      uf: T('uf', { rotulo: 'UF' }),
      cep: T('cep', { rotulo: 'CEP' }),
    },
    permissoes: { vendas: 'E' },
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
    permissoes: { hub: 'E', vendas: 'E', projetos: 'L', fornecedores: 'E', maquina: 'E' },
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

  equipe: {
    prefixo: 'eqp',
    campos: {
      pessoa_id: T('ref', { obrig: true, prefixos: ['pes'], rotulo: 'Pessoa' }),
      papel: T('lista', { obrig: true, valores: ['socio', 'arquiteto', 'estagiario', 'colaborador'], rotulo: 'Papel' }),
      ativo: T('sn', { rotulo: 'Ativo' }),
      custo_hora: T('centavos', { rotulo: 'Custo por hora' }),
    },
    imutaveis: ['pessoa_id'],
    padroes: { ativo: 1 },
    permissoes: { hub: 'E', projetos: 'E', maquina: 'E' },
    filtros: ['papel', 'ativo'],
    ordem: 'criado_em',
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
      dono_id: T('ref', { prefixos: ['ppt', 'ctr', 'cot', 'ped', 'prj', 'opo', 'org', 'pes'], rotulo: 'Documento de' }),
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
    },
    // variantes é preenchido pela API ao receber o conteúdo; não vem do formulário
    imutaveis: ['sha256', 'tipo_mime', 'categoria'],
    padroes: { visivel_cliente: 0 },
    permissoes: TODOS_E,
    filtros: ['dono_id', 'categoria', 'sha256'],
    ordem: 'criado_em DESC',
    busca: (r) => ({ titulo: r.nome_original, partes: [r.nome_original, r.legenda, r.texto_alternativo, r.credito] }),
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
    permissoes: COMERCIAL,
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
      data: T('data', { obrig: true, rotulo: 'Dia' }),
      minutos: T('inteiro', { obrig: true, min: 1, max: 1440, rotulo: 'Duração (minutos)' }),
      descricao: T('textoLongo', { max: 2000, rotulo: 'O que foi feito' }),
    },
    permissoes: { hub: 'L', projetos: 'E', maquina: 'E' },
    filtros: ['equipe_id', 'projeto_id', 'etapa_id', 'data'],
    ordem: 'data DESC, criado_em DESC',
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
};

export const COMUNS = ['id', 'criado_em', 'atualizado_em', 'criado_por', 'atualizado_por', 'versao', 'arquivado_em'];
