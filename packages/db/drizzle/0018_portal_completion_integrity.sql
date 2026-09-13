-- Integridad del cierre del circulo del portal.
--
-- El indice de 0016 no impedia nada: incluia "completed_at", que es un
-- timestamp distinto en cada intento, asi que dos completaciones de la misma
-- wallet sobre el mismo contenido producian dos filas validas y, con ellas,
-- dos certificados. El indice correcto solo mira (content_id, wallet_address)
-- y unicamente sobre las filas que representan una completacion, para que los
-- desbloqueos (que si pueden repetirse) sigan registrandose libremente.

DROP INDEX IF EXISTS "portal_unlocks_completion_key";
--> statement-breakpoint

-- Una sola completacion por wallet y contenido. Es un indice parcial: las
-- filas de desbloqueo (completed_at NULL) quedan fuera y no compiten.
CREATE UNIQUE INDEX IF NOT EXISTS "portal_unlocks_completion_key"
  ON "portal_unlocks" ("content_id", "wallet_address")
  WHERE "completed_at" IS NOT NULL;
--> statement-breakpoint

-- El certificado emitido debe existir de verdad. Sin esta clave foranea una
-- credencial borrada dejaba el portal apuntando a un id fantasma.
DO $$ BEGIN
  ALTER TABLE "portal_unlocks"
    ADD CONSTRAINT "portal_unlocks_certificate_id_certificates_id_fk"
    FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "portal_unlocks_certificate_idx"
  ON "portal_unlocks" ("certificate_id");
