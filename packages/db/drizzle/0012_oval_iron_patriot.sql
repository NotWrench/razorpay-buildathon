CREATE TABLE "merchant_policy" (
	"agent_orders_require_approval" boolean DEFAULT true NOT NULL,
	"auto_approve_ceiling_paise" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"margin_floor_percent" integer,
	"max_discount_percent" integer,
	"max_price_move_percent" integer,
	"merchant_id" uuid PRIMARY KEY NOT NULL,
	"spend_cap_paise" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_policy" ADD CONSTRAINT "merchant_policy_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;