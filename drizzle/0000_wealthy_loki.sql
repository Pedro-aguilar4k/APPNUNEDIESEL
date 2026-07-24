CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoria_contagens" (
	"id" serial PRIMARY KEY NOT NULL,
	"auditoria_id" integer NOT NULL,
	"codigo" text NOT NULL,
	"andar" text NOT NULL,
	"rua" text NOT NULL,
	"box" text NOT NULL,
	"localizacao_full" text NOT NULL,
	"quantidade" numeric DEFAULT '0' NOT NULL,
	"observacao" text,
	"created_by" text,
	"created_by_nome" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoria_estoque_oficial" (
	"id" serial PRIMARY KEY NOT NULL,
	"auditoria_id" integer NOT NULL,
	"codigo" text NOT NULL,
	"descricao" text,
	"quantidade_sistema" numeric DEFAULT '0' NOT NULL,
	"localizacao_principal" text
);
--> statement-breakpoint
CREATE TABLE "auditoria_relatorios" (
	"id" serial PRIMARY KEY NOT NULL,
	"auditoria_id" integer NOT NULL,
	"resumo_json" jsonb NOT NULL,
	"created_by" text,
	"created_by_nome" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"status" text DEFAULT 'em_andamento' NOT NULL,
	"created_by" text,
	"created_by_nome" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finalizada_em" timestamp
);
--> statement-breakpoint
CREATE TABLE "equivalencia_produtos" (
	"id" serial PRIMARY KEY NOT NULL,
	"produto_id" integer NOT NULL,
	"fornecedor_id" integer,
	"fornecedor_cnpj" text,
	"codigo_fornecedor" text,
	"descricao_fornecedor" text,
	"ean" text,
	"vezes_usado" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "espera_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo_interno" text NOT NULL,
	"descricao" text,
	"tipo" text DEFAULT 'unidade' NOT NULL,
	"unidades_por_embalagem" integer DEFAULT 1 NOT NULL,
	"total_unidades" integer DEFAULT 0 NOT NULL,
	"box_primario" text NOT NULL,
	"box_secundario" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fornecedores" (
	"id" serial PRIMARY KEY NOT NULL,
	"cnpj" text,
	"razao_social" text NOT NULL,
	"nome_fantasia" text,
	"email" text,
	"telefone" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garantia_rejeicoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendedor_id" text,
	"protocolo" text NOT NULL,
	"produto_descricao" text,
	"cliente_nome" text,
	"motivo" text NOT NULL,
	"etapa" text,
	"dados_originais" jsonb NOT NULL,
	"reaberta" boolean DEFAULT false NOT NULL,
	"rejeitada_em" timestamp DEFAULT now() NOT NULL,
	"expira_em" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garantias" (
	"id" serial PRIMARY KEY NOT NULL,
	"protocolo" text NOT NULL,
	"vendedor_id" text,
	"vendedor_nome" text,
	"status" text DEFAULT 'pendente' NOT NULL,
	"cliente_nome" text NOT NULL,
	"cliente_contato" text,
	"cliente_fone" text,
	"cliente_email" text,
	"nota_numero" text,
	"data_compra" text,
	"loja" text,
	"peca_numero" text,
	"produto_descricao" text NOT NULL,
	"peca_marca" text,
	"veiculo" text,
	"ano_modelo" text,
	"motor" text,
	"produto_id" integer,
	"km_inicial" text,
	"km_defeito" text,
	"km_rodado" text,
	"horas_rodadas" text,
	"data_aplicacao" text,
	"data_defeito" text,
	"descricao_defeito" text NOT NULL,
	"analise_tecnica" text,
	"resultado" text,
	"observacao_interna" text,
	"prazo_garantia" text,
	"prazo_validado" boolean DEFAULT false NOT NULL,
	"nfg_numero" text,
	"numero_orcamento" text,
	"transportadora_nome" text,
	"data_envio" text,
	"frete_conta" text,
	"envio_cadastrado" boolean DEFAULT false NOT NULL,
	"nota_entrada" text,
	"procedencia" text,
	"tipo_retorno" text,
	"concluido_em" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historico_aprendizado" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_nota_id" integer,
	"produto_id" integer,
	"descricao_fornecedor" text,
	"codigo_fornecedor" text,
	"ean" text,
	"acao" text,
	"score" real,
	"usuario_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historico_leituras" (
	"id" serial PRIMARY KEY NOT NULL,
	"nota_id" integer,
	"item_nota_id" integer,
	"produto_id" integer,
	"codigo_lido" text,
	"resultado" text,
	"quantidade" numeric,
	"scan_uuid" text,
	"usuario_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itens_nota" (
	"id" serial PRIMARY KEY NOT NULL,
	"nota_id" integer NOT NULL,
	"codigo_fornecedor" text,
	"descricao_fornecedor" text,
	"ean" text,
	"ncm" text,
	"quantidade" numeric DEFAULT '0' NOT NULL,
	"unidade" text,
	"valor_unitario" numeric,
	"valor_total" numeric,
	"icms" numeric,
	"ipi" numeric,
	"impostos" numeric,
	"produto_id" integer,
	"match_tipo" text DEFAULT 'none',
	"match_score" real DEFAULT 0,
	"status_conferencia" text DEFAULT 'pendente' NOT NULL,
	"quantidade_conferida" numeric DEFAULT '0',
	"devolucao" boolean DEFAULT false NOT NULL,
	"comprador_id" text,
	"comprador_nome" text,
	"quantidade_original" numeric,
	"justificativa_quantidade" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_nome" text,
	"area" text NOT NULL,
	"acao" text NOT NULL,
	"detalhe" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modulos_controle" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"colunas" jsonb NOT NULL,
	"linhas" jsonb NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_by_nome" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notas" (
	"id" serial PRIMARY KEY NOT NULL,
	"chave_acesso" text,
	"numero" text,
	"serie" text,
	"fornecedor_id" integer,
	"fornecedor_cnpj" text,
	"fornecedor_nome" text,
	"data_emissao" timestamp,
	"valor_total" numeric,
	"status" text DEFAULT 'pendente' NOT NULL,
	"origem" text DEFAULT 'manual' NOT NULL,
	"total_itens" integer DEFAULT 0,
	"itens_conferidos" integer DEFAULT 0,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"conferida_em" timestamp
);
--> statement-breakpoint
CREATE TABLE "preferencias_usuario" (
	"user_id" text PRIMARY KEY NOT NULL,
	"notif_estoque_baixo" boolean DEFAULT true NOT NULL,
	"notif_nova_garantia" boolean DEFAULT true NOT NULL,
	"notif_resumo_diario" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo_interno" text NOT NULL,
	"descricao" text NOT NULL,
	"codigo_barras" text,
	"fabricante" text,
	"codigo_fabricante" text,
	"ncm" text,
	"unidade" text DEFAULT 'UN',
	"preco_custo" numeric,
	"preco_venda" numeric,
	"estoque_atual" integer DEFAULT 0,
	"localizacao" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relatorios_conferencia" (
	"id" serial PRIMARY KEY NOT NULL,
	"nota_id" integer NOT NULL,
	"numero_nota" text,
	"fornecedor_nome" text,
	"estoquista" text NOT NULL,
	"status" text NOT NULL,
	"total_itens" integer DEFAULT 0 NOT NULL,
	"itens_conferidos" integer DEFAULT 0 NOT NULL,
	"itens_divergentes" integer DEFAULT 0 NOT NULL,
	"conteudo_txt" text NOT NULL,
	"dados_json" jsonb,
	"created_by" text,
	"created_by_nome" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"impersonatedBy" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"username" text,
	"displayUsername" text,
	"role" text DEFAULT 'estoquista',
	"banned" boolean DEFAULT false,
	"banReason" text,
	"banExpires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria_contagens" ADD CONSTRAINT "auditoria_contagens_auditoria_id_auditorias_id_fk" FOREIGN KEY ("auditoria_id") REFERENCES "public"."auditorias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria_estoque_oficial" ADD CONSTRAINT "auditoria_estoque_oficial_auditoria_id_auditorias_id_fk" FOREIGN KEY ("auditoria_id") REFERENCES "public"."auditorias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria_relatorios" ADD CONSTRAINT "auditoria_relatorios_auditoria_id_auditorias_id_fk" FOREIGN KEY ("auditoria_id") REFERENCES "public"."auditorias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferencias_usuario" ADD CONSTRAINT "preferencias_usuario_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_contagens_auditoria_idx" ON "auditoria_contagens" USING btree ("auditoria_id");--> statement-breakpoint
CREATE INDEX "auditoria_contagens_codigo_idx" ON "auditoria_contagens" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "auditoria_oficial_auditoria_idx" ON "auditoria_estoque_oficial" USING btree ("auditoria_id");--> statement-breakpoint
CREATE INDEX "auditoria_oficial_codigo_idx" ON "auditoria_estoque_oficial" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "auditoria_relatorios_auditoria_idx" ON "auditoria_relatorios" USING btree ("auditoria_id");--> statement-breakpoint
CREATE INDEX "auditorias_status_idx" ON "auditorias" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "equiv_forn_cod_idx" ON "equivalencia_produtos" USING btree ("fornecedor_cnpj","codigo_fornecedor");--> statement-breakpoint
CREATE INDEX "equiv_produto_id_idx" ON "equivalencia_produtos" USING btree ("produto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "espera_itens_codigo_idx" ON "espera_itens" USING btree ("codigo_interno");--> statement-breakpoint
CREATE INDEX "espera_itens_box_idx" ON "espera_itens" USING btree ("box_primario");--> statement-breakpoint
CREATE UNIQUE INDEX "fornecedores_cnpj_idx" ON "fornecedores" USING btree ("cnpj");--> statement-breakpoint
CREATE INDEX "garantia_rejeicoes_vendedor_id_idx" ON "garantia_rejeicoes" USING btree ("vendedor_id");--> statement-breakpoint
CREATE INDEX "garantia_rejeicoes_expira_em_idx" ON "garantia_rejeicoes" USING btree ("expira_em");--> statement-breakpoint
CREATE UNIQUE INDEX "garantias_protocolo_idx" ON "garantias" USING btree ("protocolo");--> statement-breakpoint
CREATE INDEX "garantias_vendedor_id_idx" ON "garantias" USING btree ("vendedor_id");--> statement-breakpoint
CREATE INDEX "garantias_status_idx" ON "garantias" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "historico_leituras_nota_scan_idx" ON "historico_leituras" USING btree ("nota_id","scan_uuid");--> statement-breakpoint
CREATE INDEX "itens_nota_nota_id_idx" ON "itens_nota" USING btree ("nota_id");--> statement-breakpoint
CREATE INDEX "itens_nota_ean_idx" ON "itens_nota" USING btree ("ean");--> statement-breakpoint
CREATE INDEX "logs_area_idx" ON "logs" USING btree ("area");--> statement-breakpoint
CREATE INDEX "logs_created_idx" ON "logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "modulos_controle_ordem_idx" ON "modulos_controle" USING btree ("ordem");--> statement-breakpoint
CREATE UNIQUE INDEX "notas_chave_acesso_idx" ON "notas" USING btree ("chave_acesso");--> statement-breakpoint
CREATE INDEX "notas_status_idx" ON "notas" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "produtos_codigo_interno_idx" ON "produtos" USING btree ("codigo_interno");--> statement-breakpoint
CREATE INDEX "produtos_codigo_barras_idx" ON "produtos" USING btree ("codigo_barras");--> statement-breakpoint
CREATE INDEX "produtos_codigo_fabricante_idx" ON "produtos" USING btree ("codigo_fabricante");--> statement-breakpoint
CREATE INDEX "relatorios_conferencia_nota_id_idx" ON "relatorios_conferencia" USING btree ("nota_id");