-- Como caduca el acceso de un curso token-gated.
--
-- Hasta ahora la matricula era perpetua: quien entraba una vez con una llave
-- valida conservaba el curso para siempre, aunque su membresia venciera al dia
-- siguiente. Para un curso de pago unico eso es correcto --una entrada
-- comprada no se invalida-- pero convertia cualquier suscripcion en pago
-- unico, y Unlock es justamente un protocolo de suscripciones: su
-- expirationDuration existe para cortar el acceso.
--
--   perpetual     el acceso concedido no vence. Es el comportamiento previo y
--                 sigue siendo el valor por defecto, para no cambiar bajo los
--                 pies de los cursos que ya existen.
--   subscription  el Lock se revalida al entrar; una llave vencida cierra el
--                 contenido hasta que se renueve.

DO $$ BEGIN
  CREATE TYPE "course_access_mode" AS ENUM ('perpetual', 'subscription');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "access_mode" "course_access_mode" NOT NULL DEFAULT 'perpetual';

-- Solo un curso token-gated puede ser suscripcion: sin Lock no hay llave que
-- revalidar, y un curso abierto en modo suscripcion se cerraria para siempre.
ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_subscription_requires_gate";
ALTER TABLE "courses" ADD CONSTRAINT "courses_subscription_requires_gate"
  CHECK ("access_mode" = 'perpetual' OR "visibility"::text = 'token_gated');
