-- Topics, assessments, questions y attempts
DO $$ BEGIN
  CREATE TYPE "public"."assessment_scope" AS ENUM ('topic', 'module');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."assessment_type" AS ENUM ('multiple_choice', 'true_false', 'essay');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."assessment_question_kind" AS ENUM ('single', 'boolean', 'text');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."assessment_attempt_status" AS ENUM ('in_progress', 'submitted', 'graded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "topics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "module_id" uuid NOT NULL REFERENCES "modules"("id") ON DELETE CASCADE,
  "title" varchar(200) NOT NULL,
  "description" text,
  "content_type" varchar(50) NOT NULL DEFAULT 'text',
  "content" jsonb,
  "order_index" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "topics_module_idx" ON "topics" ("module_id", "order_index");

CREATE TABLE IF NOT EXISTS "assessments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "module_id" uuid NOT NULL REFERENCES "modules"("id") ON DELETE CASCADE,
  "topic_id" uuid REFERENCES "topics"("id") ON DELETE SET NULL,
  "scope" "assessment_scope" NOT NULL DEFAULT 'module',
  "type" "assessment_type" NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" text,
  "weight" integer NOT NULL DEFAULT 0,
  "max_score" integer NOT NULL DEFAULT 100,
  "passing_score" integer NOT NULL DEFAULT 60,
  "attempts_allowed" integer NOT NULL DEFAULT 1,
  "time_limit_min" integer,
  "order_index" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "assessments_module_idx" ON "assessments" ("module_id", "order_index");
CREATE INDEX IF NOT EXISTS "assessments_topic_idx" ON "assessments" ("topic_id");

CREATE TABLE IF NOT EXISTS "assessment_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "assessment_id" uuid NOT NULL REFERENCES "assessments"("id") ON DELETE CASCADE,
  "prompt" text NOT NULL,
  "kind" "assessment_question_kind" NOT NULL,
  "options" jsonb,
  "correct_answer" jsonb,
  "points" integer NOT NULL DEFAULT 1,
  "order_index" integer NOT NULL
);
CREATE INDEX IF NOT EXISTS "assessment_questions_idx" ON "assessment_questions" ("assessment_id", "order_index");

CREATE TABLE IF NOT EXISTS "assessment_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "enrollment_id" uuid NOT NULL REFERENCES "enrollments"("id") ON DELETE CASCADE,
  "assessment_id" uuid NOT NULL REFERENCES "assessments"("id") ON DELETE CASCADE,
  "attempt_number" integer NOT NULL DEFAULT 1,
  "status" "assessment_attempt_status" NOT NULL DEFAULT 'in_progress',
  "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "score" integer,
  "graded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "graded_at" timestamptz,
  "feedback" text,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "submitted_at" timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_attempts_unique" ON "assessment_attempts" ("enrollment_id", "assessment_id", "attempt_number");
CREATE INDEX IF NOT EXISTS "assessment_attempts_enrollment_idx" ON "assessment_attempts" ("enrollment_id");
CREATE INDEX IF NOT EXISTS "assessment_attempts_assessment_idx" ON "assessment_attempts" ("assessment_id");

-- Backfill: por cada module existente, crear un topic por defecto que herede su contenido.
INSERT INTO "topics" ("module_id", "title", "description", "content_type", "content", "order_index")
SELECT m."id", m."title", m."description", m."content_type", m."content", 0
FROM "modules" m
WHERE NOT EXISTS (SELECT 1 FROM "topics" t WHERE t."module_id" = m."id");
