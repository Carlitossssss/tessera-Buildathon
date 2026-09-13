CREATE TABLE IF NOT EXISTS "admin_alert_resolutions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "alert_id" varchar(260) NOT NULL,
  "resolved_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "note" text,
  "resolved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admin_alert_resolutions_alert_id_key" ON "admin_alert_resolutions" ("alert_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_alert_resolutions_resolved_at_idx" ON "admin_alert_resolutions" ("resolved_at");
