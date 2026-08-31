CREATE TABLE "reorder_requests" (
	"approved_at" timestamp,
	"approved_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_agent" boolean DEFAULT false NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"stock_at_request" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reorder_requests" ADD CONSTRAINT "reorder_requests_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reorder_requests" ADD CONSTRAINT "reorder_requests_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reorder_requests" ADD CONSTRAINT "reorder_requests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reorder_requests_merchantId_idx" ON "reorder_requests" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "reorder_requests_productId_idx" ON "reorder_requests" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "reorder_requests_status_idx" ON "reorder_requests" USING btree ("status");