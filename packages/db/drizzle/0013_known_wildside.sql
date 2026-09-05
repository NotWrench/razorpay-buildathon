CREATE TABLE "addresses" (
	"buyer_identifier" text NOT NULL,
	"city" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"merchant_id" uuid NOT NULL,
	"phone" text,
	"pincode" text NOT NULL,
	"is_primary" text DEFAULT 'no' NOT NULL,
	"state" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_merchantId_idx" ON "addresses" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "addresses_buyerIdentifier_idx" ON "addresses" USING btree ("buyer_identifier");