-- Cierre del circulo: completar el contenido del portal emite un certificado
-- soulbound verificable. Columnas aditivas sobre las tablas del portal.

ALTER TABLE "portal_contents" ADD COLUMN IF NOT EXISTS "certifies_achievement" varchar(200);
--> statement-breakpoint
ALTER TABLE "portal_unlocks" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "portal_unlocks" ADD COLUMN IF NOT EXISTS "certificate_id" uuid;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "portal_unlocks_completion_key"
  ON "portal_unlocks" ("content_id", "wallet_address", "completed_at");
