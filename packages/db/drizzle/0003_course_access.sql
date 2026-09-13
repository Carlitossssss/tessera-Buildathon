-- 0003: Visibility, access codes y student-of-institution

DO $$ BEGIN
  CREATE TYPE "public"."course_visibility" AS ENUM('public_free', 'public_paid', 'private_code', 'hybrid');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "visibility" "course_visibility" NOT NULL DEFAULT 'private_code';
--> statement-breakpoint

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "access_code" varchar(16);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "courses_access_code_unique"
  ON "courses" ("institution_id", "access_code");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "courses_visibility_idx"
  ON "courses" ("visibility");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "institution_students" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL REFERENCES "institutions"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "external_id" varchar(100),
  "joined_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "institution_students_unique"
  ON "institution_students" ("institution_id", "user_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "institution_students_user_idx"
  ON "institution_students" ("user_id");
