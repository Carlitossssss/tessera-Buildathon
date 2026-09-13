-- Copias del certificado en redes secundarias.
--
-- La red principal decide si el certificado existe; un espejo es una emision
-- adicional del mismo contenido en otra cadena y su fallo no invalida el
-- original, que ya esta minteado y no se puede deshacer.
CREATE TABLE IF NOT EXISTS "certificate_mirrors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "certificate_id" uuid NOT NULL,
  "chain_id" integer NOT NULL,
  "status" varchar(20) DEFAULT 'queued' NOT NULL,
  "onchain_token_id" bigint,
  "tx_hash" varchar(66),
  "block_number" bigint,
  "failure_reason" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certificate_mirrors"
    ADD CONSTRAINT "certificate_mirrors_certificate_id_certificates_id_fk"
    FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Un solo espejo por certificado y red: si el job se reintenta, actualiza la
-- fila existente en vez de mintear dos veces en la misma cadena.
CREATE UNIQUE INDEX IF NOT EXISTS "certificate_mirrors_cert_chain_key"
  ON "certificate_mirrors" ("certificate_id","chain_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certificate_mirrors_status_idx"
  ON "certificate_mirrors" ("status");
