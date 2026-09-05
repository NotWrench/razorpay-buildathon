CREATE TABLE "product_price_history" (
	"actor_type" text NOT NULL,
	"changed_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"new_price" integer NOT NULL,
	"old_price" integer NOT NULL,
	"product_id" uuid NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_price_history_productId_idx" ON "product_price_history" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_price_history_merchantId_idx" ON "product_price_history" USING btree ("merchant_id");