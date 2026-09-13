-- Portal de contenido token-gated (Unlock Protocol).
-- Tablas aditivas: ninguna tabla existente se modifica.

CREATE TABLE IF NOT EXISTS "portal_contents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL,
  "created_by" uuid,
  "slug" varchar(140) NOT NULL,
  "title" varchar(200) NOT NULL,
  "summary" text,
  "kind" varchar(20) NOT NULL,
  "lock_address" varchar(42) NOT NULL,
  "lock_chain_id" integer NOT NULL,
  "preview_key" text,
  "full_key" text NOT NULL,
  "preview_text" text,
  "preview_seconds" integer,
  "mime_type" varchar(120),
  "byte_size" bigint,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "portal_unlocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "content_id" uuid NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "user_id" uuid,
  "lock_address" varchar(42) NOT NULL,
  "lock_chain_id" integer NOT NULL,
  "key_expires_at" timestamp with time zone,
  "unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portal_contents" ADD CONSTRAINT "portal_contents_institution_id_institutions_id_fk"
   FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portal_contents" ADD CONSTRAINT "portal_contents_created_by_users_id_fk"
   FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portal_unlocks" ADD CONSTRAINT "portal_unlocks_content_id_portal_contents_id_fk"
   FOREIGN KEY ("content_id") REFERENCES "portal_contents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portal_unlocks" ADD CONSTRAINT "portal_unlocks_user_id_users_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "portal_contents_slug_key" ON "portal_contents" ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "portal_contents_institution_idx" ON "portal_contents" ("institution_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "portal_contents_lock_idx" ON "portal_contents" ("lock_address");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "portal_unlocks_content_idx" ON "portal_unlocks" ("content_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "portal_unlocks_wallet_idx" ON "portal_unlocks" ("wallet_address");
