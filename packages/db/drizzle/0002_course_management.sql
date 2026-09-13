-- Course management v2: enriched modules, teacher assignment, granular progress.

ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "weight" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "is_required" boolean DEFAULT true NOT NULL;
--> statement-breakpoint

ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "student_email" varchar(255);
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "student_name" varchar(200);
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "enrollment_source" varchar(20) DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "course_teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assignment_role" varchar(20) DEFAULT 'owner' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_teachers" ADD CONSTRAINT "course_teachers_course_id_courses_id_fk"
   FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_teachers" ADD CONSTRAINT "course_teachers_user_id_users_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_teachers_unique" ON "course_teachers" ("course_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_teachers_user_idx" ON "course_teachers" ("user_id");
--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "public"."module_progress_status" AS ENUM('not_started','in_progress','completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "module_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"status" "module_progress_status" DEFAULT 'not_started' NOT NULL,
	"score" integer,
	"note" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "module_progress" ADD CONSTRAINT "module_progress_enrollment_id_enrollments_id_fk"
   FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "module_progress" ADD CONSTRAINT "module_progress_module_id_modules_id_fk"
   FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "module_progress" ADD CONSTRAINT "module_progress_updated_by_users_id_fk"
   FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "module_progress_unique" ON "module_progress" ("enrollment_id","module_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "module_progress_enrollment_idx" ON "module_progress" ("enrollment_id");
