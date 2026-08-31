CREATE TABLE "inventory" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"last_restocked_at" timestamp,
	"low_stock_threshold" integer,
	"merchant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"reorder_point" integer,
	"reorder_quantity" integer,
	"supplier_lead_time_days" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_productId_uidx" ON "inventory" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_merchantId_idx" ON "inventory" USING btree ("merchant_id");