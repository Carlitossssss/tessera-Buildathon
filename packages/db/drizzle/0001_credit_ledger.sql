CREATE TABLE IF NOT EXISTS "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" varchar(40) NOT NULL,
	"reference_type" varchar(40),
	"reference_id" varchar(120),
	"paddle_transaction_id" varchar(100),
	"bundle_code" varchar(40),
	"unit_cost_cents" integer,
	"currency" varchar(3),
	"note" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_institution_id_institutions_id_fk"
   FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_ledger_institution_idx" ON "credit_ledger" ("institution_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_ledger_paddle_tx_unique"
  ON "credit_ledger" ("paddle_transaction_id")
  WHERE "paddle_transaction_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_ledger_emit_unique"
  ON "credit_ledger" ("reference_type","reference_id")
  WHERE "reference_type" = 'certificate';
