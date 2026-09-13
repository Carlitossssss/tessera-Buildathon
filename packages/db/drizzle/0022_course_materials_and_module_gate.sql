-- Material academico y membresia por modulo, dentro de los cursos.
--
-- El portal de contenido vivia como una seccion aparte que competia con los
-- cursos y nunca se uso (0 piezas publicadas). El material academico pertenece
-- al curso: un video de clase es parte de un temario, no una publicacion
-- suelta en otra ventana.
--
-- Esta migracion mueve esa capacidad adentro:
--   1. Un temario puede tener un archivo (video, audio, PDF) con muestra.
--   2. Un modulo puede exigir su propia llave de Unlock para material premium.
--
-- El "combo" que habilita: pagas la entrada al curso (lock del curso, ya
-- existente) o desbloqueas material extra dentro de un curso gratuito (lock
-- del modulo). Ambos niveles conviven.

-- ── 1. Material del temario ───────────────────────────────────────────────

-- Claves en el object storage. El preview es un archivo fisico distinto,
-- recortado al subir: el original nunca se sirve sin autorizacion, asi que no
-- hay forma de saltarse el pago desde el navegador.
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "asset_key" text;
--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "asset_preview_key" text;
--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "asset_mime_type" varchar(120);
--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "asset_byte_size" bigint;
--> statement-breakpoint
-- Segundos de muestra en audio y video; nulo para PDF y texto.
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "asset_preview_seconds" integer;
--> statement-breakpoint

-- ── 2. Membresia por modulo ───────────────────────────────────────────────

-- Lock que desbloquea ESTE modulo, independiente del lock del curso. Permite
-- que un curso gratuito venda material avanzado, o que un modulo concreto
-- tenga su propio precio.
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "lock_address" varchar(42);
--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "lock_chain_id" integer;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "modules_lock_idx" ON "modules" ("lock_address");
--> statement-breakpoint

-- Una direccion sin red --o al reves-- no permite construir un checkout ni
-- consultar el Lock: el modulo quedaria cerrado sin forma de abrirlo.
DO $$ BEGIN
  ALTER TABLE "modules" ADD CONSTRAINT "modules_lock_complete"
    CHECK (
      ("lock_address" IS NULL AND "lock_chain_id" IS NULL)
      OR ("lock_address" IS NOT NULL AND "lock_chain_id" IS NOT NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- ── 3. Trazabilidad de desbloqueos de modulo ──────────────────────────────
--
-- Es auditoria, nunca la fuente de autorizacion: el acceso se comprueba contra
-- el Lock on-chain en cada intento, de modo que una fila aqui no concede nada
-- por si sola. Sirve para saber quien abrio que y con que llave.

CREATE TABLE IF NOT EXISTS "module_unlocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "module_id" uuid NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "user_id" uuid,
  "lock_address" varchar(42) NOT NULL,
  "lock_chain_id" integer NOT NULL,
  "key_expires_at" timestamp with time zone,
  "unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "module_unlocks"
    ADD CONSTRAINT "module_unlocks_module_id_modules_id_fk"
    FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "module_unlocks"
    ADD CONSTRAINT "module_unlocks_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "module_unlocks_module_idx" ON "module_unlocks" ("module_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "module_unlocks_wallet_idx" ON "module_unlocks" ("wallet_address");
