CREATE TABLE "build_items" (
	"build_id" uuid NOT NULL,
	"category_slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "builds" (
	"buyer_identifier" text NOT NULL,
	"conversation_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text
);
--> statement-breakpoint
ALTER TABLE "build_items" ADD CONSTRAINT "build_items_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_items" ADD CONSTRAINT "build_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "build_items_buildId_idx" ON "build_items" USING btree ("build_id");--> statement-breakpoint
CREATE INDEX "build_items_productId_idx" ON "build_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "builds_merchantId_idx" ON "builds" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "builds_buyerIdentifier_idx" ON "builds" USING btree ("buyer_identifier");--> statement-breakpoint
CREATE INDEX "builds_status_idx" ON "builds" USING btree ("status");