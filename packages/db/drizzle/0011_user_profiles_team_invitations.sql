DO $$ BEGIN
 CREATE TYPE "public"."user_profile_status" AS ENUM('incomplete', 'pending', 'approved', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"first_name" varchar(120),
	"last_name" varchar(120),
	"document_type" varchar(40),
	"document_number" varchar(80),
	"birth_date" date,
	"phone" varchar(60),
	"country" varchar(2),
	"city" varchar(120),
	"address_line" varchar(240),
	"status" "user_profile_status" DEFAULT 'incomplete' NOT NULL,
	"profile_completed_at" timestamp with time zone,
	"profile_submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"course_id" uuid,
	"email" varchar(255) NOT NULL,
	"name" varchar(200),
	"member_role" varchar(50) DEFAULT 'teacher' NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_user_key" ON "user_profiles" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_profiles_status_idx" ON "user_profiles" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_invitations_token_key" ON "team_invitations" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_invitations_email_idx" ON "team_invitations" USING btree ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_invitations_institution_idx" ON "team_invitations" USING btree ("institution_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_invitations_course_idx" ON "team_invitations" USING btree ("course_id");
