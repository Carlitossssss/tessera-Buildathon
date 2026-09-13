ALTER TABLE "verification_tokens" ADD COLUMN IF NOT EXISTS "payload" jsonb;
