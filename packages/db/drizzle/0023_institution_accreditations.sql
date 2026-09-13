-- Acreditacion institucional on-chain, por red.
--
-- Aprobar una institucion ya la registraba en TesseraRegistry de la red
-- principal (Amoy), pero ese hecho vivia solo como "approved" en esta base:
-- no quedaba constancia de en QUE cadena, con que transaccion, ni que paso si
-- el registro fallaba.
--
-- Esta tabla lo hace explicito y permite acreditar en varias redes. El caso
-- que la motiva es HashKey Chain: una cadena compliance-first donde un
-- auditor puede preguntarle al contrato si una institucion esta acreditada,
-- sin pasar por la API de Tessera. Eso es lo que convierte un diploma en un
-- activo del mundo real verificable.
--
-- Es trazabilidad, nunca autorizacion: quien decide sigue siendo el contrato.
-- Una fila aqui solo dice que se intento y como termino.

CREATE TABLE IF NOT EXISTS "institution_accreditations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL,
  "chain_id" integer NOT NULL,
  -- pending: aun no se intento. confirmed: el contrato la reconoce.
  -- failed: el intento termino en error; failure_reason explica cual.
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "tx_hash" varchar(66),
  "failure_reason" text,
  -- Cuantas veces se intento. Un RPC intermitente --HSK testnet lo es-- puede
  -- necesitar varios intentos, y conviene ver cuantos llevo.
  "attempts" integer DEFAULT 0 NOT NULL,
  "accredited_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "institution_accreditations"
    ADD CONSTRAINT "institution_accreditations_institution_id_institutions_id_fk"
    FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Una acreditacion por institucion y red: reintentar actualiza la fila en vez
-- de acumular intentos sueltos que harian imposible saber el estado actual.
CREATE UNIQUE INDEX IF NOT EXISTS "institution_accreditations_unique"
  ON "institution_accreditations" ("institution_id", "chain_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "institution_accreditations_chain_idx"
  ON "institution_accreditations" ("chain_id", "status");
