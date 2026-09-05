CREATE TABLE "buyer_mandates" (
	"buyer_identifier" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instrument" text DEFAULT 'simulated' NOT NULL,
	"max_per_order_paise" integer NOT NULL,
	"max_total_paise" integer NOT NULL,
	"merchant_id" uuid NOT NULL,
	"razorpay_customer_id" text,
	"razorpay_token_id" text,
	"revoked_at" timestamp,
	"spent_paise" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text
);
--> statement-breakpoint
ALTER TABLE "buyer_mandates" ADD CONSTRAINT "buyer_mandates_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_mandates" ADD CONSTRAINT "buyer_mandates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "buyer_mandates_buyerIdentifier_idx" ON "buyer_mandates" USING btree ("buyer_identifier");--> statement-breakpoint
CREATE INDEX "buyer_mandates_merchantId_idx" ON "buyer_mandates" USING btree ("merchant_id");