CREATE TABLE "product_specs" (
	"category_slug" text NOT NULL,
	"chipset" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"extra" jsonb,
	"form_factor" text,
	"height_mm" integer,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"length_mm" integer,
	"m2_slots" integer,
	"max_cooler_height_mm" integer,
	"max_gpu_length_mm" integer,
	"memory_capacity_gb" integer,
	"memory_slots" integer,
	"memory_speed_mhz" integer,
	"memory_type" text,
	"merchant_id" uuid NOT NULL,
	"pcie_power_connectors" jsonb,
	"product_id" uuid NOT NULL,
	"psu_wattage" integer,
	"recommended_psu_watts" integer,
	"sata_ports" integer,
	"socket" text,
	"storage_interface" text,
	"tdp_watts" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"width_mm" integer
);
--> statement-breakpoint
ALTER TABLE "product_specs" ADD CONSTRAINT "product_specs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_specs" ADD CONSTRAINT "product_specs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_specs_productId_uidx" ON "product_specs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_specs_merchantId_idx" ON "product_specs" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "product_specs_categorySlug_idx" ON "product_specs" USING btree ("category_slug");--> statement-breakpoint
CREATE INDEX "product_specs_socket_idx" ON "product_specs" USING btree ("socket");