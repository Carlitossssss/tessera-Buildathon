ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "rejected_at" timestamp with time zone;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
