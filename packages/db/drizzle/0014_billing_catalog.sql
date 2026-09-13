CREATE TABLE IF NOT EXISTS "billing_plans" (
  "code" varchar(40) PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text NOT NULL,
  "monthly_tsc" integer NOT NULL,
  "monthly_price_cents" integer NOT NULL,
  "launch_discount_bps" integer DEFAULT 0 NOT NULL,
  "extra_tsc_price_milli_cents" integer NOT NULL,
  "minimum_commitment_months" integer DEFAULT 12 NOT NULL,
  "pricing_version" varchar(80) DEFAULT '2026-launch-v1' NOT NULL,
  "active" integer DEFAULT 1 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_plans_sort_idx" ON "billing_plans" ("sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_tsc_packages" (
  "code" varchar(40) PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "tsc" integer NOT NULL,
  "price_cents" integer NOT NULL,
  "discount_bps" integer DEFAULT 0 NOT NULL,
  "validity_months" integer DEFAULT 12 NOT NULL,
  "pricing_version" varchar(80) DEFAULT '2026-launch-v1' NOT NULL,
  "currency" varchar(3) DEFAULT 'USD' NOT NULL,
  "active" integer DEFAULT 1 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_tsc_packages_sort_idx" ON "billing_tsc_packages" ("sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_settings" (
  "key" varchar(80) PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "nominal_value_cents" integer;
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "amount_paid_cents" integer;
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "discount_cents" integer;
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "discount_bps" integer;
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "pricing_version" varchar(80);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "certificate_cost_tsc" integer;
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "balance_before" integer;
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "balance_after" integer;
--> statement-breakpoint
ALTER TABLE "tsc_lots" ADD COLUMN IF NOT EXISTS "nominal_value_cents" integer;
--> statement-breakpoint
ALTER TABLE "tsc_lots" ADD COLUMN IF NOT EXISTS "amount_paid_cents" integer;
--> statement-breakpoint
ALTER TABLE "tsc_lots" ADD COLUMN IF NOT EXISTS "discount_cents" integer;
--> statement-breakpoint
ALTER TABLE "tsc_lots" ADD COLUMN IF NOT EXISTS "discount_bps" integer;
--> statement-breakpoint
ALTER TABLE "tsc_lots" ADD COLUMN IF NOT EXISTS "pricing_version" varchar(80);
--> statement-breakpoint
ALTER TABLE "tsc_lots" ADD COLUMN IF NOT EXISTS "certificate_cost_tsc" integer;
--> statement-breakpoint
INSERT INTO "billing_plans" (
  "code", "name", "description", "monthly_tsc", "monthly_price_cents", "launch_discount_bps",
  "extra_tsc_price_milli_cents", "minimum_commitment_months", "pricing_version", "active", "sort_order"
)
VALUES
  ('essential', 'Essential', 'Para equipos que inician su operación.', 200, 20000, 5000, 75000, 12, '2026-launch-v1', 1, 10),
  ('growth', 'Growth', 'Para academias en crecimiento y bootcamps.', 500, 50000, 5500, 70000, 12, '2026-launch-v1', 1, 20),
  ('institutional', 'Institutional', 'Para instituciones con operación consolidada.', 1000, 100000, 6000, 62500, 12, '2026-launch-v1', 1, 30),
  ('scale', 'Scale', 'Para operaciones de emisión de alto volumen.', 2000, 200000, 6500, 55000, 12, '2026-launch-v1', 1, 40),
  ('enterprise', 'Enterprise', 'Para acuerdos de alto volumen con condiciones contractuales.', 5000, 500000, 7000, 45000, 12, '2026-launch-v1', 0, 50)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "billing_tsc_packages" (
  "code", "name", "tsc", "price_cents", "discount_bps", "validity_months", "pricing_version",
  "currency", "active", "sort_order"
)
VALUES
  ('initial', 'Inicial', 200, 20000, 1000, 12, '2026-launch-v1', 'USD', 1, 10),
  ('growth', 'Crecimiento', 500, 50000, 1500, 12, '2026-launch-v1', 'USD', 1, 20),
  ('institutional', 'Institucional', 1000, 100000, 2000, 12, '2026-launch-v1', 'USD', 1, 30),
  ('scale', 'Escala', 2000, 200000, 2500, 12, '2026-launch-v1', 'USD', 1, 40),
  ('enterprise', 'Enterprise', 5000, 500000, 3000, 12, '2026-launch-v1', 'USD', 0, 50)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "billing_settings" ("key", "value")
VALUES
  ('certificate_tsc_cost', '{"tsc":2}'::jsonb),
  ('tsc_nominal_value_cents', '{"cents":100}'::jsonb),
  ('continuity_reserve_cents', '{"cents":10}'::jsonb),
  ('package_validity_months', '{"months":12}'::jsonb),
  ('pricing_version', '{"version":"2026-launch-v1"}'::jsonb)
ON CONFLICT ("key") DO NOTHING;
