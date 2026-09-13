-- Portada de un temario con material.
--
-- La previsualizacion de video y audio no puede ser un recorte del archivo:
-- requiere ffmpeg, un binario de sistema que no esta en la imagen. La portada
-- resuelve lo mismo y mejor: es lo que muestran las plataformas de cursos
-- --una imagen con el titulo y la duracion-- y comunica de que va la clase sin
-- entregar nada del contenido de pago.
--
-- Se guardan dos derivados y ninguno es el original:
--   cover_key      la portada nitida, para quien tiene llave
--   cover_blur_key la misma difuminada, para quien no la tiene
--
-- El difuminado se genera en el servidor a proposito. Aplicarlo por CSS lo
-- volveria decorativo: cualquiera lo quita desde el inspector y se lleva la
-- imagen intacta.

ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "cover_key" text;
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "cover_blur_key" text;
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "cover_mime_type" varchar(120);
-- Dimensiones de la portada nitida. Permiten reservar el espacio antes de que
-- la imagen cargue, para que la ficha del temario no de un salto al pintarse.
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "cover_width" integer;
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "cover_height" integer;
-- Duracion del material en segundos. Se muestra sobre la portada: saber que
-- una clase dura 12 minutos es parte de lo que decide la compra, y no revela
-- nada del contenido.
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "asset_duration_seconds" integer;
