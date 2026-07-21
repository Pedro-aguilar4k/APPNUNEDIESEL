import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  integer,
  numeric,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core"

// ---------------------------------------------------------------------------
// Better Auth required tables
// Column names are camelCase to match Better Auth defaults. Do not rename.
// Extended with fields from the `username` and `admin` plugins.
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  // username plugin
  username: text("username").unique(),
  displayUsername: text("displayUsername"),
  // admin plugin
  role: text("role").default("estoquista"),
  banned: boolean("banned").default(false),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires"),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // admin plugin
  impersonatedBy: text("impersonatedBy"),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
})

// ---------------------------------------------------------------------------
// App tables (dados compartilhados pela equipe; acesso controlado por papel).
// Sem RLS: o controle de acesso e feito nas server actions via papel/permissao.
// `createdBy` guarda o id do usuario para auditoria.
// ---------------------------------------------------------------------------

export const produtos = pgTable(
  "produtos",
  {
    id: serial("id").primaryKey(),
    codigoInterno: text("codigo_interno").notNull(),
    descricao: text("descricao").notNull(),
    codigoBarras: text("codigo_barras"),
    fabricante: text("fabricante"),
    codigoFabricante: text("codigo_fabricante"),
    ncm: text("ncm"),
    unidade: text("unidade").default("UN"),
    precoCusto: numeric("preco_custo"),
    precoVenda: numeric("preco_venda"),
    estoqueAtual: integer("estoque_atual").default(0),
    localizacao: text("localizacao"),
    ativo: boolean("ativo").notNull().default(true),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    codigoInternoIdx: uniqueIndex("produtos_codigo_interno_idx").on(t.codigoInterno),
    codigoBarrasIdx: index("produtos_codigo_barras_idx").on(t.codigoBarras),
    codigoFabricanteIdx: index("produtos_codigo_fabricante_idx").on(t.codigoFabricante),
  }),
)

export const fornecedores = pgTable(
  "fornecedores",
  {
    id: serial("id").primaryKey(),
    cnpj: text("cnpj"),
    razaoSocial: text("razao_social").notNull(),
    nomeFantasia: text("nome_fantasia"),
    email: text("email"),
    telefone: text("telefone"),
    ativo: boolean("ativo").notNull().default(true),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    cnpjIdx: uniqueIndex("fornecedores_cnpj_idx").on(t.cnpj),
  }),
)

export const notas = pgTable(
  "notas",
  {
    id: serial("id").primaryKey(),
    chaveAcesso: text("chave_acesso"),
    numero: text("numero"),
    serie: text("serie"),
    fornecedorId: integer("fornecedor_id"),
    fornecedorCnpj: text("fornecedor_cnpj"),
    fornecedorNome: text("fornecedor_nome"),
    dataEmissao: timestamp("data_emissao"),
    valorTotal: numeric("valor_total"),
    status: text("status").notNull().default("pendente"), // pendente | em_conferencia | conferida | divergente
    origem: text("origem").notNull().default("manual"), // manual | xml | sefaz
    totalItens: integer("total_itens").default(0),
    itensConferidos: integer("itens_conferidos").default(0),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    conferidaEm: timestamp("conferida_em"),
  },
  (t) => ({
    chaveAcessoIdx: uniqueIndex("notas_chave_acesso_idx").on(t.chaveAcesso),
    statusIdx: index("notas_status_idx").on(t.status),
  }),
)

export const itensNota = pgTable(
  "itens_nota",
  {
    id: serial("id").primaryKey(),
    notaId: integer("nota_id").notNull(),
    codigoFornecedor: text("codigo_fornecedor"),
    descricaoFornecedor: text("descricao_fornecedor"),
    ean: text("ean"),
    ncm: text("ncm"),
    quantidade: numeric("quantidade").notNull().default("0"),
    unidade: text("unidade"),
    valorUnitario: numeric("valor_unitario"),
    valorTotal: numeric("valor_total"),
    produtoId: integer("produto_id"),
    matchTipo: text("match_tipo").default("none"), // ean | equivalencia | fabricante | similaridade | manual | none
    matchScore: real("match_score").default(0),
    statusConferencia: text("status_conferencia").notNull().default("pendente"), // pendente | conferido | divergente | nao_encontrado
    quantidadeConferida: numeric("quantidade_conferida").default("0"),
    // Definido na vinculação:
    devolucao: boolean("devolucao").notNull().default(false), // peça é devolução
    compradorId: text("comprador_id"), // usuário (papel comprador) para quem entregar
    compradorNome: text("comprador_nome"), // nome denormalizado para exibição rápida
    quantidadeOriginal: numeric("quantidade_original"), // qtd original da NF-e (quando alterada)
    justificativaQuantidade: text("justificativa_quantidade"), // obrigatória ao alterar a qtd
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    notaIdIdx: index("itens_nota_nota_id_idx").on(t.notaId),
    eanIdx: index("itens_nota_ean_idx").on(t.ean),
  }),
)

// Equivalencia aprendida: codigo do fornecedor -> produto interno.
export const equivalenciaProdutos = pgTable(
  "equivalencia_produtos",
  {
    id: serial("id").primaryKey(),
    produtoId: integer("produto_id").notNull(),
    fornecedorId: integer("fornecedor_id"),
    fornecedorCnpj: text("fornecedor_cnpj"),
    codigoFornecedor: text("codigo_fornecedor"),
    descricaoFornecedor: text("descricao_fornecedor"),
    ean: text("ean"),
    vezesUsado: integer("vezes_usado").notNull().default(1),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    fornCodIdx: uniqueIndex("equiv_forn_cod_idx").on(t.fornecedorCnpj, t.codigoFornecedor),
    produtoIdIdx: index("equiv_produto_id_idx").on(t.produtoId),
  }),
)

// Historico de aprendizado do matching.
export const historicoAprendizado = pgTable("historico_aprendizado", {
  id: serial("id").primaryKey(),
  itemNotaId: integer("item_nota_id"),
  produtoId: integer("produto_id"),
  descricaoFornecedor: text("descricao_fornecedor"),
  codigoFornecedor: text("codigo_fornecedor"),
  ean: text("ean"),
  acao: text("acao"), // confirmado | rejeitado | vinculado
  score: real("score"),
  usuarioId: text("usuario_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Historico de leituras durante a conferencia (scan de codigo de barras).
export const historicoLeituras = pgTable(
  "historico_leituras",
  {
    id: serial("id").primaryKey(),
    notaId: integer("nota_id"),
    itemNotaId: integer("item_nota_id"),
    produtoId: integer("produto_id"),
    codigoLido: text("codigo_lido"),
    resultado: text("resultado"), // encontrado | nao_pertence | desconhecido | produto_errado | ja_conferido
    quantidade: numeric("quantidade"),
    scanUuid: text("scan_uuid"),
    usuarioId: text("usuario_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    notaScanIdx: uniqueIndex("historico_leituras_nota_scan_idx").on(t.notaId, t.scanUuid),
  }),
)

// Relatorio de conferencia gerado ao finalizar a nota. O conteudo em texto e
// a fonte de verdade; o PDF de impressao e reconstruido a partir dele.
export const relatoriosConferencia = pgTable(
  "relatorios_conferencia",
  {
    id: serial("id").primaryKey(),
    notaId: integer("nota_id").notNull(),
    numeroNota: text("numero_nota"),
    fornecedorNome: text("fornecedor_nome"),
    estoquista: text("estoquista").notNull(),
    status: text("status").notNull(), // conferida | divergente
    totalItens: integer("total_itens").notNull().default(0),
    itensConferidos: integer("itens_conferidos").notNull().default(0),
    itensDivergentes: integer("itens_divergentes").notNull().default(0),
    conteudoTxt: text("conteudo_txt").notNull(),
    createdBy: text("created_by"),
    createdByNome: text("created_by_nome"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    notaIdIdx: index("relatorios_conferencia_nota_id_idx").on(t.notaId),
  }),
)

// Solicitacoes de garantia abertas pelos vendedores. Espelha o formulario fisico
// "Solicitacao de Garantia" da Nune Diesel. O vendedor abre o ticket; a equipe
// interna acompanha e move entre os status no board de /estoque/garantia.
export const garantias = pgTable(
  "garantias",
  {
    id: serial("id").primaryKey(),
    protocolo: text("protocolo").notNull(), // ex.: GAR-000123
    // Dono do ticket (quem abriu = vendedor). Escopo de "Minhas garantias".
    vendedorId: text("vendedor_id"),
    vendedorNome: text("vendedor_nome"),
    status: text("status").notNull().default("pendente"), // pendente | em_analise | enviado | esperando_retorno
    // Dados do cliente
    clienteNome: text("cliente_nome").notNull(),
    clienteContato: text("cliente_contato"),
    clienteFone: text("cliente_fone"),
    clienteEmail: text("cliente_email"),
    notaNumero: text("nota_numero"),
    dataCompra: text("data_compra"),
    loja: text("loja"), // Sama | Laguna | Matrix
    // Dados do produto
    pecaNumero: text("peca_numero"),
    produtoDescricao: text("produto_descricao").notNull(),
    pecaMarca: text("peca_marca"),
    veiculo: text("veiculo"),
    anoModelo: text("ano_modelo"),
    motor: text("motor"),
    produtoId: integer("produto_id"),
    // Informacoes de uso
    kmInicial: text("km_inicial"),
    kmDefeito: text("km_defeito"),
    kmRodado: text("km_rodado"),
    horasRodadas: text("horas_rodadas"),
    dataAplicacao: text("data_aplicacao"),
    dataDefeito: text("data_defeito"),
    // Defeito
    descricaoDefeito: text("descricao_defeito").notNull(),
    // Uso interno
    analiseTecnica: text("analise_tecnica"),
    resultado: text("resultado"), // aprovado | reprovado | null
    observacaoInterna: text("observacao_interna"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    protocoloIdx: uniqueIndex("garantias_protocolo_idx").on(t.protocolo),
    vendedorIdx: index("garantias_vendedor_id_idx").on(t.vendedorId),
    statusIdx: index("garantias_status_idx").on(t.status),
  }),
)

// "Espera": pulmao/overflow do estoque. Itens que nao couberam na locacao normal
// e ficam guardados em boxes. O total em UNIDADES e a fonte da verdade; caixa/pacote
// e apenas a forma de guardar/exibir. Ao remover unidades, as caixas/pacotes se
// recalculam (ceil). Codigo e texto livre e NAO vira produto cadastrado; a descricao
// e apenas puxada do cadastro quando o codigo casa. Cada item tem 1 box primario e,
// opcionalmente, 1 secundario. Remocao do registro so quando o total zera.
export const esperaItens = pgTable(
  "espera_itens",
  {
    id: serial("id").primaryKey(),
    codigoInterno: text("codigo_interno").notNull(),
    descricao: text("descricao"), // puxada do cadastro de produtos, se existir
    // Embalagem padrao para exibicao
    tipo: text("tipo").notNull().default("unidade"), // unidade | pacote | caixa
    unidadesPorEmbalagem: integer("unidades_por_embalagem").notNull().default(1),
    // Fonte da verdade: saldo total em unidades
    totalUnidades: integer("total_unidades").notNull().default(0),
    // Localizacao na espera
    boxPrimario: text("box_primario").notNull(),
    boxSecundario: text("box_secundario"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    codigoIdx: uniqueIndex("espera_itens_codigo_idx").on(t.codigoInterno),
    boxIdx: index("espera_itens_box_idx").on(t.boxPrimario),
  }),
)
