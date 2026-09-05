ALTER TABLE "apikey" ADD COLUMN "config_id" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "last_refill_at" timestamp;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "last_request" timestamp;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "prefix" text;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "rate_limit_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "rate_limit_max" integer;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "rate_limit_time_window" integer;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "reference_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "refill_amount" integer;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "refill_interval" integer;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "remaining" integer;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "request_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "start" text;--> statement-breakpoint
CREATE INDEX "apikey_referenceId_idx" ON "apikey" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "apikey_configId_idx" ON "apikey" USING btree ("config_id");