ALTER TABLE "campaigns" ADD COLUMN "budget_paise" integer;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "starts_at" timestamp;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "spent_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "cost_price" integer;