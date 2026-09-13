CREATE TABLE IF NOT EXISTS "payment_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL REFERENCES "institutions"("id") ON DELETE cascade,
  "provider" varchar(30) NOT NULL,
  "provider_order_id" varchar(128),
  "kind" varchar(30) NOT NULL,
  "catalog_code" varchar(40) NOT NULL,
  "snapshot" jsonb NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" varchar(3) NOT NULL,
  "status" varchar(30) DEFAULT 'created' NOT NULL,
  "captured_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_provider_order_key" ON "payment_orders" ("provider","provider_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_orders_institution_idx" ON "payment_orders" ("institution_id","created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(30) NOT NULL,
  "provider_event_id" varchar(128) NOT NULL,
  "event_type" varchar(100) NOT NULL,
  "payload" jsonb NOT NULL,
  "processed_at" timestamp with time zone,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_provider_event_key" ON "payment_events" ("provider","provider_event_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_entitlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL REFERENCES "institutions"("id") ON DELETE cascade,
  "provider" varchar(30) NOT NULL,
  "provider_subscription_id" varchar(128) NOT NULL,
  "plan_code" varchar(40) NOT NULL,
  "monthly_tsc" integer NOT NULL,
  "status" varchar(30) NOT NULL,
  "current_period_end" timestamp with time zone,
  "last_granted_period" varchar(30),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_entitlements_provider_subscription_key" ON "subscription_entitlements" ("provider","provider_subscription_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tsc_lots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL REFERENCES "institutions"("id") ON DELETE cascade,
  "source_type" varchar(40) NOT NULL,
  "source_id" varchar(128) NOT NULL,
  "total_tsc" integer NOT NULL,
  "remaining_tsc" integer NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tsc_lots_source_key" ON "tsc_lots" ("source_type","source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tsc_lots_fifo_idx" ON "tsc_lots" ("institution_id","expires_at");
--> statement-breakpoint
-- Existing credits are converted to TSC at two tokens per historic issuance unit.
INSERT INTO "tsc_lots" ("institution_id", "source_type", "source_id", "total_tsc", "remaining_tsc", "expires_at")
SELECT "institution_id", 'legacy_balance', "institution_id"::text, GREATEST(SUM("delta"), 0) * 2, GREATEST(SUM("delta"), 0) * 2, now() + interval '12 months'
FROM "credit_ledger"
GROUP BY "institution_id"
HAVING GREATEST(SUM("delta"), 0) > 0
ON CONFLICT ("source_type", "source_id") DO NOTHING;
