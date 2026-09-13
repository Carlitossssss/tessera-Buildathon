-- Lock por defecto de la institucion.
--
-- Hasta ahora el Lock se pedia a mano en tres sitios --crear curso, editar
-- curso y publicar en el portal-- y habia que pegar una direccion de 42
-- caracteres cada vez. Con veinte cursos son veinte oportunidades de escribir
-- mal un caracter y dejar el curso inaccesible.
--
-- Un Lock es un contrato con beneficiario propio: quien lo despliega es quien
-- cobra. Por eso pertenece a la institucion y no a Tessera, y por eso tiene
-- sentido guardarlo una vez a ese nivel: el mismo emisor cobra todos sus
-- cursos y todo su contenido.
--
-- Los cursos conservan su propio lock_address: sigue siendo la fuente de
-- verdad de cada curso, y permite que uno concreto use un Lock distinto (un
-- precio especial, una cohorte aparte). Esta columna solo aporta el valor que
-- se propone por defecto al crear.

ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "default_lock_address" varchar(42);
--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "default_lock_chain_id" integer;
--> statement-breakpoint

-- Una direccion sin red --o al reves-- no sirve para proponer nada: harian
-- falta las dos para construir el checkout. La base exige que vayan juntas.
DO $$ BEGIN
  ALTER TABLE "institutions" ADD CONSTRAINT "institutions_default_lock_complete"
    CHECK (
      ("default_lock_address" IS NULL AND "default_lock_chain_id" IS NULL)
      OR ("default_lock_address" IS NOT NULL AND "default_lock_chain_id" IS NOT NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
