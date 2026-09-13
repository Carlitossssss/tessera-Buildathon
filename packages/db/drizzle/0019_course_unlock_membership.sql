-- Membresia Unlock como capa de acceso de los cursos (parte 1: columnas).
--
-- El catalogo ya tenia "public_paid", pero sin ninguna via de pago: el curso
-- se listaba y no habia forma de comprarlo. Unlock cubre exactamente ese
-- hueco, y lo hace en el punto que decide de verdad, la matricula: el
-- contenido de un curso vive detras de una fila de "enrollments", asi que
-- quien controla la matricula controla el acceso.
--
-- El valor 'token_gated' del enum se añade aqui, pero NO se puede usar en la
-- misma transaccion que lo crea (Postgres: "New enum values must be committed
-- before they can be used"). Por eso el CHECK que lo referencia vive en la
-- migracion 0020, que corre en una transaccion posterior.
--
-- Todo es aditivo. Ningun curso existente cambia de comportamiento: los que no
-- declaren Lock siguen exactamente igual.

ALTER TYPE "course_visibility" ADD VALUE IF NOT EXISTS 'token_gated';
--> statement-breakpoint

-- Lock que abre el curso y red donde vive. Se guardan por curso --no
-- globalmente-- para que cada institucion use su propio Lock y su propio
-- precio, igual que en el portal de contenido.
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "lock_address" varchar(42);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "lock_chain_id" integer;
--> statement-breakpoint

-- Previsualizacion: cuantos modulos se pueden ver sin llave. El bounty exige
-- que el visitante pruebe una parte antes de decidir. 0 = nada abierto.
ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "preview_module_count" integer NOT NULL DEFAULT 1;
--> statement-breakpoint

-- Localiza rapido los cursos de un Lock al pintar el catalogo.
CREATE INDEX IF NOT EXISTS "courses_lock_idx" ON "courses" ("lock_address");
--> statement-breakpoint

-- Trazabilidad de la matricula por membresia: que wallet presento la llave y
-- cuando expiraba. Es auditoria, nunca la fuente de autorizacion --esa es
-- siempre el Lock on-chain-- pero permite demostrar despues por que se
-- concedio el acceso.
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "unlock_wallet" varchar(42);
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "unlock_lock_address" varchar(42);
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "unlock_chain_id" integer;
--> statement-breakpoint
ALTER TABLE "enrollments"
  ADD COLUMN IF NOT EXISTS "unlock_key_expires_at" timestamp with time zone;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "enrollments_unlock_wallet_idx"
  ON "enrollments" ("unlock_wallet");
