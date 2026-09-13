-- Membresia Unlock en cursos (parte 2: la garantia de integridad).
--
-- Un curso token-gated sin Lock seria inaccesible para siempre: apareceria en
-- el catalogo, nadie podria matricularse y su contenido quedaria enterrado.
-- La API ya lo valida, pero la garantia vive tambien en la base para que no
-- dependa de que ninguna ruta futura se salte la comprobacion.
--
-- El CHECK compara sobre texto ("visibility"::text) en vez de contra el
-- literal del enum a proposito. Postgres prohibe USAR un valor de enum en la
-- misma transaccion en la que se añadio ("New enum values must be committed
-- before they can be used"), y el migrador de Drizzle aplica todas las
-- migraciones pendientes dentro de una sola transaccion: en una base nueva,
-- 0019 y 0020 corren juntas. Al castear a texto la restriccion no toca el
-- catalogo de enums y funciona tanto en una base nueva como en una existente.

DO $$ BEGIN
  ALTER TABLE "courses" ADD CONSTRAINT "courses_token_gated_requires_lock"
    CHECK (
      "visibility"::text <> 'token_gated'
      OR ("lock_address" IS NOT NULL AND "lock_chain_id" IS NOT NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
